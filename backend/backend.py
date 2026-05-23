"""
Intent Audit REST API
=====================
FastAPI backend for querying the intent_audit MySQL database.

Start:
    pip install fastapi uvicorn mysql-connector-python
    uvicorn api:app --reload --port 8000

Docs auto-generated at:
    http://localhost:8000/docs      (Swagger UI)
    http://localhost:8000/redoc     (ReDoc)
"""

import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, AsyncGenerator

import mysql.connector
from mysql.connector.pooling import MySQLConnectionPool
from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# ─────────────────────────── DB CONFIG (from env) ────────────────────────────
import os
DB_CONFIG = dict(
    host     = os.environ.get("DB_HOST",     "127.0.0.1"),
    port     = int(os.environ.get("DB_PORT", "3306")),
    user     = os.environ.get("DB_USER",     "root"),
    password = os.environ.get("DB_PASSWORD", ""),
    database = os.environ.get("DB_NAME",     "intent_audit"),
)
POOL_SIZE = 5
# ──────────────────────────────────────────────────────────────────────────────

_pool: MySQLConnectionPool | None = None


def get_pool() -> MySQLConnectionPool:
    global _pool
    if _pool is None:
        _pool = MySQLConnectionPool(pool_name="api_pool", pool_size=POOL_SIZE, **DB_CONFIG)
    return _pool


def db():
    """Return a pooled connection. Caller must close() it."""
    return get_pool().get_connection()


def query_one(sql: str, params: tuple = ()) -> dict | None:
    conn = db()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        return cur.fetchone()
    finally:
        conn.close()


def query_many(sql: str, params: tuple = ()) -> list[dict]:
    conn = db()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        return cur.fetchall()
    finally:
        conn.close()


def execute(sql: str, params: tuple = ()) -> int:
    """Execute a write statement, return lastrowid."""
    conn = db()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


# ─────────────────────────── PYDANTIC MODELS ─────────────────────────────────

class Intent(BaseModel):
    id:               int
    record_num:       str
    broadcast_id:     Optional[str]
    action:           Optional[str]
    target_component: Optional[str]
    sender_package:   Optional[str]
    flags:            Optional[str]
    xflags:           Optional[str]
    enqueue_time:     Optional[datetime]
    dispatch_time:    Optional[datetime]
    finish_time:      Optional[datetime]
    extras_raw:       Optional[str]
    poll_time:        datetime
    fingerprint:      str

    class Config:
        from_attributes = True


class IntentSummary(BaseModel):
    """Lightweight version without extras_raw — useful for list endpoints."""
    id:               int
    record_num:       str
    action:           Optional[str]
    target_component: Optional[str]
    sender_package:   Optional[str]
    flags:            Optional[str]
    enqueue_time:     Optional[datetime]
    dispatch_time:    Optional[datetime]
    finish_time:      Optional[datetime]
    poll_time:        datetime


class Chain(BaseModel):
    id:          int
    name:        str
    description: Optional[str]
    created_at:  datetime


class ChainCreate(BaseModel):
    name:        str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ChainUpdate(BaseModel):
    name:        Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class ChainMember(BaseModel):
    id:        int
    intent_id: int
    chain_id:  int
    position:  int
    label:     Optional[str]
    added_at:  datetime
    # joined intent fields
    action:           Optional[str] = None
    target_component: Optional[str] = None
    sender_package:   Optional[str] = None
    enqueue_time:     Optional[datetime] = None


class AddToChainRequest(BaseModel):
    intent_id: int
    position:  int = Field(..., ge=0)
    label:     Optional[str] = Field(None, max_length=255)


class PaginatedIntents(BaseModel):
    total:   int
    offset:  int
    limit:   int
    items:   list[IntentSummary]


# ─────────────────────────── APP ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the pool on startup
    get_pool()
    yield

app = FastAPI(
    title="Intent Audit API",
    description="Query and manage Android broadcast intents captured from ADB.",
    version="1.0.0",
    lifespan=lifespan,
)


# ═════════════════════════════════════════════════════════════════════════════
#  INTENTS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/intents", response_model=PaginatedIntents, tags=["Intents"],
         summary="List all intents (paginated)")
def list_intents(
    offset: int = Query(0, ge=0),
    limit:  int = Query(50, ge=1, le=500),
):
    total = query_one("SELECT COUNT(*) AS n FROM intents")["n"]
    rows  = query_many(
        "SELECT id, record_num, action, target_component, sender_package, "
        "flags, enqueue_time, dispatch_time, finish_time, poll_time "
        "FROM intents ORDER BY id DESC LIMIT %s OFFSET %s",
        (limit, offset),
    )
    return PaginatedIntents(total=total, offset=offset, limit=limit, items=rows)


