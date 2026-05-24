import { useEffect } from 'react'
import { useStore } from '../store'
import { Chains } from '../lib/api'

/**
 * Loads the list of chains from backend once and stores it.
 * Components that mutate chains should also update the store
 * (via addChain / removeChain / updateChainLocal) so the sidebar
 * count stays in sync without a refetch.
 */
export function useChainsBootstrap() {
  const setChains = useStore(s => s.setChains)
  useEffect(() => {
    let cancelled = false
    Chains.list()
      .then(list => { if (!cancelled) setChains(list || []) })
      .catch(err => console.warn('Failed to load chains:', err))
    return () => { cancelled = true }
  }, [setChains])
}
