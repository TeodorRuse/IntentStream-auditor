"""
IntentStream Auditor — ADB Broadcast Monitor with MySQL persistence
====================================================================
Polls `dumpsys activity broadcasts` and stores every new or mutated
broadcast intent into a local MySQL database.

Schema (auto-created on first run):
  intents        — one row per unique broadcast record
  chains         — researcher-defined event chains
  intents_chains — many-to-many join with position + label

Dependencies:
  pip install mysql-connector-python
  MySQL server running locally (configure DB_* constants below)
"""

import subprocess
import time
import re
import json
import sys
from datetime import datetime

import mysql.connector
from mysql.connector import Error as MySQLError

# ─────────────────────────── DB CONFIG ───────────────────────────────────────
DB_HOST     = "127.0.0.1"
DB_PORT     = 3306
DB_USER     = "root"
DB_PASSWORD = "intentaudit"          # set your password here
DB_NAME     = "intent_audit"
# ──────────────────────────────────────────────────────────────────────────────

# Pre-compiled regexes — applied once per line for speed
_RE_RECORD_NUM   = re.compile(r'^\s*#(\d+):\s*(.*)')
_RE_ACT          = re.compile(r'\bact=(\S+)')
_RE_CMP          = re.compile(r'\bcmp=(\S+)')
_RE_PKG          = re.compile(r'\bpkg=(\S+)')
_RE_FLG          = re.compile(r'\bflg=(0x[0-9a-fA-F]+)')
_RE_XFLG         = re.compile(r'\bxflg=(0x[0-9a-fA-F]+)')
_RE_CALLER       = re.compile(r'\bcaller=(\S+?)(?=\s|$)')
_RE_ORIG_UID     = re.compile(r'originalCallingUid:\s*(\d+)')
_RE_ENQ_SHORT    = re.compile(r'\benq=(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})')
_RE_ENQ_LONG     = re.compile(r'enqueueClockTime=(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})')
_RE_DISP         = re.compile(r'\bdisp=(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})')
_RE_FIN          = re.compile(r'\bfin=(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})')
_RE_BROADCAST_ID = re.compile(r'BroadcastRecord\{([0-9a-fA-F]+)')
_RE_EXTRAS_ONELINER = re.compile(r'extras:\s*Bundle\[\{(.+)\}\]\s*$')
_RE_EXTRAS_START    = re.compile(r'extras:\s*Bundle\[\{(.*)')   # may be partial/multiline


# ─────────────────────────── DATA MODEL ──────────────────────────────────────

class IntentRecord:
    """One Android broadcast intent, ready for DB insertion."""

    __slots__ = (
        "record_num", "broadcast_id", "action", "target_component",
        "sender_package", "flags", "xflags",
        "enqueue_time", "dispatch_time", "finish_time",
        "extras_raw", "raw_line",
        "_extras_accumulating",      # internal flag during parse
    )

    def __init__(self, record_num: str):
        self.record_num        = record_num          # "#NNN" sequence number
        self.broadcast_id      = None                # hex hash from BroadcastRecord{}
        self.action            = None
        self.target_component  = None
        self.sender_package    = None
        self.flags             = None                # flg=0x…
        self.xflags            = None                # xflg=0x…
        self.enqueue_time      = None                # authentic OS timestamp
        self.dispatch_time     = None
        self.finish_time       = None
        self.extras_raw        = None                # raw extras string (may be huge)
        self.raw_line          = None                # original header line for debug
        self._extras_accumulating = False

    def to_dict(self) -> dict:
        return {
            "record_num":       self.record_num,
            "broadcast_id":     self.broadcast_id,
            "action":           self.action,
            "target_component": self.target_component,
            "sender_package":   self.sender_package,
            "flags":            self.flags,
            "xflags":           self.xflags,
            "enqueue_time":     self.enqueue_time,
            "dispatch_time":    self.dispatch_time,
            "finish_time":      self.finish_time,
            "extras_raw":       self.extras_raw,
        }

    def fingerprint(self) -> str:
        """
        Stable dedup key.
        For live intents: record_num + enqueue_time pins an exact OS event.
        For sticky intents (no OS timestamp): we hash on content so a value
        change in a persistent sticky triggers a new row.
        """
        ts = self.enqueue_time or "sticky"
        return f"{self.record_num}|{self.action}|{self.sender_package}|{ts}|{self.extras_raw}"


# ─────────────────────────── PARSER ──────────────────────────────────────────

def _is_epoch_zero(ts: str) -> bool:
    """1970-01-01 timestamps mean the event hasn't actually dispatched yet."""
    return ts is not None and ts.startswith("1970-01-01")


