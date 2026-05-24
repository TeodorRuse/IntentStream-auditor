import React from 'react'

/**
 * Placeholder used by views still under construction.
 * Replaces the bare "Coming soon" string with something on-brand
 * so the user can see what's planned for each route.
 */
export default function Placeholder({ name, blurb, hints = [] }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      background: 'var(--bg)',
      backgroundImage:
        'radial-gradient(ellipse at center, rgba(255,61,143,0.06), transparent 60%)',
      gap: 22,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 56,
        color: 'var(--pink-dim)',
        textShadow:
          '2px 2px 0 var(--teal-dim), 0 0 24px rgba(255,61,143,0.4)',
        letterSpacing: '0.05em',
      }}>
        {name.toUpperCase()}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: 'var(--ink-dim)',
        textAlign: 'center',
        maxWidth: 480,
        lineHeight: 1.6,
      }}>
        {blurb}
      </div>
      {hints.length > 0 && (
        <div style={{
          marginTop: 12,
          padding: '14px 18px',
          border: '1px dotted var(--line-2)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--paper)',
          minWidth: 380,
          maxWidth: 520,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            color: 'var(--orange)',
            letterSpacing: '0.08em',
            marginBottom: 8,
            textShadow: 'var(--glow-orange)',
          }}>
            COMING UP
          </div>
          {hints.map((h, i) => (
            <div key={i} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-dim)',
              padding: '4px 0',
              borderBottom: i === hints.length - 1 ? 0 : '1px dotted var(--line-dim)',
            }}>
              <span style={{ color: 'var(--teal)', marginRight: 8 }}>▸</span>
              {h}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