@app.get("/intents/{intent_id}", response_model=Intent, tags=["Intents"],
         summary="Get a single intent by ID (includes full extras_raw)")
def get_intent(intent_id: int = Path(..., ge=1)):
    row = query_one("SELECT * FROM intents WHERE id = %s", (intent_id,))
    if not row:
        raise HTTPException(404, f"Intent {intent_id} not found")
    return row


@app.get("/intents/stream/{since_id}", tags=["Intents"],
         summary="SSE stream — returns all intents with id > since_id, then keeps polling",
         response_class=StreamingResponse)
def stream_intents(
    since_id:    int = Path(..., ge=0, description="Last seen intent id; 0 to start from beginning"),
    poll_ms:     int = Query(1000, ge=200, le=10000, description="Server poll interval in ms"),
    include_extras: bool = Query(False, description="Include extras_raw in stream payload"),
):
    """
    Server-Sent Events stream.
    Connect with:
        curl -N http://localhost:8000/intents/stream/0
    Each event is a JSON object.  The client should track the highest id
    it has received and reconnect with that id to resume.
    """
    import time

    fields = (
        "id, record_num, action, target_component, sender_package, "
        "flags, xflags, enqueue_time, dispatch_time, finish_time, poll_time"
        + (", extras_raw" if include_extras else "")
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        cursor = since_id
        import asyncio
        while True:
            rows = query_many(
                f"SELECT {fields} FROM intents WHERE id > %s ORDER BY id ASC LIMIT 100",
                (cursor,),
            )
            for row in rows:
                # datetime → str for JSON serialisation
                payload = {k: (v.isoformat() if isinstance(v, datetime) else v)
                           for k, v in row.items()}
                yield f"data: {json.dumps(payload)}\n\n"
                cursor = max(cursor, row["id"])
            await asyncio.sleep(poll_ms / 1000)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/intents/search/action", response_model=list[IntentSummary], tags=["Intents"],
         summary="Search intents by action name (substring match)")
