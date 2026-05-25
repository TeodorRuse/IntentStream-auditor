import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Board from '../components/Board'
import IntentPanel from '../components/IntentPanel'
import IntentDetail from '../components/IntentDetail'
import { Chains, Intents } from '../lib/api'
import { useStore } from '../store'
import { useToast } from '../components/Toast'

/**
 * Board view: a narrower feed panel on the left for dragging,
 * and a wider canvas on the right. Supports being navigated to with
 * { state: { loadChainId } } from the Chains view.
 */
export default function BoardView() {
  const [detailIntent, setDetailIntent] = useState(null)
  const location = useLocation()
  const loadChainToBoard = useStore(s => s.loadChainToBoard)
  const addIntents = useStore(s => s.addIntents)
  const intents    = useStore(s => s.intents)
  const toast = useToast()

  // Hydrate from a chain when arriving from Chains view
  useEffect(() => {
    const chainId = location.state?.loadChainId
    if (!chainId) return
    let cancelled = false
    ;(async () => {
      try {
        const members = await Chains.members(chainId)
        if (cancelled || !members?.length) return
        loadChainToBoard(members)
        toast.success(`Loaded ${members.length} steps on board`)

        // Fetch any intents not already in the feed
        const missing = members
          .map(m => m.intent_id)
          .filter(id => !intents.find(i => i.id === id))
        if (missing.length > 0) {
          const fetched = await Promise.all(
            missing.map(id => Intents.get(id).catch(() => null))
          )
          addIntents(fetched.filter(Boolean))
        }
      } catch (err) {
        toast.error(`Failed to load chain: ${err.message}`)
      }
    })()
    return () => { cancelled = true }
  }, [location.state?.loadChainId]) // eslint-disable-line

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <IntentPanel onInfo={setDetailIntent} defaultWidth={280} />
      <Board onInfo={setDetailIntent} />
      {detailIntent && (
        <IntentDetail intent={detailIntent} onClose={() => setDetailIntent(null)} />
      )}
    </div>
  )
}
