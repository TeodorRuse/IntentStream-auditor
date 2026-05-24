/**
 * Groups intents by their enqueue_time second (HH:MM:SS).
 * Returns a map of intentId → 'pink' | 'gray'
 * Groups alternate: first group pink, next gray, next pink, …
 *
 * Used to give the feed a visual "rhythm" — bursts of intents in
 * the same second share a band color so the eye can chunk them.
 */
export function buildColorBands(intents) {
  const bands = {}
  if (!intents.length) return bands

  let groupIndex = 0
  let prevSecond = null

  for (const intent of intents) {
    const ts = intent.enqueue_time || intent.poll_time || ''
    const second = ts ? ts.slice(0, 19) : 'unknown'

    if (second !== prevSecond) {
      if (prevSecond !== null) groupIndex++
      prevSecond = second
    }

    bands[intent.id] = groupIndex % 2 === 0 ? 'pink' : 'gray'
  }

  return bands
}

/**
 * Determine if a sender_package looks like a system package.
 */
export function isSystemIntent(intent) {
  const pkg = intent.sender_package || ''
  if (!pkg || pkg.startsWith('system_server') || pkg.startsWith('UID:')) return true
  if (pkg.startsWith('com.android') || pkg.startsWith('android')) return true
  return false
}

export function formatTime(ts) {
  if (!ts) return '--:--:--'
  const t = ts.replace('T', ' ')
  return t.slice(11, 19) // HH:MM:SS
}

export function formatTimeMs(ts) {
  if (!ts) return '--:--:--.---'
  const t = ts.replace('T', ' ')
  return t.slice(11, 23) // HH:MM:SS.mmm
}

export function formatDateShort(ts) {
  if (!ts) return ''
  const d = new Date(ts.replace(' ', 'T'))
  if (isNaN(d)) return ts.slice(0, 10)
  const month = d.toLocaleString('en', { month: 'short' }).toUpperCase()
  return `${String(d.getDate()).padStart(2,'0')}.${month}`
}

export function shortAction(action) {
  if (!action) return '(no action)'
  return action
    .replace('android.intent.action.', '')
    .replace('android.net.', '')
    .replace('android.os.', '')
    .replace('android.media.', '')
    .replace('com.android.', '')
    .replace('android.telephony.', '')
}

/**
 * Compute time delta between two ISO timestamps (or backend format).
 * Returns a short human string like "+120ms" or "+1.2s".
 */
export function formatDelta(fromTs, toTs) {
  if (!fromTs || !toTs) return ''
  const from = new Date(fromTs.replace(' ', 'T'))
  const to   = new Date(toTs.replace(' ', 'T'))
  if (isNaN(from) || isNaN(to)) return ''
  const diff = to - from
  if (diff === 0)        return '0ms'
  if (Math.abs(diff) < 1000)   return `${diff > 0 ? '+' : ''}${diff}ms`
  if (Math.abs(diff) < 60_000) return `${diff > 0 ? '+' : ''}${(diff / 1000).toFixed(2)}s`
  return `${diff > 0 ? '+' : ''}${Math.round(diff / 1000)}s`
}
