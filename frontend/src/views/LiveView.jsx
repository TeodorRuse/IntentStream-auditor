import React, { useState } from 'react'
import IntentPanel from '../components/IntentPanel'
import Board from '../components/Board'
import IntentDetail from '../components/IntentDetail'

export default function LiveView() {
  const [detailIntent, setDetailIntent] = useState(null)
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <IntentPanel onInfo={setDetailIntent} />
      <Board onInfo={setDetailIntent} />
      {detailIntent && (
        <IntentDetail intent={detailIntent} onClose={() => setDetailIntent(null)} />
      )}
    </div>
  )
}
