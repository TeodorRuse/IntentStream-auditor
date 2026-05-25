import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { Meta } from '../lib/api'

const PREFS_KEY = 'intentstream:prefs'

const DEFAULTS = {
  scanlines: true,
  glowIntensity: 'normal', // 'subtle' | 'normal' | 'intense'
  density: 'comfortable',  // 'compact' | 'comfortable' | 'spacious'
  autoScroll: true,
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { return { ...DEFAULTS } }
}

export function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
  applyPrefsToDom(prefs)
}

export function applyPrefsToDom(prefs) {
  const root = document.documentElement
  // Scanlines
  if (prefs.scanlines) root.style.removeProperty('--scanlines-display')
  else root.style.setProperty('--scanlines-display', 'none')
  // Glow intensity
  const intensities = {
    subtle:  { pink: '0 0 4px rgba(255,61,143,0.4)', teal: '0 0 4px rgba(0,229,255,0.35)' },
    normal:  { pink: '0 0 8px rgba(255,61,143,0.6)', teal: '0 0 8px rgba(0,229,255,0.55)' },
    intense: { pink: '0 0 14px rgba(255,61,143,0.85), 0 0 28px rgba(255,61,143,0.4)',
               teal: '0 0 14px rgba(0,229,255,0.75), 0 0 28px rgba(0,229,255,0.35)' },
  }
  const t = intensities[prefs.glowIntensity] || intensities.normal
  root.style.setProperty('--text-glow-pink', t.pink)
  root.style.setProperty('--text-glow-teal', t.teal)
}

const SHORTCUTS = [
  ['⌘ / Ctrl + K',   'Open command palette'],
  ['⌘ / Ctrl + 1',   'Live view'],
  ['⌘ / Ctrl + 2',   'Board view'],
  ['⌘ / Ctrl + 3',   'Chains view'],
  ['⌘ / Ctrl + 4',   'Stats view'],
  ['⌘ / Ctrl + F',   'Focus feed filter'],
  ['Esc',            'Close modal / cancel edit'],
  ['Drag intent → board', 'Add intent as a node'],
  ['Drag dot → dot', 'Wire two nodes (creates chain)'],
  ['Click edge',     'Delete connection'],
  ['Click node X',   'Remove node from board'],
]

