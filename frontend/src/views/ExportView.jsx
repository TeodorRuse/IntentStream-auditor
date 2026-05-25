import React, { useState } from 'react'
import { Download, FileJson, FileText } from 'lucide-react'
import { useStore } from '../store'
import { Chains } from '../lib/api'
import { useToast } from '../components/Toast'

const FEED_COLUMNS = [
  { key: 'id',                label: 'id' },
  { key: 'record_num',        label: 'record_num' },
  { key: 'action',            label: 'action' },
  { key: 'sender_package',    label: 'sender_package' },
  { key: 'target_component',  label: 'target_component' },
  { key: 'flags',             label: 'flags' },
  { key: 'xflags',            label: 'xflags' },
  { key: 'enqueue_time',      label: 'enqueue_time' },
  { key: 'dispatch_time',     label: 'dispatch_time' },
  { key: 'finish_time',       label: 'finish_time' },
  { key: 'poll_time',         label: 'poll_time' },
  { key: 'broadcast_id',      label: 'broadcast_id' },
  { key: 'extras_raw',        label: 'extras_raw' },
]

export default function ExportView() {
  const intents = useStore(s => s.intents)
  const chains  = useStore(s => s.chains)
  const toast   = useToast()

  const [includeExtras, setIncludeExtras] = useState(false)
  const [exporting, setExporting]         = useState(false)

  const exportFeed = (format) => {
    const cols = FEED_COLUMNS.filter(c => includeExtras || c.key !== 'extras_raw')
    if (format === 'csv') {
      const csv = toCSV(intents, cols)
      downloadBlob(csv, `intentstream-feed-${stamp()}.csv`, 'text/csv')
    } else {
      const subset = intents.map(i => Object.fromEntries(cols.map(c => [c.key, i[c.key] ?? null])))
      downloadBlob(JSON.stringify(subset, null, 2), `intentstream-feed-${stamp()}.json`, 'application/json')
    }
    toast.success(`Exported ${intents.length} intents as ${format.toUpperCase()}`)
  }

  const exportChain = async (chain, format) => {
    setExporting(true)
    try {
      const members = await Chains.members(chain.id)
      if (format === 'json') {
        const payload = {
          chain: { id: chain.id, name: chain.name, description: chain.description, created_at: chain.created_at },
          members,
        }
        downloadBlob(JSON.stringify(payload, null, 2), `chain-${chain.id}-${slug(chain.name)}.json`, 'application/json')
      } else {
        const cols = [
          { key: 'position', label: 'position' },
          { key: 'label',    label: 'label' },
          { key: 'intent_id',label: 'intent_id' },
          { key: 'action',   label: 'action' },
          { key: 'sender_package', label: 'sender_package' },
          { key: 'target_component', label: 'target_component' },
          { key: 'enqueue_time', label: 'enqueue_time' },
        ]
        const csv = toCSV(members, cols)
        downloadBlob(csv, `chain-${chain.id}-${slug(chain.name)}.csv`, 'text/csv')
      }
      toast.success(`Exported chain "${chain.name}"`)
    } catch (err) {
      toast.error(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const exportAllChains = async (format) => {
    setExporting(true)
    try {
      const all = []
      for (const c of chains) {
        const members = await Chains.members(c.id).catch(() => [])
        all.push({ ...c, members })
      }
      if (format === 'json') {
        downloadBlob(JSON.stringify(all, null, 2), `intentstream-chains-${stamp()}.json`, 'application/json')
      } else {
        // Flat CSV: one row per member, with chain metadata duplicated
        const rows = []
        for (const c of all) {
          for (const m of c.members) {
            rows.push({
              chain_id: c.id, chain_name: c.name,
              position: m.position, label: m.label,
              intent_id: m.intent_id, action: m.action,
              sender_package: m.sender_package,
              target_component: m.target_component,
              enqueue_time: m.enqueue_time,
            })
          }
        }
        const cols = Object.keys(rows[0] || {}).map(k => ({ key: k, label: k }))
        downloadBlob(toCSV(rows, cols), `intentstream-chains-${stamp()}.csv`, 'text/csv')
      }
      toast.success(`Exported ${all.length} chains`)
    } catch (err) {
      toast.error(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 28, background: 'var(--bg)' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 26,
        color: 'var(--pink)',
        textShadow: '2px 2px 0 var(--teal-dim), 0 0 16px rgba(255,61,143,0.4)',
        letterSpacing: '0.04em',
        fontWeight: 400,
        marginBottom: 6,
      }}>EXPORT</h1>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-dim)', marginBottom: 24 }}>
        Download captured data as CSV or JSON for offline analysis.
      </div>

      {/* Feed */}
      <section style={cardStyle}>
        <div style={cardHeader}>FEED EXPORT</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-dim)', marginBottom: 14 }}>
          The {intents.length.toLocaleString()} intents currently in memory will be exported. To export the full history, use the Search view to fetch a date range first.
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-dim)',
          marginBottom: 14, cursor: 'pointer', userSelect: 'none',
        }}>
          <input type="checkbox" checked={includeExtras}
            onChange={e => setIncludeExtras(e.target.checked)}
            style={{ accentColor: 'var(--pink)' }} />
          include extras_raw column (much larger files)
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => exportFeed('csv')} disabled={intents.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={12} strokeWidth={2} />
            EXPORT CSV
          </button>
          <button onClick={() => exportFeed('json')} disabled={intents.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileJson size={12} strokeWidth={2} />
            EXPORT JSON
          </button>
        </div>
      </section>

      {/* Chains */}
      <section style={cardStyle}>
        <div style={cardHeader}>CHAINS EXPORT</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-dim)', marginBottom: 14 }}>
          Export individual chains with their full member list, or dump all {chains.length} chains in one file.
        </div>

        {chains.length === 0 ? (
          <div style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', fontSize: 11, fontStyle: 'italic' }}>
            No chains yet.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <button onClick={() => exportAllChains('csv')} disabled={exporting}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={12} strokeWidth={2} />
                ALL CHAINS · CSV
              </button>
              <button onClick={() => exportAllChains('json')} disabled={exporting}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={12} strokeWidth={2} />
                ALL CHAINS · JSON
              </button>
            </div>

            <div style={{
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-2)',
            }}>
              {chains.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '8px 12px',
                  borderBottom: '1px dotted var(--line)',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 10,
                    color: 'var(--orange)', minWidth: 44,
                  }}>#{c.id}</span>
                  <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </span>
                  <button onClick={() => exportChain(c, 'csv')} disabled={exporting}
                    style={{ fontSize: 9, padding: '3px 8px', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
                    CSV
                  </button>
                  <button onClick={() => exportChain(c, 'json')} disabled={exporting}
                    style={{ fontSize: 9, padding: '3px 8px', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
                    JSON
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

const cardStyle = {
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
  padding: 18,
  marginBottom: 18,
  maxWidth: 760,
}
const cardHeader = {
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  color: 'var(--orange)',
  textShadow: 'var(--glow-orange)',
  letterSpacing: '0.06em',
  marginBottom: 10,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toCSV(rows, cols) {
  const escape = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const header = cols.map(c => c.label).join(',')
  const body = rows.map(r => cols.map(c => escape(r[c.key])).join(',')).join('\n')
  return header + '\n' + body
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function stamp() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '_',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join('')
}

function slug(name) {
  return (name || 'chain').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}