def parse_dumpsys_broadcasts(raw_text: str) -> list[IntentRecord]:
    """
    Line-by-line state machine parser.

    Record boundaries are '#NNN:' lines.
    Multiline extras are accumulated until the closing '}]' is found.
    """
    records: list[IntentRecord] = []
    current: IntentRecord | None = None
    extras_buf: list[str] = []

    def _flush_extras():
        """Collapse accumulated extras lines into current.extras_raw."""
        if current is not None and extras_buf:
            raw = " ".join(extras_buf).strip()
            # Strip outer Bundle[{ … }] wrapper if present
            inner = re.match(r'^Bundle\[\{(.*)\}\]\s*$', raw, re.DOTALL)
            current.extras_raw = inner.group(1).strip() if inner else raw
            extras_buf.clear()
            current._extras_accumulating = False

    def _commit(rec: IntentRecord):
        """Finalise a completed record and add to results."""
        _flush_extras()
        # Only keep records that carry at least an action or a component
        if rec.action or rec.target_component:
            records.append(rec)

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()

        # ── New record boundary ───────────────────────────────────────────────
        m = _RE_RECORD_NUM.match(line)
        if m:
            if current is not None:
                _commit(current)

            current = IntentRecord(record_num=m.group(1))
            current.raw_line = line
            rest = m.group(2)   # everything after "#NNN: "
            extras_buf.clear()

            # ── Fields that appear on the header line itself ──────────────
            act_m = _RE_ACT.search(rest)
            if act_m:
                current.action = act_m.group(1)

            cmp_m = _RE_CMP.search(rest)
            if cmp_m:
                current.target_component = cmp_m.group(1)

            pkg_m = _RE_PKG.search(rest)
            if pkg_m:
                current.sender_package = pkg_m.group(1)

            flg_m = _RE_FLG.search(rest)
            if flg_m:
                current.flags = flg_m.group(1)

            xflg_m = _RE_XFLG.search(rest)
            if xflg_m:
                current.xflags = xflg_m.group(1)

            # Extras can theoretically start on the same line (rare)
            ext_m = _RE_EXTRAS_ONELINER.search(rest)
            if ext_m:
                current.extras_raw = ext_m.group(1).strip()
            continue

        # ── Skip lines before the first record ───────────────────────────────
        if current is None:
            continue

        # ── Extras multiline accumulation ─────────────────────────────────────
        if current._extras_accumulating:
            extras_buf.append(line)
            # Detect closing marker: line that contains '}]' at the end
            if line.endswith("}]") or line.endswith("]}"):
                _flush_extras()
            continue

        # ── BroadcastRecord hex ID (appears on sub-lines in some sections) ───
        br_m = _RE_BROADCAST_ID.search(line)
        if br_m and current.broadcast_id is None:
            current.broadcast_id = br_m.group(1)

        # ── Timestamps ────────────────────────────────────────────────────────
        if "enq=" in line or "enqueueClockTime" in line:
            ts_m = _RE_ENQ_SHORT.search(line) or _RE_ENQ_LONG.search(line)
            if ts_m:
                ts = ts_m.group(1)
                if not _is_epoch_zero(ts):
                    current.enqueue_time = ts

        if "disp=" in line:
            ts_m = _RE_DISP.search(line)
            if ts_m:
                ts = ts_m.group(1)
                if not _is_epoch_zero(ts):
                    current.dispatch_time = ts

        if "fin=" in line:
            ts_m = _RE_FIN.search(line)
            if ts_m:
                ts = ts_m.group(1)
                if not _is_epoch_zero(ts):
                    current.finish_time = ts

        # ── Action / component / flags (may appear again on sub-lines) ────────
        if "act=" in line and current.action is None:
            act_m = _RE_ACT.search(line)
            if act_m:
                current.action = act_m.group(1)

        if "cmp=" in line and current.target_component is None:
            cmp_m = _RE_CMP.search(line)
            if cmp_m:
                current.target_component = cmp_m.group(1)

        if "pkg=" in line and current.sender_package is None:
            pkg_m = _RE_PKG.search(line)
            if pkg_m:
                current.sender_package = pkg_m.group(1)

        if "flg=" in line and current.flags is None:
            flg_m = _RE_FLG.search(line)
            if flg_m:
                current.flags = flg_m.group(1)

        if "xflg=" in line and current.xflags is None:
            xflg_m = _RE_XFLG.search(line)
            if xflg_m:
                current.xflags = xflg_m.group(1)

        # ── Sender (caller= wins; originalCallingUid= is fallback) ───────────
        if "caller=" in line and current.sender_package is None:
            cal_m = _RE_CALLER.search(line)
            if cal_m:
                current.sender_package = cal_m.group(1)

        elif "originalCallingUid:" in line and current.sender_package is None:
            uid_m = _RE_ORIG_UID.search(line)
            if uid_m:
                uid = uid_m.group(1)
                current.sender_package = (
                    f"system_server (UID {uid})" if uid == "1000" else f"UID:{uid}"
                )

        # ── Extras (start detection) ──────────────────────────────────────────
        if "extras:" in line and current.extras_raw is None:
            # Try one-liner first
            one_m = _RE_EXTRAS_ONELINER.search(line)
            if one_m:
                current.extras_raw = one_m.group(1).strip()
            else:
                # Start multiline accumulation
                start_m = _RE_EXTRAS_START.search(line)
                if start_m:
                    fragment = start_m.group(1).strip()
                    current._extras_accumulating = True
                    extras_buf.clear()
                    if fragment:
                        extras_buf.append(fragment)
                    # Check if it also closes on the same line
                    if fragment.endswith("}]") or fragment.endswith("]}"):
                        _flush_extras()

    # Commit last open record
    if current is not None:
        _commit(current)

    return records


