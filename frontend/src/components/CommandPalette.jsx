import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Network, Link2, BarChart3, Search, Download, Settings as SettingsIcon, Trash2, Plus } from 'lucide-react'
import { useStore } from '../store'
import { useToast } from './Toast'

/**
 * Cmd/Ctrl+K palette. Lists navigation, common actions, and chains
 * so you can jump straight to one. Closes on Esc.
 */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate()
  const chains   = useStore(s => s.chains)
  const clearBoard = useStore(s => s.clearBoard)
  const toast = useToast()
  const [q, setQ]       = useState('')
  const [sel, setSel]   = useState(0)
  const inputRef        = useRef(null)

  useEffect(() => {
    if (!open) return
    setQ(''); setSel(0)
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  const items = useMemo(() => {
    const nav = [
      { kind: 'nav', label: 'Go to Live',     icon: Activity,   action: () => navigate('/') },
      { kind: 'nav', label: 'Go to Board',    icon: Network,    action: () => navigate('/board') },
      { kind: 'nav', label: 'Go to Chains',   icon: Link2,      action: () => navigate('/chains') },
      { kind: 'nav', label: 'Go to Stats',    icon: BarChart3,  action: () => navigate('/stats') },
      { kind: 'nav', label: 'Go to Search',   icon: Search,     action: () => navigate('/search') },
      { kind: 'nav', label: 'Go to Export',   icon: Download,   action: () => navigate('/export') },
      { kind: 'nav', label: 'Go to Settings', icon: SettingsIcon, action: () => navigate('/settings') },
    ]
    const actions = [
      { kind: 'action', label: 'New chain…',    icon: Plus, action: () => { navigate('/chains'); setTimeout(() => window.dispatchEvent(new CustomEvent('intentstream:newchain')), 50) } },
      { kind: 'action', label: 'Clear board',   icon: Trash2, action: () => { clearBoard(); try { localStorage.removeItem('intentstream:board') } catch {} ; toast.success('Board cleared') } },
    ]
    const chainItems = chains.map(c => ({
      kind: 'chain',
      label: `Open chain: ${c.name}`,
      icon: Link2,
      action: () => navigate(`/chains?id=${c.id}`),
      chainId: c.id,
    }))
    const all = [...nav, ...actions, ...chainItems]
    if (!q.trim()) return all
    const needle = q.toLowerCase()
    return all.filter(i => i.label.toLowerCase().includes(needle))
  }, [q, chains, navigate, clearBoard, toast])

  useEffect(() => { setSel(0) }, [q])

  if (!open) return null

  const run = (item) => {
    item?.action?.()
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2500,
        background: 'rgba(10,5,25,0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '14vh',
        animation: 'fade-in 140ms ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)) }
          if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
          if (e.key === 'Enter')     { e.preventDefault(); run(items[sel]) }
        }}
        style={{
          width: 'min(620px, 92vw)',
          background: 'var(--bg-2)',
          border: '1px solid var(--pink-dim)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 0 0 1px rgba(255,61,143,0.25), 0 20px 60px rgba(0,0,0,0.7), var(--glow-pink-sm)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={14} strokeWidth={2} color="var(--pink)" style={{ filter: 'drop-shadow(0 0 4px rgba(255,61,143,0.6))' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="type a command…"
            style={{ flex: 1, border: 0, background: 'transparent', fontSize: 13, padding: 0, fontFamily: 'var(--font-mono)' }}
          />
          <kbd style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            background: 'var(--paper)',
            color: 'var(--ink-faint)',
            border: '1px solid var(--line)',
            padding: '3px 6px',
            borderRadius: 'var(--radius-sm)',
            letterSpacing: '0.05em',
          }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '4px 0' }}>
          {items.length === 0 && (
            <div style={{
              padding: 30,
              textAlign: 'center',
              color: 'var(--ink-faint)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}>nothing matches.</div>
          )}
          {items.map((item, i) => {
            const Icon = item.icon
            return (
              <div key={i}
                onMouseEnter={() => setSel(i)}
                onClick={() => run(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  background: i === sel ? 'var(--pink-fog)' : 'transparent',
                  borderLeft: i === sel ? '2px solid var(--pink)' : '2px solid transparent',
                  paddingLeft: i === sel ? 14 : 16,
                  transition: 'background 80ms',
                }}>
                <Icon size={13} strokeWidth={1.8}
                  color={i === sel ? 'var(--pink)' : 'var(--ink-dim)'} />
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: i === sel ? 'var(--ink)' : 'var(--ink-dim)',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>{item.label}</span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 8,
                  letterSpacing: '0.06em',
                  color: 'var(--ink-faint)',
                  textTransform: 'uppercase',
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  padding: '2px 5px',
                  borderRadius: 'var(--radius-sm)',
                }}>{item.kind}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
