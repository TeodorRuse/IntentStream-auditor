/**
 * IntentStream API client
 * =======================
 * All backend calls live here. Components import named functions
 * — never construct URLs themselves.
 *
 * In production (nginx) requests go to relative paths.
 * In dev (vite), the proxy in vite.config.js forwards them to the backend.
 */

const BASE = import.meta.env.VITE_API_URL || ''

// ── Low-level helpers ───────────────────────────────────────────────────────

async function jget(path, params) {
  const url = new URL(BASE + path, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.pathname + url.search)
  if (!res.ok) throw new ApiError(res.status, await safeText(res))
  return res.json()
}

async function jsend(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new ApiError(res.status, await safeText(res))
  // 204 No Content — return nothing
  if (res.status === 204) return null
  return res.json()
}

async function safeText(res) {
  try { return await res.text() } catch { return res.statusText }
}

export class ApiError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${body}`)
    this.status = status
    this.body   = body
  }
}

// ── INTENTS ─────────────────────────────────────────────────────────────────

export const Intents = {
  list:        (offset = 0, limit = 50) => jget('/intents', { offset, limit }),
  get:         (id)                     => jget(`/intents/${id}`),
  // Streaming uses EventSource elsewhere — we just expose the URL builder
  streamUrl:   (sinceId, includeExtras = false) =>
    `${BASE}/intents/stream/${sinceId}?include_extras=${includeExtras}`,

  // Searches
  searchByAction:    (q, opts = {}) => jget('/intents/search/action',    { q, ...opts }),
  searchByPackage:   (q, opts = {}) => jget('/intents/search/package',   { q, ...opts }),
  searchByComponent: (q, opts = {}) => jget('/intents/search/component', { q, ...opts }),
  searchByExtras:    (q, opts = {}) => jget('/intents/search/extras',    { q, ...opts }),
  searchByDate:      (from_dt, to_dt, opts = {}) =>
    jget('/intents/search/date', { from_dt, to_dt, ...opts }),
  searchByFlags:     (flags, opts = {}) => jget('/intents/search/flags', { flags, ...opts }),

  // Stats
  statsActions: (limit = 20) => jget('/intents/stats/actions', { limit }),
  statsSenders: (limit = 20) => jget('/intents/stats/senders', { limit }),
}

// ── CHAINS ──────────────────────────────────────────────────────────────────

export const Chains = {
  list:    ()             => jget('/chains'),
  get:     (id)           => jget(`/chains/${id}`),
  create:  (name, description = '') =>
    jsend('POST',  '/chains', { name, description }),
  update:  (id, patch)    => jsend('PATCH',  `/chains/${id}`, patch),
  remove:  (id)           => jsend('DELETE', `/chains/${id}`),

  // Membership
  members: (id)           => jget(`/chains/${id}/intents`),
  addIntent: (chainId, intentId, position, label = '') =>
    jsend('POST', `/chains/${chainId}/intents`, {
      intent_id: intentId, position, label,
    }),
  removeMember: (chainId, memberId) =>
    jsend('DELETE', `/chains/${chainId}/intents/${memberId}`),
  updateMember: (chainId, memberId, params) => {
    // PATCH uses query params (FastAPI Query() on the backend)
    const url = new URL(
      `${BASE}/chains/${chainId}/intents/${memberId}`,
      window.location.origin
    )
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v)
    }
    return fetch(url.pathname + url.search, { method: 'PATCH' })
      .then(async r => {
        if (!r.ok) throw new ApiError(r.status, await safeText(r))
        return r.json()
      })
  },
}

// ── META ────────────────────────────────────────────────────────────────────

export const Meta = {
  health: () => jget('/health'),
  root:   () => jget('/'),
}
