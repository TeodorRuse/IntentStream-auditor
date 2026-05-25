import React, { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useStore } from '../../store'
import { formatDateShort } from '../../utils'

/**
 * Left sidebar in the Chains view — searchable list of saved chains.
 * Selecting a chain triggers the parent's onSelect; the parent decides
 * which detail to render on the right.
 */
export default function ChainListSidebar({ selectedId, onSelect, onCreateClick }) {
  const chains = useStore(s => s.chains)
  const [filter, setFilter] = useState('')
  const [sortMode, setSortMode] = useState('recent') // 'recent' | 'name'

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    let result = q
      ? chains.filter(c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q))
      : chains
    if (sortMode === 'name') {
      result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    } else {
      // Newest first by created_at
      result = [...result].sort((a, b) =>
        new Date(b.created_at || 0) - new Date(a.created_at || 0))
    }
    return result
  }, [chains, filter, sortMode])

  return (
    <aside style={{
      width: 300, minWidth: 300, maxWidth: 300,
      borderRight: '1px solid var(--line)',
      background: 'var(--bg-2)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            color: 'var(--pink)',
            textShadow: '1px 1px 0 var(--teal-dim), var(--text-glow-pink)',
            letterSpacing: '0.05em',
          }}>SAVED.CHAINS</span>
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-faint)',
            fontVariantNumeric: 'tabular-nums',
          }}>{filtered.length}/{chains.length}</span>
        </div>
        <button
          className="primary"
          onClick={onCreateClick}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
          <Plus size={12} strokeWidth={2.5} />
          NEW CHAIN
        </button>
      </div>

      {/* Search + sort */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={11} strokeWidth={2}
            style={{
              position: 'absolute',
              left: 8, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-faint)',
              pointerEvents: 'none',
            }} />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="search chains…"
            style={{ width: '100%', paddingLeft: 26, fontSize: 11 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <SortChip active={sortMode === 'recent'} onClick={() => setSortMode('recent')}>RECENT</SortChip>
          <SortChip active={sortMode === 'name'}   onClick={() => setSortMode('name')}>NAME</SortChip>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            {chains.length === 0
              ? 'no chains yet. create one or wire two intents on the board.'
              : 'no matches.'}
          </div>
        )}
        {filtered.map(chain => (
          <ChainRow
            key={chain.id}
            chain={chain}
            selected={chain.id === selectedId}
            onClick={() => onSelect(chain.id)}
          />
        ))}
      </div>
    </aside>
  )
}

function SortChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 9,
        padding: '3px 8px',
        background: active ? 'var(--pink-fog)' : 'transparent',
        color: active ? 'var(--pink)' : 'var(--ink-faint)',
        border: `1px solid ${active ? 'var(--pink-dim)' : 'var(--line)'}`,
        letterSpacing: '0.06em',
        boxShadow: active ? 'var(--glow-pink-sm)' : 'none',
      }}>
      {children}
    </button>
  )
}

function ChainRow({ chain, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '11px 14px 11px 12px',
        borderBottom: '1px dotted var(--line)',
        borderLeft: selected ? '2px solid var(--pink)' : '2px solid transparent',
        background: selected ? 'var(--pink-fog)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--pink-mist)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 500,
        color: selected ? 'var(--ink)' : 'var(--ink)',
        marginBottom: 3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textShadow: selected ? 'var(--text-glow-pink)' : 'none',
      }}>
        {chain.name}
      </div>
      {chain.description && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-dim)',
          marginBottom: 5,
          fontStyle: 'italic',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {chain.description}
        </div>
      )}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: 9,
        color: 'var(--ink-faint)',
        letterSpacing: '0.05em',
      }}>
        <span>{formatDateShort(chain.created_at)}</span>
        <span style={{ color: 'var(--ink-trace)' }}>·</span>
        <span>#{chain.id}</span>
      </div>
    </div>
  )
}
