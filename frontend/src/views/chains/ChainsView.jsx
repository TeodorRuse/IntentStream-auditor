import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../../store'
import ChainListSidebar from './ChainListSidebar'
import ChainDetail from './ChainDetail'
import NewChainModal from './NewChainModal'
import IntentDetail from '../../components/IntentDetail'
import { Intents } from '../../lib/api'

export default function ChainsView() {
  const chains = useStore(s => s.chains)
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailIntent, setDetailIntent] = useState(null)
  const navigate = useNavigate()

  // Auto-select from URL ?id=, otherwise first chain
  useEffect(() => {
    const fromUrl = parseInt(searchParams.get('id'), 10)
    if (fromUrl && chains.find(c => c.id === fromUrl)) {
      setSelectedId(fromUrl); return
    }
    if (selectedId == null && chains.length > 0) setSelectedId(chains[0].id)
    if (selectedId != null && !chains.find(c => c.id === selectedId)) {
      setSelectedId(chains[0]?.id ?? null)
    }
  }, [chains, selectedId, searchParams])

  // Listen for command-palette "newchain" event
  useEffect(() => {
    const onEvt = () => setShowCreate(true)
    window.addEventListener('intentstream:newchain', onEvt)
    return () => window.removeEventListener('intentstream:newchain', onEvt)
  }, [])

  const selected = chains.find(c => c.id === selectedId)

  const handleInfo = async (partial) => {
    if (!partial?.id) return
    try {
      const full = await Intents.get(partial.id)
      setDetailIntent(full)
    } catch {
      setDetailIntent(partial)
    }
  }

  const handleOpenInBoard = (chainId) => {
    navigate('/board', { state: { loadChainId: chainId } })
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
      <ChainListSidebar
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreateClick={() => setShowCreate(true)}
      />
      {selected ? (
        <ChainDetail
          key={selected.id}
          chain={selected}
          onDeleted={() => setSelectedId(null)}
          onOpenInBoard={handleOpenInBoard}
          onInfo={handleInfo}
        />
      ) : (
        <NoChainSelected onCreate={() => setShowCreate(true)} hasChains={chains.length > 0} />
      )}

      {showCreate && (
        <NewChainModal
          onClose={() => setShowCreate(false)}
          onCreated={(chain) => setSelectedId(chain.id)}
        />
      )}
      {detailIntent && (
        <IntentDetail intent={detailIntent} onClose={() => setDetailIntent(null)} />
      )}
    </div>
  )
}

function NoChainSelected({ onCreate, hasChains }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 18, padding: 40, background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse at center, rgba(255,61,143,0.04), transparent 60%)',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 44,
        color: 'var(--pink-dim)',
        textShadow: '2px 2px 0 var(--teal-dim), 0 0 24px rgba(255,61,143,0.4)',
        letterSpacing: '0.05em',
      }}>{hasChains ? 'SELECT.A.CHAIN' : 'NO.CHAINS.YET'}</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: 'var(--ink-dim)', textAlign: 'center',
        maxWidth: 460, lineHeight: 1.6,
      }}>
        {hasChains
          ? 'Pick a chain from the sidebar to view its steps, edit annotations, or open it on the board.'
          : 'Create your first chain to capture a sequence of related intents. You can also wire two intents together on the board to auto-create one.'}
      </div>
      {!hasChains && (
        <button className="primary" onClick={onCreate}>+ NEW CHAIN</button>
      )}
    </div>
  )
}