# ─────────────────────────── DATABASE ────────────────────────────────────────

DDL = [
    # ── intents ──────────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS intents (
        id               BIGINT       NOT NULL AUTO_INCREMENT,
        record_num       VARCHAR(16)  NOT NULL COMMENT '#NNN sequence from dumpsys',
        broadcast_id     VARCHAR(16)  NULL     COMMENT 'BroadcastRecord hex hash',
        action           VARCHAR(512) NULL,
        target_component VARCHAR(512) NULL,
        sender_package   VARCHAR(512) NULL,
        flags            VARCHAR(32)  NULL     COMMENT 'flg= hex value',
        xflags           VARCHAR(32)  NULL     COMMENT 'xflg= hex value',
        enqueue_time     DATETIME(3)  NULL     COMMENT 'OS enqueue timestamp',
        dispatch_time    DATETIME(3)  NULL,
        finish_time      DATETIME(3)  NULL,
        extras_raw       MEDIUMTEXT   NULL,
        poll_time        DATETIME(3)  NOT NULL COMMENT 'When this row was inserted',
        fingerprint      VARCHAR(128) NOT NULL COMMENT 'SHA dedup key',
        PRIMARY KEY (id),
        UNIQUE KEY uq_fingerprint (fingerprint(128)),
        INDEX idx_action        (action(128)),
        INDEX idx_sender        (sender_package(128)),
        INDEX idx_enqueue_time  (enqueue_time),
        INDEX idx_record_num    (record_num)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Android broadcast intents'
    """,

    # ── chains ────────────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chains (
        id          BIGINT        NOT NULL AUTO_INCREMENT,
        name        VARCHAR(255)  NOT NULL,
        description TEXT          NULL,
        created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_chain_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Researcher-defined intent chains'
    """,

    # ── intents_chains ────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS intents_chains (
        id         BIGINT        NOT NULL AUTO_INCREMENT,
        intent_id  BIGINT        NOT NULL,
        chain_id   BIGINT        NOT NULL,
        position   INT           NOT NULL COMMENT 'Order of this intent within the chain',
        label      VARCHAR(255)  NULL     COMMENT 'Researcher annotation for this step',
        added_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_chain_position (chain_id, position),
        CONSTRAINT fk_ic_intent FOREIGN KEY (intent_id) REFERENCES intents (id) ON DELETE CASCADE,
        CONSTRAINT fk_ic_chain  FOREIGN KEY (chain_id)  REFERENCES chains  (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Intent membership in chains'
    """,
]


def _connect() -> mysql.connector.MySQLConnection:
    """Open a connection, creating the database if it doesn't exist yet."""
    # First connect without specifying a DB so we can CREATE it
    conn = mysql.connector.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD,
        autocommit=True,
    )
    cur = conn.cursor()
    cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    cur.close()
    conn.close()

    # Now connect to the database
    conn = mysql.connector.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, autocommit=False,
    )
    return conn


def ensure_schema(conn):
    cur = conn.cursor()
    for ddl in DDL:
        cur.execute(ddl)
    conn.commit()
    cur.close()


def _make_fingerprint(rec: IntentRecord) -> str:
    """Truncated SHA-1 so the UNIQUE KEY never exceeds 128 chars."""
    import hashlib
    return hashlib.sha1(rec.fingerprint().encode("utf-8", errors="replace")).hexdigest()[:64]


