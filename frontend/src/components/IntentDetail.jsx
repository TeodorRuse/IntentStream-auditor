import React, { useEffect } from 'react'
import { X } from 'lucide-react'

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(10, 5, 25, 0.78)',
    backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'fade-in 160ms ease-out',
  },
  modal: {
    background: 'var(--bg-2)',
    border: '1px solid var(--line-2)',
    boxShadow:
      '0 0 0 1px rgba(255,61,143,0.15), 0 20px 60px rgba(0,0,0,0.7), var(--glow-pink-sm)',
    borderRadius: 'var(--radius-md)',
    width: 'min(720px, 90vw)',
    maxHeight: '82vh',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--line)',
    background: 'var(--paper)',
    gap: 8,
  },
  title: {
    fontFamily: 'var(--font-display)',
    color: 'var(--pink)',
    fontSize: 13,
    letterSpacing: '0.06em',
    textShadow: '1px 1px 0 var(--teal-dim), var(--text-glow-pink)',
  },
  close: {
    background: 'none', border: '1px solid var(--line)',
    color: 'var(--ink-dim)',
    width: 26, height: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    padding: 0,
  },
  body: { overflowY: 'auto', padding: '14px 16px' },
  row: {
    display: 'grid',
    gridTemplateColumns: '170px 1fr',
    gap: '6px 14px',
    marginBottom: 6,
    paddingBottom: 7,
    borderBottom: '1px dotted var(--line)',
  },
  label: {
    fontFamily: 'var(--font-display)',
    color: 'var(--ink-faint)',
    fontSize: 9,
    letterSpacing: '0.05em',
    paddingTop: 2,
  },
  value: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--ink)',
    fontSize: 11,
    wordBreak: 'break-all',
  },
  extras: {
    marginTop: 14,
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
  },
  extrasTitle: {
    fontFamily: 'var(--font-display)',
    color: 'var(--orange)',
    fontSize: 10,
    letterSpacing: '0.06em',
    marginBottom: 8,
    textShadow: 'var(--glow-orange)',
  },
  extrasItem: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    gap: 12,
    padding: '4px 0',
    fontSize: 11,
    borderBottom: '1px dotted var(--line-dim)',
  },
  extrasKey: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--teal)',
    wordBreak: 'break-all',
    textShadow: 'var(--text-glow-teal)',
    opacity: 0.95,
  },
  extrasVal: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--ink-dim)',
    wordBreak: 'break-all',
  },
}

function parseExtras(raw) {
  if (!raw) return []
  const items = []
  let depth = 0, start = 0
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') depth++
    else if (raw[i] === '}') depth--
    else if (raw[i] === ',' && depth === 0) {
      items.push(raw.slice(start, i).trim())
      start = i + 1
    }
  }
  items.push(raw.slice(start).trim())
  return items.filter(Boolean).map(item => {
    const eq = item.indexOf('=')
    if (eq === -1) return { key: item, val: '' }
    return { key: item.slice(0, eq).trim(), val: item.slice(eq + 1).trim() }
  })
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{value}</span>
    </div>
  )
}

export default function IntentDetail({ intent, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!intent) return null
  const extras = parseExtras(intent.extras_raw)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>INTENT.{String(intent.id).padStart(4, '0')}</span>
          <button style={styles.close} onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div style={styles.body}>
          <Field label="ACTION"           value={intent.action} />
          <Field label="TARGET COMPONENT" value={intent.target_component} />
          <Field label="SENDER PACKAGE"   value={intent.sender_package} />
          <Field label="FLAGS"            value={intent.flags} />
          <Field label="XFLAGS"           value={intent.xflags} />
          <Field label="ENQUEUE TIME"     value={intent.enqueue_time} />
          <Field label="DISPATCH TIME"    value={intent.dispatch_time} />
          <Field label="FINISH TIME"      value={intent.finish_time} />
          <Field label="BROADCAST ID"     value={intent.broadcast_id} />
          <Field label="RECORD #"         value={intent.record_num} />
          <Field label="POLL TIME"        value={intent.poll_time} />

          {extras.length > 0 && (
            <div style={styles.extras}>
              <div style={styles.extrasTitle}>EXTRAS ({extras.length})</div>
              {extras.map(({ key, val }, i) => (
                <div key={i} style={{ ...styles.extrasItem,
                  borderBottom: i === extras.length - 1 ? '0' : '1px dotted var(--line-dim)' }}>
                  <span style={styles.extrasKey}>{key}</span>
                  <span style={styles.extrasVal}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
