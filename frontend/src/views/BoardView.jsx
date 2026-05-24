import React, { useState } from 'react'
import Board from '../components/Board'
import IntentPanel from '../components/IntentPanel'
import IntentDetail from '../components/IntentDetail'

/**
 * Board view: a narrower feed panel on the left for dragging,
 * and a wider canvas on the right. Same components as Live —
 * the difference is intent (the user is here to wire things up,
 * not to watch the feed).
 */
export default function BoardView() {
  const [detailIntent, setDetailIntent] = useState(null)
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <IntentPanel onInfo={setDetailIntent} defaultWidth={260} />
      <Board onInfo={setDetailIntent} />
      {detailIntent && (
        <IntentDetail intent={detailIntent} onClose={() => setDetailIntent(null)} />
      )}
    </div>
  )
}