export default function SettingsView() {
  const [prefs, setPrefs] = useState(loadPrefs())
  const [health, setHealth] = useState(null)
  const [healthErr, setHealthErr] = useState(null)
  const toast = useToast()
  const intents = useStore(s => s.intents)

  useEffect(() => { applyPrefsToDom(prefs) }, [prefs])

  useEffect(() => {
    Meta.health().then(setHealth).catch(e => setHealthErr(e.message))
  }, [])

  const update = (k, v) => {
    const next = { ...prefs, [k]: v }
    setPrefs(next); savePrefs(next)
  }

  const reset = () => {
    setPrefs({ ...DEFAULTS }); savePrefs({ ...DEFAULTS })
    toast.success('Preferences reset to defaults')
  }

  const clearBoard = () => {
    if (!confirm('Clear all nodes and connections from the board? Saved chains in DB are not affected.')) return
    useStore.getState().clearBoard()
    try { localStorage.removeItem('intentstream:board') } catch {}
    toast.success('Board cleared')
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
        marginBottom: 22,
      }}>SETTINGS</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, maxWidth: 1100 }}>
        {/* Appearance */}
        <section style={card}>
          <div style={cardH}>APPEARANCE</div>
          <Setting label="Scanlines overlay" desc="CRT-style horizontal lines across the UI">
            <Toggle on={prefs.scanlines} onChange={v => update('scanlines', v)} />
          </Setting>
          <Setting label="Glow intensity" desc="Neon glow on accents and text">
            <Segmented value={prefs.glowIntensity} onChange={v => update('glowIntensity', v)}
              options={[
                { v: 'subtle',  label: 'SUBTLE' },
                { v: 'normal',  label: 'NORMAL' },
                { v: 'intense', label: 'INTENSE' },
              ]} />
          </Setting>
          <Setting label="Density" desc="How tightly to pack rows in feeds and lists">
            <Segmented value={prefs.density} onChange={v => update('density', v)}
              options={[
                { v: 'compact',     label: 'COMPACT' },
                { v: 'comfortable', label: 'COMFORTABLE' },
                { v: 'spacious',    label: 'SPACIOUS' },
              ]} />
          </Setting>
        </section>

        {/* Behavior */}
        <section style={card}>
          <div style={cardH}>BEHAVIOR</div>
          <Setting label="Auto-scroll feed" desc="Follow new intents as they arrive">
            <Toggle on={prefs.autoScroll} onChange={v => update('autoScroll', v)} />
          </Setting>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={reset}>Reset to defaults</button>
            <button onClick={clearBoard} className="danger">Clear board</button>
          </div>
        </section>

        {/* System status */}
        <section style={card}>
          <div style={cardH}>SYSTEM</div>
          <Row k="BACKEND" v={
            healthErr ? <span style={{ color: 'var(--red)' }}>offline · {healthErr}</span>
                      : (health ? <span style={{ color: 'var(--teal)', textShadow: 'var(--text-glow-teal)' }}>online · {health.status}</span>
                                : 'checking…')
          } />
          <Row k="INTENTS IN DB" v={health?.intents_in_db?.toLocaleString() ?? '—'} />
          <Row k="INTENTS IN FEED" v={intents.length.toLocaleString()} />
          <Row k="VERSION" v="2.0.0" />
        </section>

        {/* Shortcuts */}
        <section style={{ ...card, gridColumn: 'span 2' }}>
          <div style={cardH}>KEYBOARD SHORTCUTS</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '4px 24px',
          }}>
            {SHORTCUTS.map(([keys, desc]) => (
              <div key={keys} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 0',
                borderBottom: '1px dotted var(--line)',
              }}>
                <kbd style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 9,
                  color: 'var(--orange)',
                  textShadow: 'var(--glow-orange)',
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  padding: '3px 7px',
                  borderRadius: 'var(--radius-sm)',
                  minWidth: 100,
                  textAlign: 'center',
                  letterSpacing: '0.05em',
                }}>{keys}</kbd>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-dim)' }}>
                  {desc}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

const card = {
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
  padding: 18,
}
const cardH = {
  fontFamily: 'var(--font-display)',
  fontSize: 12,
  color: 'var(--orange)',
  textShadow: 'var(--glow-orange)',
  letterSpacing: '0.06em',
  marginBottom: 14,
}

function Setting({ label, desc, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', borderBottom: '1px dotted var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{label}</div>
        {desc && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-faint)', fontStyle: 'italic', marginTop: 2 }}>{desc}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 42, height: 22, padding: 0,
        background: on ? 'var(--pink-fog)' : 'var(--bg)',
        border: `1px solid ${on ? 'var(--pink)' : 'var(--line)'}`,
        boxShadow: on ? 'var(--glow-pink-sm)' : 'none',
        borderRadius: 11,
        position: 'relative',
      }}>
      <span style={{
        position: 'absolute',
        top: 2,
        left: on ? 22 : 2,
        width: 16, height: 16,
        background: on ? 'var(--pink)' : 'var(--ink-faint)',
        borderRadius: '50%',
        transition: 'left 140ms ease, background 140ms',
      }} />
    </button>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          style={{
            fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.05em',
            padding: '4px 10px',
            background: value === o.v ? 'var(--pink-fog)' : 'transparent',
            color: value === o.v ? 'var(--pink)' : 'var(--ink-dim)',
            border: 0, borderRadius: 0,
            boxShadow: value === o.v ? 'var(--glow-pink-sm)' : 'none',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px dotted var(--line)', gap: 12 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.06em', minWidth: 130 }}>{k}</span>
      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)' }}>{v}</span>
    </div>
  )
}
