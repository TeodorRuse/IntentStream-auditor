import React, { useState, useCallback } from 'react'
import { Search as SearchIcon, Plus } from 'lucide-react'
import { Intents } from '../lib/api'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import IntentDetail from '../components/IntentDetail'
import { formatTime, shortAction, isSystemIntent } from '../utils'

const MODES = [
  { key: 'action',    label: 'ACTION',    hint: 'e.g. BOOT_COMPLETED, CONNECTIVITY_CHANGE' },
  { key: 'package',   label: 'PACKAGE',   hint: 'e.g. com.spotify, system_server' },
  { key: 'component', label: 'COMPONENT', hint: 'e.g. com.example/.SomeReceiver' },
  { key: 'extras',    label: 'EXTRAS',    hint: 'substring match against extras_raw' },
  { key: 'flags',     label: 'FLAGS',     hint: 'exact match, e.g. 0x60000010 or 1610612752' },
  { key: 'date',      label: 'DATE',      hint: 'ISO datetime range' },
]

export default function SearchView() {
  const addBoardNode = useStore(s => s.addBoardNode)
  const toast = useToast()
  const [mode, setMode]       = useState('action')
  const [query, setQuery]     = useState('')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [results, setResults] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState(null)
  const [detailIntent, setDetailIntent] = useState(null)

  const search = useCallback(async () => {
    setRunning(true); setError(null)
    try {
      let res
      if (mode === 'date') {
        if (!from || !to) throw new Error('Both from and to are required')
        res = await Intents.searchByDate(toIsoLocal(from), toIsoLocal(to), { limit: 200 })
      } else if (mode === 'action') {
        res = await Intents.searchByAction(query, { limit: 200 })
      } else if (mode === 'package') {
        res = await Intents.searchByPackage(query, { limit: 200 })
      } else if (mode === 'component') {
        res = await Intents.searchByComponent(query, { limit: 200 })
      } else if (mode === 'extras') {
        res = await Intents.searchByExtras(query, { limit: 200 })
      } else if (mode === 'flags') {
        const flags = /^0x/i.test(query) ? parseInt(query, 16) : parseInt(query, 10)
        if (isNaN(flags)) throw new Error('Flags must be a number (decimal or 0x-prefixed hex)')
        res = await Intents.searchByFlags(flags, { limit: 200 })
      }
      setResults(res?.items || res || [])
      if ((res?.items?.length ?? res?.length ?? 0) === 0) {
        toast.info('No results.')
      }
    } catch (err) {
      setError(err.message || String(err))
      setResults([])
    } finally {
      setRunning(false)
    }
  }, [mode, query, from, to, toast])

  const addToBoard = (intent) => {
    addBoardNode(intent, 100 + Math.random() * 200, 80 + Math.random() * 200)
    toast.success(`Added #${intent.id} to board`)
  }

  const needsDate = mode === 'date'
  const canSearch = needsDate ? (from && to) : query.trim().length > 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg)' }}>
      {/* Header / form */}
      <div style={{
        padding: 20,
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-2)',
        backgroundImage: 'radial-gradient(ellipse at top right, rgba(255,61,143,0.05), transparent 60%)',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          color: 'var(--pink)',
          textShadow: '2px 2px 0 var(--teal-dim), 0 0 16px rgba(255,61,143,0.4)',
          letterSpacing: '0.04em',
          fontWeight: 400,
          marginBottom: 14,
        }}>SEARCH</h1>

        {/* Mode chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => { setMode(m.key); setResults([]); setError(null) }}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 10,
                padding: '5px 12px',
                background: mode === m.key ? 'var(--pink-fog)' : 'transparent',
                color: mode === m.key ? 'var(--pink)' : 'var(--ink-dim)',
                border: `1px solid ${mode === m.key ? 'var(--pink-dim)' : 'var(--line)'}`,
                boxShadow: mode === m.key ? 'var(--glow-pink-sm)' : 'none',
                letterSpacing: '0.06em',
              }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        {needsDate ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--orange)', letterSpacing: '0.06em' }}>FROM</span>
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 8px', colorScheme: 'dark' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--orange)', letterSpacing: '0.06em' }}>TO</span>
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 8px', colorScheme: 'dark' }} />
            <button className="primary" onClick={search} disabled={!canSearch || running}>
              {running ? 'SEARCHING…' : 'SEARCH'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 600 }}>
              <SearchIcon size={12} strokeWidth={2}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSearch) search() }}
                placeholder={MODES.find(m => m.key === mode)?.hint}
                style={{ width: '100%', paddingLeft: 32, fontSize: 12, padding: '8px 12px 8px 32px' }}
              />
            </div>
            <button className="primary" onClick={search} disabled={!canSearch || running}>
              {running ? 'SEARCHING…' : 'SEARCH'}
            </button>
          </div>
        )}

        <div style={{
          marginTop: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-faint)',
          fontStyle: 'italic',
        }}>
          {MODES.find(m => m.key === mode)?.hint}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {error && (
          <div style={{
            padding: 12,
            border: '1px solid var(--red)',
            color: 'var(--red)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            background: 'rgba(255,77,109,0.06)',
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {results.length === 0 && !running && !error && (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              color: 'var(--pink-dim)',
              textShadow: 'var(--glow-pink-sm)',
              marginBottom: 14,
              opacity: 0.6,
              letterSpacing: '0.05em',
            }}>·  ◇  ·</div>
            <div>Type a query and hit search to start.</div>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 10,
              color: 'var(--orange)',
              textShadow: 'var(--glow-orange)',
              letterSpacing: '0.06em',
              marginBottom: 10,
            }}>
              {results.length} RESULT{results.length === 1 ? '' : 'S'}
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-2)' }}>
              {results.map(intent => (
                <ResultRow
                  key={intent.id}
                  intent={intent}
                  onInfo={() => setDetailIntent(intent)}
                  onAdd={() => addToBoard(intent)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {detailIntent && (
        <IntentDetail intent={detailIntent} onClose={() => setDetailIntent(null)} />
      )}
    </div>
  )
}

function ResultRow({ intent, onInfo, onAdd }) {
  const isSystem = isSystemIntent(intent)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '54px 72px 1fr 200px 140px 80px',
        gap: 12,
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px dotted var(--line)',
        transition: 'background 100ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--pink-mist)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 10,
        color: 'var(--orange)',
        letterSpacing: '0.04em',
      }}>#{intent.id}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--ink-faint)',
        fontVariantNumeric: 'tabular-nums',
      }}>{formatTime(intent.enqueue_time || intent.poll_time)}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: isSystem ? 'var(--ink-dim)' : 'var(--ink)',
        fontWeight: isSystem ? 400 : 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>{shortAction(intent.action)}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: isSystem ? 'var(--ink-faint)' : 'var(--teal)',
        textShadow: isSystem ? 'none' : 'var(--text-glow-teal)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>{intent.sender_package || '(system)'}</span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--ink-faint)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>{intent.target_component || ''}</span>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button className="ghost" onClick={onInfo}
          style={{ padding: '3px 6px', border: '1px solid var(--line)', fontSize: 9, fontFamily: 'var(--font-display)' }}>
          [i]
        </button>
        <button className="ghost" onClick={onAdd}
          style={{ padding: '3px 6px', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 3 }}
          title="Add to board">
          <Plus size={10} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

function toIsoLocal(dt) {
  // datetime-local inputs return "2026-05-25T14:30" — backend expects ISO with seconds
  if (!dt) return ''
  return dt.includes(':') && dt.length === 16 ? dt + ':00' : dt
}
