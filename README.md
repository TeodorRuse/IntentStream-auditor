# IntentStream — Android Broadcast Intent Auditor

## Project structure

```
IntentStream/
├── docker-compose.yml          ← runs DB + backend
├── mysql/
│   └── init.sql                ← schema, auto-runs on first DB boot
├── backend/
│   ├── backend.py
│   ├── Dockerfile
│   └── requirements.txt
└── adb_poller/
    ├── adb_poller              ← standalone Linux x86-64 ELF executable
    └── adb_poller.py           ← source (rebuild with pyinstaller if needed)
```

## How it works

The poller runs **natively on your host** (no Docker), so it talks to ADB
directly without any TCP forwarding. The DB and REST backend run in Docker.

```
Host machine
  ├─ adb_poller (ELF)  ──────────► ADB server ──► USB / emulator
  │       │
  │       └── writes intents ──► MySQL :3306 (Docker)
  │
  └─ browser / curl    ──────────► backend :8000 (Docker)
```

## Prerequisites

| Tool | Notes |
|------|-------|
| Docker + Docker Compose v2.20+ | for DB and backend |
| ADB | must be in PATH; install via `android-tools-adb` or Android SDK |
| Linux x86-64 | the pre-built `adb_poller` binary targets this platform |

## First-time setup

### 1 — Start Docker services

```bash
docker compose up -d
```

On first run MySQL executes `mysql/init.sql` and creates all three tables
(`intents`, `chains`, `intents_chains`) automatically. Subsequent starts
reuse the `db_data` volume, so your data is safe.

### 2 — Connect your device or emulator

```bash
adb devices
# Should show something like:
# emulator-5554   device
```

If you see `unauthorized`, unlock the device and tap **Allow** on the
USB debugging prompt.

### 3 — Run the poller

```bash
cd adb_poller
chmod +x adb_poller
./adb_poller
```

Default DB credentials match `docker-compose.yml`. Override anything via flags:

```bash
./adb_poller --help

./adb_poller --db-password mypassword

# Target a specific device when multiple are connected
./adb_poller --device emulator-5554

# Faster polling
./adb_poller --interval-ms 250

# All options together
./adb_poller --db-host 127.0.0.1 --db-port 3306 \
             --db-user auditor --db-password intentaudit \
             --db-name intent_audit \
             --interval-ms 500 \
             --device emulator-5554
```

## Common Docker commands

```bash
# Start in background
docker compose up -d

# Watch backend logs
docker compose logs -f backend

# Stop everything (data preserved in volume)
docker compose down

# Wipe all data and start fresh
docker compose down -v

# Rebuild backend after code changes
docker compose up -d --build backend
```

## API

Backend available at **http://localhost:8000** once Docker is running.

| URL | Description |
|-----|-------------|
| http://localhost:8000/docs | Swagger UI — interactive, try endpoints live |
| http://localhost:8000/redoc | ReDoc — readable reference |
| http://localhost:8000/health | DB connectivity check |

### Endpoints

```
# Intents
GET  /intents                              paginated list (no extras for speed)
GET  /intents/{id}                         single intent with full extras_raw
GET  /intents/stream/{since_id}            SSE stream — push new intents as they arrive
GET  /intents/search/action?q=             substring match on action name
GET  /intents/search/package?q=            substring match on sender package
GET  /intents/search/component?q=          substring match on target component
GET  /intents/search/extras?q=             search inside extras_raw content
GET  /intents/search/date?from_dt=&to_dt=  filter by enqueue_time range (ISO 8601)
GET  /intents/search/flags?flags=          exact match on flag value (e.g. 0x60000010)
GET  /intents/stats/actions                top N action types by count
GET  /intents/stats/senders                top N senders by count

# Chains
GET    /chains                             list all chains
GET    /chains/{id}                        get one chain
POST   /chains                             create chain  { name, description }
PATCH  /chains/{id}                        update name or description
DELETE /chains/{id}                        delete chain + cascade members

# Chain members
GET    /chains/{id}/intents                members ordered by position
POST   /chains/{id}/intents                add intent  { intent_id, position, label }
PATCH  /chains/{id}/intents/{member_id}    update position or label
DELETE /chains/{id}/intents/{member_id}    remove member
```

### SSE stream example

```bash
# Stream all intents from the beginning
curl -N http://localhost:8000/intents/stream/0

# Resume from last seen id (e.g. 142)
curl -N http://localhost:8000/intents/stream/142

# Include extras_raw in each event
curl -N "http://localhost:8000/intents/stream/0?include_extras=true"
```

Each event is a JSON object. Track the highest `id` you receive and reconnect
with that value to resume without replaying old data.

## MySQL direct access

```bash
mysql -h 127.0.0.1 -P 3306 -u auditor -pintentaudit intent_audit
```

Or any GUI client (DBeaver, TablePlus, DataGrip) with the same credentials.

## Rebuilding the poller binary

If you need to rebuild for a different machine or after editing `adb_poller.py`:

```bash
pip install pyinstaller mysql-connector-python
cd adb_poller
pyinstaller --onefile --name adb_poller \
  --collect-all mysql.connector \
  adb_poller.py
# output → adb_poller/dist/adb_poller
```

## Troubleshooting

**Poller: "No ADB devices found"**
→ Run `adb devices` on the host to confirm the device is visible. Check USB
debugging is enabled and the "Allow" prompt has been accepted on the device.

**Poller: "Could not connect to MySQL"**
→ Make sure Docker is running (`docker compose up -d`) and wait ~10 s for
MySQL to finish initialising before starting the poller.

**Backend returns 500 on `/intents`**
→ Check `docker logs intent-backend`. Usually a DB connection issue on startup;
`docker compose restart backend` after the DB is healthy fixes it.

**`adb devices` shows `unauthorized`**
→ Unlock your device and tap **Allow** on the USB debugging prompt.