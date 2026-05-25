import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { buildColorBands } from '../utils'
import IntentCard from './IntentCard'
import { loadPrefs } from '../views/SettingsView'

const MAX_RENDERED = 100

export default function IntentPanel({ onInfo, defaultWidth = 320 }) {
  const intents   = useStore(s => s.intents)
  const streaming = useStore(s => s.streaming)
  const [width, setWidth]             = useState(defaultWidth)
  const [filter, setFilter]           = useState('')
  const [windowStart, setWindowStart] = useState(0)
  const outerRef    = useRef(null)
  const filterRef   = useRef(null)
  const draggingRef = useRef(false)
  const startXRef   = useRef(0)
  const startWRef   = useRef(0)
  const prefs       = loadPrefs()

  const sorted = filter.trim()
    ? intents.filter(i =>
        (i.action || '').toLowerCase().includes(filter.toLowerCase()) ||
        (i.sender_package || '').toLowerCase().includes(filter.toLowerCase())
      )
    : intents

  const bands = buildColorBands(sorted)

  const total    = sorted.length
  const endIdx   = Math.max(total - windowStart, 0)
  const startIdx = Math.max(endIdx - MAX_RENDERED, 0)
  const visible  = sorted.slice(startIdx, endIdx)

  const canScrollUp   = startIdx > 0
  const canScrollDown = windowStart > 0
  const isAtBottom    = windowStart === 0

  useEffect(() => {
    if (prefs.autoScroll && isAtBottom && outerRef.current) {
      outerRef.current.scrollTop = outerRef.current.scrollHeight
    }
  }, [visible.length, isAtBottom, prefs.autoScroll])

  // Listen for Ctrl/Cmd+F to focus the filter input
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        if (filterRef.current) {
          e.preventDefault()
          filterRef.current.focus()
          filterRef.current.select()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onScroll = (e) => {
    const el = e.target
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10
    if (atBottom) setWindowStart(0)
  }

  const onMouseDown = (e) => {
    draggingRef.current = true
    startXRef.current   = e.clientX
    startWRef.current   = width
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return
      setWidth(Math.max(220, Math.min(640, startWRef.current + (e.clientX - startXRef.current))))
    }
    const onUp = () => {
      draggingRef.current = false
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{
        width, minWidth: 220, maxWidth: 640,
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--line)', background: 'var(--bg-2)',
      }}>
        <div style={{
          padding: '12px 14px', borderBottom: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 13,
              color: 'var(--pink)',
              textShadow: '1px 1px 0 var(--teal-dim), 0 0 6px rgba(255,61,143,0.4)',
              letterSpacing: '0.04em',
            }}>LIVE.FEED</span>
            <span style={{
              marginLeft: 'auto', fontFamily: 'var(--font-mono)',
              fontSize: 10, color: 'var(--ink-faint)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {sorted.length}{sorted.length !== intents.length ? `/${intents.length}` : ''}
            </span>
          </div>
          <input
            ref={filterRef}
            value={filter}
            onChange={e => { setFilter(e.target.value); setWindowStart(0) }}
            placeholder="filter action / package…"
            style={{ width: '100%', fontSize: 11 }}
          />
        </div>

        {canScrollUp && (
          <button onClick={() => setWindowStart(w => Math.min(w + MAX_RENDERED, total - MAX_RENDERED))}
            style={{
              margin: '4px 10px', fontSize: 9, padding: '4px 0',
              borderStyle: 'dashed', fontFamily: 'var(--font-display)', letterSpacing: '0.05em',
            }}>
            ↑ LOAD OLDER ({startIdx} ABOVE)
          </button>
        )}

        <div ref={outerRef} onScroll={onScroll}
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {visible.length === 0 && (
            <div style={{
              padding: '32px 16px', color: 'var(--ink-faint)',
              textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-mono)',
            }}>
              {intents.length === 0
                ? (streaming ? 'waiting for intents…' : 'reconnecting…')
                : 'no results.'}
            </div>
          )}
          {visible.map(intent => (
            <IntentCard key={intent.id} intent={intent} band={bands[intent.id]} onInfo={onInfo} />
          ))}
        </div>

        {canScrollDown && (
          <button onClick={() => setWindowStart(0)}
            style={{
              margin: '4px 10px', fontSize: 9, padding: '4px 0',
              borderStyle: 'dashed', borderColor: 'var(--pink)',
              color: 'var(--pink)', fontFamily: 'var(--font-display)',
              letterSpacing: '0.05em', boxShadow: 'var(--glow-pink-sm)',
            }}>
            ↓ JUMP TO LATEST
          </button>
        )}
      </div>

      <div onMouseDown={onMouseDown}
        style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, zIndex: 10 }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--pink-dim)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      />
    </div>
  )
}
