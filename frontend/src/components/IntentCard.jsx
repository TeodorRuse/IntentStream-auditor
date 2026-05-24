import React, { useState, useRef } from 'react'
import { formatTime, shortAction, isSystemIntent } from '../utils'

const BAND_COLORS = {
  pink: { bg: 'var(--pink)', glow: 'var(--glow-pink-sm)' },
  gray: { bg: 'var(--line-2)', glow: 'none' },
}

export default function IntentCard({ intent, band, onInfo, onDragStart }) {
  const isSystem = isSystemIntent(intent)
  const color    = BAND_COLORS[band] || BAND_COLORS.gray
  const [dragging, setDragging] = useState(false)
  const cardRef = useRef(null)

  const handleDragStart = (e) => {
    setDragging(true)
    e.dataTransfer.setData('intentId', String(intent.id))
    e.dataTransfer.effectAllowed = 'copy'
    onDragStart && onDragStart(intent)
  }

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '3px 60px 1fr 24px',
        alignItems: 'stretch',
        borderBottom: '1px dotted var(--line)',
        background: dragging ? 'var(--pink-fog)' : 'transparent',
        opacity: dragging ? 0.55 : 1,
        cursor: 'grab',
        transition: 'background 80ms ease',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = 'var(--pink-mist)' }}
      onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Color band */}
      <div style={{
        background: color.bg,
        opacity: band === 'gray' ? 0.5 : 0.95,
        boxShadow: color.glow,
      }} />

      {/* Timestamp + ID */}
      <div style={{
        padding: '6px 6px 6px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 2,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-faint)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>
          {formatTime(intent.enqueue_time || intent.poll_time)}
        </span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 8,
          color: 'var(--orange)',
          opacity: 0.85,
          letterSpacing: '0.02em',
        }}>
          #{intent.id}
        </span>
      </div>

      {/* Content */}
      <div style={{
        minWidth: 0,
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          color: isSystem ? 'var(--ink-dim)' : 'var(--ink)',
          fontSize: 11,
          fontWeight: isSystem ? 400 : 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>
          {shortAction(intent.action)}
        </div>
        {intent.sender_package && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            color: isSystem ? 'var(--ink-faint)' : 'var(--teal)',
            fontSize: 10,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textShadow: isSystem ? 'none' : 'var(--text-glow-teal)',
            opacity: isSystem ? 1 : 0.9,
          }}>
            {intent.sender_package}
          </div>
        )}
      </div>

      {/* Info button */}
      <button
        onClick={(e) => { e.stopPropagation(); onInfo(intent) }}
        className="ghost"
        style={{
          alignSelf: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 9,
          color: 'var(--ink-faint)',
          padding: '4px 4px',
          margin: '0 4px',
          background: 'transparent',
          border: '1px solid var(--line-dim)',
          borderRadius: 'var(--radius-sm)',
          lineHeight: 1,
        }}
        title="View full intent details"
      >
        [i]
      </button>
    </div>
  )
}
