import { create } from 'zustand'

const IPS_HISTORY_SIZE = 60

export const useStore = create((set) => ({
  // ── Intent feed ───────────────────────────────────────────────────────────
  intents: [],
  _intentIds: new Set(),
  streaming: false,
  ips: 0,
  ipsHistory: Array(IPS_HISTORY_SIZE).fill(0), // rolling window of last 60s

  addIntents: (newIntents) => set((s) => {
    const fresh = newIntents.filter(i => !s._intentIds.has(i.id))
    if (!fresh.length) return s
    const newIds = new Set(s._intentIds)
    fresh.forEach(i => newIds.add(i.id))
    const combined = [...s.intents, ...fresh]
    const tail = s.intents.length ? s.intents[s.intents.length - 1].id : 0
    if (fresh.some(i => i.id < tail)) combined.sort((a, b) => a.id - b.id)
    return { intents: combined, _intentIds: newIds }
  }),

  setStreaming: (v) => set({ streaming: v }),
  setIps: (v) => set((s) => ({
    ips: v,
    ipsHistory: [...s.ipsHistory.slice(1), v],
  })),

  // ── Chains (loaded from backend) ──────────────────────────────────────────
  chains: [],
  setChains: (chains) => set({ chains }),
  addChain: (chain) => set((s) => ({ chains: [chain, ...s.chains] })),
  updateChainLocal: (id, patch) => set((s) => ({
    chains: s.chains.map(c => c.id === id ? { ...c, ...patch } : c),
  })),
  removeChain: (id) => set((s) => ({
    chains: s.chains.filter(c => c.id !== id),
  })),

  // ── Board ─────────────────────────────────────────────────────────────────
  boardNodes: [],
  boardEdges: [],

  addBoardNode: (intent, x, y) => set((s) => {
    if (s.boardNodes.find(n => n.intentId === intent.id)) return s
    return {
      boardNodes: [...s.boardNodes, {
        id: `node-${intent.id}`,
        intentId: intent.id,
        x, y,
      }]
    }
  }),

  moveBoardNode: (nodeId, x, y) => set((s) => ({
    boardNodes: s.boardNodes.map(n => n.id === nodeId ? { ...n, x, y } : n)
  })),

  addBoardEdge: (sourceNodeId, sourceSide, targetNodeId, targetSide, chainId) => set((s) => {
    const id = `edge-${sourceNodeId}-${sourceSide}-${targetNodeId}-${targetSide}-${Date.now()}`
    return {
      boardEdges: [...s.boardEdges, {
        id, sourceNodeId, sourceSide, targetNodeId, targetSide,
        chainId: chainId || null,
        label: '',
      }]
    }
  }),

  updateEdgeLabel: (edgeId, label) => set((s) => ({
    boardEdges: s.boardEdges.map(e => e.id === edgeId ? { ...e, label } : e)
  })),

  removeEdge: (edgeId) => set((s) => ({
    boardEdges: s.boardEdges.filter(e => e.id !== edgeId)
  })),

  removeNode: (nodeId) => set((s) => ({
    boardNodes: s.boardNodes.filter(n => n.id !== nodeId),
    boardEdges: s.boardEdges.filter(e =>
      e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
    ),
  })),

  clearBoard: () => set({ boardNodes: [], boardEdges: [] }),
}))
