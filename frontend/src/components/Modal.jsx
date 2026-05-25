import React, { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Generic modal used by chain create / confirm-delete dialogs.
 * Closes on Escape and on backdrop click.
 *
 * Children render the body. `title` and `footer` are optional.
 */
export default function Modal({ title, onClose, children, footer, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(10, 5, 25, 0.78)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fade-in 160ms ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: `min(${width}px, 90vw)`,
          background: 'var(--bg-2)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--radius-md)',
          boxShadow:
            '0 0 0 1px rgba(255,61,143,0.15), 0 20px 60px rgba(0,0,0,0.7), var(--glow-pink-sm)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '85vh',
        }}
      >
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--paper)',
            gap: 8,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--pink)',
              fontSize: 13,
              letterSpacing: '0.06em',
              textShadow: '1px 1px 0 var(--teal-dim), var(--text-glow-pink)',
            }}>
              {title}
            </span>
            <button
              className="ghost"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 26, height: 26,
                padding: 0,
                border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid var(--line)',
            background: 'var(--paper)',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
