# IntentStream Frontend

Ocean Drive UI (Silkscreen + Miami palette) for the IntentStream broadcast-intent auditor.

## What's inside

- **Live view** — streaming feed of intents from the backend's SSE endpoint, with filter, color bands, ID badges and a board canvas on the right
- **Board view** — full-canvas drag-and-drop wiring with pan/zoom, persistent in localStorage, supports loading saved chains
- **Chains view** — sidebar of saved chains, detail panel with ordered steps, drag-to-reorder, inline edit, delta times, delete cascade
- **Stats view** — Recharts bar charts for top actions / top senders (backend), donut for system vs 3rd party, hourly histogram (in-memory)
- **Search view** — full backend search by action, package, component, extras, flags, date range. Results have "Add to Board" button
- **Export view** — CSV / JSON download for feed and individual or all chains
- **Settings** — toggles for scanlines, glow intensity, density, auto-scroll, plus system status and keyboard shortcuts reference
- **Command palette** (⌘K / Ctrl+K) — navigation + actions + chains in one searchable list
- **Toast notifications** — feedback for all async actions

## Prerequisites

- **Node.js 20+** and **npm**
- Backend running on `127.0.0.1:8000` (or set `VITE_BACKEND`)

## Running locally (dev with hot-reload)

```bash
# 1. Make sure backend + db are running (use docker compose from project root)
docker compose up -d db backend

# 2. Install + run frontend in dev mode
cd frontend
npm install
npm run dev
# → http://127.0.0.1:5173
```

The Vite dev server proxies `/intents`, `/chains`, and `/health` to the backend.
Override the backend URL by setting `VITE_BACKEND`:

```bash
VITE_BACKEND=http://localhost:9000 npm run dev
```

## Running in Docker (production)

```bash
# From project root
docker compose up -d
# → http://127.0.0.1:3000
```

The Dockerfile builds with Vite and serves the static dist via nginx, which proxies API
calls to the `backend` service.

## Keyboard shortcuts

| Keys                    | Action                          |
|-------------------------|---------------------------------|
| ⌘/Ctrl + K              | Open command palette            |
| ⌘/Ctrl + 1..5           | Jump to Live/Board/Chains/Stats/Search |
| ⌘/Ctrl + F              | Focus feed filter               |
| Esc                     | Close modal / cancel edit       |

## Architecture

- **`src/lib/api.js`** — every backend call is here. Components import named functions.
- **`src/store/index.js`** — Zustand store for intents, chains, board, IPS history. Board persists to localStorage.
- **`src/hooks/`** — `useIntentStream` (SSE + initial fetch), `useChainsBootstrap` (load chains once).
- **`src/components/`** — `Sidebar`, `StatsBar`, `IntentCard`, `IntentPanel`, `IntentDetail`, `Board`, `Modal`, `Toast`, `CommandPalette`.
- **`src/views/`** — one folder/file per route. `chains/` is split into its own subfolder.
- **`src/index.css`** — design tokens (CSS variables) + global styles. Override here.

## Customizing the look

Most of the design lives in CSS variables in `src/index.css`. Change `--pink`, `--teal`,
`--orange`, `--bg`, etc., and the entire UI rethemes. The Settings view exposes runtime
toggles for scanlines and glow intensity.

## Tech stack

- React 18 + Vite 6
- React Router 6
- Zustand
- Recharts (charts)
- Lucide React (icons)
- date-fns (utilities)
- @xyflow/react (kept in deps, not used directly — Board has its own canvas)

## Known limitations / future work

- The feed only keeps intents in memory while the tab is open. For historical search,
  use the Search view (hits the backend directly).
- Board node positions persist, but the underlying intent might fall out of the in-memory
  feed and show as "not in current feed" — fetching missing intents from `/intents/{id}`
  is done automatically when loading a chain.
