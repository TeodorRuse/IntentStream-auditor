import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Check, AlertTriangle, X } from 'lucide-react'

const ToastCtx = createContext(null)

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts(ts => ts.filter(t => t.id !== id))
    const tm = timersRef.current.get(id)
    if (tm) { clearTimeout(tm); timersRef.current.delete(id) }
  }, [])

  const push = useCallback((toast) => {
    const id = nextId++
    const entry = { id, kind: 'info', duration: 3500, ...toast }
    setToasts(ts => [...ts, entry])
    if (entry.duration > 0) {
      const tm = setTimeout(() => dismiss(id), entry.duration)
      timersRef.current.set(id, tm)
    }
    return id
  }, [dismiss])

  const value = {
    push,
    success: (msg, opts = {}) => push({ kind: 'success', msg, ...opts }),
    error:   (msg, opts = {}) => push({ kind: 'error',   msg, duration: 5000, ...opts }),
    info:    (msg, opts = {}) => push({ kind: 'info',    msg, ...opts }),
    dismiss,
  }

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 16, right: 16,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const KIND_STYLES = {
  success: { color: 'var(--teal)',   glow: 'var(--glow-teal-sm)',  border: 'var(--teal-dim)',  icon: Check },
  info:    { color: 'var(--pink)',   glow: 'var(--glow-pink-sm)',  border: 'var(--pink-dim)',  icon: null },
  error:   { color: 'var(--red)',    glow: '0 0 6px rgba(255,77,109,0.5)', border: 'var(--red)', icon: AlertTriangle },
}

function ToastItem({ toast, onDismiss }) {
  const style = KIND_STYLES[toast.kind] || KIND_STYLES.info
  const Icon = style.icon
  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex', alignItems: 'center', gap: 10,
        minWidth: 240, maxWidth: 380,
        padding: '10px 12px 10px 14px',
        background: 'var(--bg-2)',
        border: `1px solid ${style.border}`,
        borderLeft: `3px solid ${style.color}`,
        borderRadius: 'var(--radius-sm)',
        boxShadow: `${style.glow}, 0 8px 20px rgba(0,0,0,0.5)`,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--ink)',
        animation: 'fade-in 180ms ease-out',
      }}
    >
      {Icon && <Icon size={14} strokeWidth={2} color={style.color} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{toast.msg}</span>
      <button
        className="ghost"
        onClick={onDismiss}
        style={{ padding: 2, border: 0, color: 'var(--ink-faint)' }}
        aria-label="Dismiss"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  )
}