def _parse_dt(ts: str | None):
    """Convert 'YYYY-MM-DD HH:MM:SS' → datetime, or None."""
    if not ts:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts.strip(), fmt)
        except ValueError:
            continue
    return None


INSERT_INTENT = """
    INSERT IGNORE INTO intents
        (record_num, broadcast_id, action, target_component, sender_package,
         flags, xflags, enqueue_time, dispatch_time, finish_time,
         extras_raw, poll_time, fingerprint)
    VALUES
        (%s, %s, %s, %s, %s,
         %s, %s, %s, %s, %s,
         %s, %s, %s)
"""


def insert_intents(conn, records: list[IntentRecord]) -> int:
    """
    Bulk-insert records, skipping duplicates via INSERT IGNORE + UNIQUE fingerprint.
    Returns the number of rows actually inserted.
    """
    if not records:
        return 0

    now = datetime.now()
    rows = []
    for rec in records:
        fp = _make_fingerprint(rec)
        extras = rec.extras_raw
        # MySQL MEDIUMTEXT cap is ~16 MB; cap at 1 MB to be safe
        if extras and len(extras) > 1_000_000:
            extras = extras[:1_000_000] + "…[TRUNCATED]"
        rows.append((
            rec.record_num,
            rec.broadcast_id,
            rec.action,
            rec.target_component,
            rec.sender_package,
            rec.flags,
            rec.xflags,
            _parse_dt(rec.enqueue_time),
            _parse_dt(rec.dispatch_time),
            _parse_dt(rec.finish_time),
            extras,
            now,
            fp,
        ))

    cur = conn.cursor()
    cur.executemany(INSERT_INTENT, rows)
    inserted = cur.rowcount
    conn.commit()
    cur.close()
    return inserted


# ─────────────────────────── ADB HELPERS ─────────────────────────────────────

def check_adb_connection() -> bool:
    try:
        result = subprocess.run(
            ["adb", "devices"], capture_output=True, text=True, check=True
        )
        lines = [l for l in result.stdout.strip().splitlines()[1:] if l.strip()]
        if not lines:
            print("[!] No active ADB devices. Boot your emulator or attach a device.")
            return False
        return True
    except FileNotFoundError:
        print("[!] 'adb' not found in PATH.")
        return False


def _dumpsys() -> str | None:
    result = subprocess.run(
        ["adb", "shell", "dumpsys", "activity", "broadcasts"],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        return result.stdout
    print(f"[!] dumpsys failed: {result.stderr.strip()}")
    return None


# ─────────────────────────── MAIN LOOP ───────────────────────────────────────

def poll(interval_ms: int = 500):
    if not check_adb_connection():
        sys.exit(1)

    print("[*] Connecting to MySQL …")
    try:
        conn = _connect()
        ensure_schema(conn)
    except MySQLError as e:
        print(f"[!] MySQL connection failed: {e}")
        print(f"    Make sure MySQL is running and DB_* constants are correct.")
        sys.exit(1)

    print(f"[*] Schema ready. DB={DB_NAME} on {DB_HOST}:{DB_PORT}")
    print(f"[*] Polling every {interval_ms} ms. Ctrl-C to stop.\n" + "=" * 70)

    # ── Priming pass: load current state so we don't flood the DB on boot ─────
    seen: set[str] = set()
    raw = _dumpsys()
    if raw:
        for rec in parse_dumpsys_broadcasts(raw):
            seen.add(_make_fingerprint(rec))
        print(f"[*] Baseline captured ({len(seen)} existing intents). Listening …\n")
    else:
        print("[!] Priming failed — continuing anyway.\n")

    interval = interval_ms / 1000.0

    try:
        while True:
            raw = _dumpsys()
            if raw:
                all_records  = parse_dumpsys_broadcasts(raw)
                new_records  = [r for r in all_records if _make_fingerprint(r) not in seen]

                if new_records:
                    inserted = insert_intents(conn, new_records)

                    for rec in new_records:
                        seen.add(_make_fingerprint(rec))
                        # Print compact summary to stdout
                        print(json.dumps(rec.to_dict(), indent=2, default=str))
                        print("-" * 50, flush=True)

                    if inserted < len(new_records):
                        dupes = len(new_records) - inserted
                        print(f"[~] {inserted} inserted, {dupes} duplicate(s) skipped by DB.")

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n[*] Stopped.")
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ─────────────────────────── ENTRY POINT ─────────────────────────────────────

if __name__ == "__main__":
    poll(interval_ms=500)