def search_by_action(
    q:      str = Query(..., min_length=1, description="Substring to match against action"),
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    rows = query_many(
        "SELECT id, record_num, action, target_component, sender_package, "
        "flags, enqueue_time, dispatch_time, finish_time, poll_time "
        "FROM intents WHERE action LIKE %s ORDER BY id DESC LIMIT %s OFFSET %s",
        (f"%{q}%", limit, offset),
    )
    return rows


@app.get("/intents/search/package", response_model=list[IntentSummary], tags=["Intents"],
         summary="Search intents by sender package (substring match)")
def search_by_package(
    q:      str = Query(..., min_length=1),
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    rows = query_many(
        "SELECT id, record_num, action, target_component, sender_package, "
        "flags, enqueue_time, dispatch_time, finish_time, poll_time "
        "FROM intents WHERE sender_package LIKE %s ORDER BY id DESC LIMIT %s OFFSET %s",
        (f"%{q}%", limit, offset),
    )
    return rows


@app.get("/intents/search/component", response_model=list[IntentSummary], tags=["Intents"],
         summary="Search intents by target component (substring match)")
def search_by_component(
    q:      str = Query(..., min_length=1),
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    rows = query_many(
        "SELECT id, record_num, action, target_component, sender_package, "
        "flags, enqueue_time, dispatch_time, finish_time, poll_time "
        "FROM intents WHERE target_component LIKE %s ORDER BY id DESC LIMIT %s OFFSET %s",
        (f"%{q}%", limit, offset),
    )
    return rows


@app.get("/intents/search/extras", response_model=list[IntentSummary], tags=["Intents"],
         summary="Full-text search inside extras_raw")
def search_by_extras(
    q:      str = Query(..., min_length=1, description="Substring to find inside extras"),
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    rows = query_many(
        "SELECT id, record_num, action, target_component, sender_package, "
        "flags, enqueue_time, dispatch_time, finish_time, poll_time "
        "FROM intents WHERE extras_raw LIKE %s ORDER BY id DESC LIMIT %s OFFSET %s",
        (f"%{q}%", limit, offset),
    )
    return rows


@app.get("/intents/search/date", response_model=list[IntentSummary], tags=["Intents"],
         summary="Filter intents by enqueue_time range")
def search_by_date(
    from_dt: datetime = Query(..., description="Range start (ISO 8601, e.g. 2026-05-21T00:00:00)"),
    to_dt:   datetime = Query(..., description="Range end   (ISO 8601, e.g. 2026-05-21T23:59:59)"),
    limit:   int      = Query(200, ge=1, le=1000),
    offset:  int      = Query(0, ge=0),
):
    if from_dt >= to_dt:
        raise HTTPException(400, "from_dt must be before to_dt")
    rows = query_many(
        "SELECT id, record_num, action, target_component, sender_package, "
        "flags, enqueue_time, dispatch_time, finish_time, poll_time "
        "FROM intents WHERE enqueue_time BETWEEN %s AND %s "
        "ORDER BY enqueue_time ASC LIMIT %s OFFSET %s",
        (from_dt, to_dt, limit, offset),
    )
    return rows


@app.get("/intents/search/flags", response_model=list[IntentSummary], tags=["Intents"],
         summary="Filter intents by exact flags value")
def search_by_flags(
    flags:  str = Query(..., description="Hex flag value, e.g. 0x60000010"),
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    rows = query_many(
        "SELECT id, record_num, action, target_component, sender_package, "
        "flags, enqueue_time, dispatch_time, finish_time, poll_time "
        "FROM intents WHERE flags = %s ORDER BY id DESC LIMIT %s OFFSET %s",
        (flags, limit, offset),
    )
    return rows


@app.get("/intents/stats/actions", tags=["Intents"],
         summary="Count intents grouped by action — useful for finding dominant event types")
def stats_by_action(limit: int = Query(20, ge=1, le=200)):
    rows = query_many(
        "SELECT action, COUNT(*) AS count FROM intents "
        "GROUP BY action ORDER BY count DESC LIMIT %s",
        (limit,),
    )
    return rows


@app.get("/intents/stats/senders", tags=["Intents"],
         summary="Count intents grouped by sender_package")
def stats_by_sender(limit: int = Query(20, ge=1, le=200)):
    rows = query_many(
        "SELECT sender_package, COUNT(*) AS count FROM intents "
        "GROUP BY sender_package ORDER BY count DESC LIMIT %s",
        (limit,),
    )
    return rows


# ═════════════════════════════════════════════════════════════════════════════
#  CHAINS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/chains", response_model=list[Chain], tags=["Chains"],
         summary="List all chains")
def list_chains():
    return query_many("SELECT * FROM chains ORDER BY id DESC")


@app.get("/chains/{chain_id}", response_model=Chain, tags=["Chains"],
         summary="Get a chain by ID")
def get_chain(chain_id: int = Path(..., ge=1)):
    row = query_one("SELECT * FROM chains WHERE id = %s", (chain_id,))
    if not row:
        raise HTTPException(404, f"Chain {chain_id} not found")
    return row


@app.post("/chains", response_model=Chain, status_code=201, tags=["Chains"],
          summary="Create a new chain")
def create_chain(body: ChainCreate):
    existing = query_one("SELECT id FROM chains WHERE name = %s", (body.name,))
    if existing:
        raise HTTPException(409, f"Chain name '{body.name}' already exists (id={existing['id']})")
    new_id = execute(
        "INSERT INTO chains (name, description) VALUES (%s, %s)",
        (body.name, body.description),
    )
    return query_one("SELECT * FROM chains WHERE id = %s", (new_id,))


@app.patch("/chains/{chain_id}", response_model=Chain, tags=["Chains"],
           summary="Update chain name or description")
def update_chain(chain_id: int, body: ChainUpdate):
    row = query_one("SELECT * FROM chains WHERE id = %s", (chain_id,))
    if not row:
        raise HTTPException(404, f"Chain {chain_id} not found")
    new_name = body.name        if body.name        is not None else row["name"]
    new_desc = body.description if body.description is not None else row["description"]
    execute(
        "UPDATE chains SET name = %s, description = %s WHERE id = %s",
        (new_name, new_desc, chain_id),
    )
    return query_one("SELECT * FROM chains WHERE id = %s", (chain_id,))


@app.delete("/chains/{chain_id}", status_code=204, tags=["Chains"],
            summary="Delete a chain (cascade-removes all intents_chains rows)")
def delete_chain(chain_id: int):
    row = query_one("SELECT id FROM chains WHERE id = %s", (chain_id,))
    if not row:
        raise HTTPException(404, f"Chain {chain_id} not found")
    execute("DELETE FROM chains WHERE id = %s", (chain_id,))


# ═════════════════════════════════════════════════════════════════════════════
#  INTENTS ↔ CHAINS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/chains/{chain_id}/intents", response_model=list[ChainMember], tags=["Chains"],
         summary="Get all intents in a chain, ordered by position")
def get_chain_intents(chain_id: int = Path(..., ge=1)):
    row = query_one("SELECT id FROM chains WHERE id = %s", (chain_id,))
    if not row:
        raise HTTPException(404, f"Chain {chain_id} not found")
    return query_many(
        "SELECT ic.id, ic.intent_id, ic.chain_id, ic.position, ic.label, ic.added_at, "
        "       i.action, i.target_component, i.sender_package, i.enqueue_time "
        "FROM intents_chains ic "
        "JOIN intents i ON i.id = ic.intent_id "
        "WHERE ic.chain_id = %s "
        "ORDER BY ic.position ASC",
        (chain_id,),
    )


@app.post("/chains/{chain_id}/intents", response_model=ChainMember, status_code=201,
          tags=["Chains"], summary="Add an intent to a chain at a given position")
def add_intent_to_chain(chain_id: int, body: AddToChainRequest):
    if not query_one("SELECT id FROM chains WHERE id = %s", (chain_id,)):
        raise HTTPException(404, f"Chain {chain_id} not found")
    if not query_one("SELECT id FROM intents WHERE id = %s", (body.intent_id,)):
        raise HTTPException(404, f"Intent {body.intent_id} not found")
    existing = query_one(
        "SELECT id FROM intents_chains WHERE chain_id = %s AND position = %s",
        (chain_id, body.position),
    )
    if existing:
        raise HTTPException(
            409,
            f"Position {body.position} in chain {chain_id} is already taken "
            f"(intents_chains.id={existing['id']}). "
            "Delete or reorder existing entry first."
        )
    new_id = execute(
        "INSERT INTO intents_chains (intent_id, chain_id, position, label) VALUES (%s, %s, %s, %s)",
        (body.intent_id, chain_id, body.position, body.label),
    )
    return query_one(
        "SELECT ic.id, ic.intent_id, ic.chain_id, ic.position, ic.label, ic.added_at, "
        "       i.action, i.target_component, i.sender_package, i.enqueue_time "
        "FROM intents_chains ic "
        "JOIN intents i ON i.id = ic.intent_id "
        "WHERE ic.id = %s",
        (new_id,),
    )


@app.delete("/chains/{chain_id}/intents/{member_id}", status_code=204, tags=["Chains"],
            summary="Remove an intent from a chain by intents_chains.id")
def remove_intent_from_chain(chain_id: int, member_id: int):
    row = query_one(
        "SELECT id FROM intents_chains WHERE id = %s AND chain_id = %s",
        (member_id, chain_id),
    )
    if not row:
        raise HTTPException(404, f"Member {member_id} not found in chain {chain_id}")
    execute("DELETE FROM intents_chains WHERE id = %s", (member_id,))


@app.patch("/chains/{chain_id}/intents/{member_id}", response_model=ChainMember, tags=["Chains"],
           summary="Update position or label of a chain member")
def update_chain_member(
    chain_id:  int,
    member_id: int,
    position:  Optional[int]  = Query(None, ge=0),
    label:     Optional[str]  = Query(None, max_length=255),
):
    row = query_one(
        "SELECT * FROM intents_chains WHERE id = %s AND chain_id = %s",
        (member_id, chain_id),
    )
    if not row:
        raise HTTPException(404, f"Member {member_id} not found in chain {chain_id}")

    new_pos   = position if position is not None else row["position"]
    new_label = label    if label    is not None else row["label"]

    if position is not None and position != row["position"]:
        clash = query_one(
            "SELECT id FROM intents_chains WHERE chain_id = %s AND position = %s AND id != %s",
            (chain_id, position, member_id),
        )
        if clash:
            raise HTTPException(409, f"Position {position} is already taken in chain {chain_id}")

    execute(
        "UPDATE intents_chains SET position = %s, label = %s WHERE id = %s",
        (new_pos, new_label, member_id),
    )
    return query_one(
        "SELECT ic.id, ic.intent_id, ic.chain_id, ic.position, ic.label, ic.added_at, "
        "       i.action, i.target_component, i.sender_package, i.enqueue_time "
        "FROM intents_chains ic "
        "JOIN intents i ON i.id = ic.intent_id "
        "WHERE ic.id = %s",
        (member_id,),
    )


# ═════════════════════════════════════════════════════════════════════════════
#  MISC
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["Meta"], summary="DB connectivity check")
def health():
    try:
        row = query_one("SELECT COUNT(*) AS intents FROM intents")
        return {"status": "ok", "intents_in_db": row["intents"]}
    except Exception as e:
        raise HTTPException(503, f"DB error: {e}")


@app.get("/", tags=["Meta"], summary="API info")
def root():
    return {
        "name":    "Intent Audit API",
        "version": "1.0.0",
        "docs":    "/docs",
    }
