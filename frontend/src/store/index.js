import { create } from 'zustand'

const IPS_HISTORY_SIZE = 60
const BOARD_KEY = 'intentstream:board'

// ── Persistence helpers ─────────────────────────────────────────────────────
function loadBoard() {
  try {
    const raw = localStorage.getItem(BOARD_KEY)
    if (!raw) return { boardNodes: [], boardEdges: [] }
    const data = JSON.parse(raw)
    return {
      boardNodes: Array.isArray(data.boardNodes) ? data.boardNodes : [],
      boardEdges: Array.isArray(data.boardEdges) ? data.boardEdges : [],
    }
  } catch {
    return { boardNodes: [], boardEdges: [] }
  }
}
function saveBoard(state) {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify({
      boardNodes: state.boardNodes,
      boardEdges: state.boardEdges,
    }))
  } catch {}
}

const persisted = loadBoard()

export const useStore = create((set, get) => ({
  // ── Intent feed ───────────────────────────────────────────────────────────
  intents: [],
  _intentIds: new Set(),
  streaming: false,
  ips: 0,
  ipsHistory: Array(IPS_HISTORY_SIZE).fill(0),

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

  // ── Chains ────────────────────────────────────────────────────────────────
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
  boardNodes: persisted.boardNodes,
  boardEdges: persisted.boardEdges,

  addBoardNode: (intent, x, y) => {
    const s = get()
    if (s.boardNodes.find(n => n.intentId === intent.id)) return
    const next = {
      boardNodes: [...s.boardNodes, { id: `node-${intent.id}`, intentId: intent.id, x, y }],
      boardEdges: s.boardEdges,
    }
    set({ boardNodes: next.boardNodes })
    saveBoard(next)
  },

  moveBoardNode: (nodeId, x, y) => {
    const s = get()
    const next = {
      boardNodes: s.boardNodes.map(n => n.id === nodeId ? { ...n, x, y } : n),
      boardEdges: s.boardEdges,
    }
    set({ boardNodes: next.boardNodes })
    saveBoard(next)
  },

  addBoardEdge: (sourceNodeId, sourceSide, targetNodeId, targetSide, chainId) => {
    const s = get()
    const id = `edge-${sourceNodeId}-${sourceSide}-${targetNodeId}-${targetSide}-${Date.now()}`
    const next = {
      boardNodes: s.boardNodes,
      boardEdges: [...s.boardEdges, {
        id, sourceNodeId, sourceSide, targetNodeId, targetSide,
        chainId: chainId || null,
        label: '',
      }],
    }
    set({ boardEdges: next.boardEdges })
    saveBoard(next)
  },

  updateEdgeLabel: (edgeId, label) => {
    const s = get()
    const next = {
      boardNodes: s.boardNodes,
      boardEdges: s.boardEdges.map(e => e.id === edgeId ? { ...e, label } : e),
    }
    set({ boardEdges: next.boardEdges })
    saveBoard(next)
  },

  removeEdge: (edgeId) => {
    const s = get()
    const next = {
      boardNodes: s.boardNodes,
      boardEdges: s.boardEdges.filter(e => e.id !== edgeId),
    }
    set({ boardEdges: next.boardEdges })
    saveBoard(next)
  },

  removeNode: (nodeId) => {
    const s = get()
    const next = {
      boardNodes: s.boardNodes.filter(n => n.id !== nodeId),
      boardEdges: s.boardEdges.filter(e =>
        e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
      ),
    }
    set(next)
    saveBoard(next)
  },

  clearBoard: () => {
    set({ boardNodes: [], boardEdges: [] })
    saveBoard({ boardNodes: [], boardEdges: [] })
  },

  /**
   * Bulk-load a chain onto the board: lay out members horizontally,
   * connect them in order. Replaces any existing board content.
   */
  loadChainToBoard: (members) => {
    const X0 = 60, Y0 = 60, GAP_X = 250, GAP_Y = 0
    const nodes = members.map((m, i) => ({
      id: `node-${m.intent_id}`,
      intentId: m.intent_id,
      x: X0 + i * GAP_X,
      y: Y0 + (i % 2) * GAP_Y,
    }))
    const edges = []
    for (let i = 0; i < members.length - 1; i++) {
      edges.push({
        id: `edge-loaded-${i}-${Date.now()}`,
        sourceNodeId: nodes[i].id, sourceSide: 'right',
        targetNodeId: nodes[i + 1].id, targetSide: 'left',
        chainId: null,
        label: members[i + 1].label || '',
      })
    }
    set({ boardNodes: nodes, boardEdges: edges })
    saveBoard({ boardNodes: nodes, boardEdges: edges })
  },
}))
