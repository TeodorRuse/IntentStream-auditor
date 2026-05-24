import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Info, X } from 'lucide-react'
import { useStore } from '../store'
import { formatTime, shortAction, isSystemIntent } from '../utils'
import { Chains } from '../lib/api'

const NODE_W = 210
const NODE_H = 78
const CONN_Y_OFFSET = NODE_H / 2

function connectorPos(node, side) {
  return {
    x: side === 'left' ? node.x : node.x + NODE_W,
    y: node.y + CONN_Y_OFFSET,
  }
}

// ── Connector dot ─────────────────────────────────────────────────────────────
function ConnectorDot({ side, node, onStartConnect, isSource }) {
  const pos = side === 'left'
    ? { left: -7, top: CONN_Y_OFFSET - 6 }
    : { right: -7, top: CONN_Y_OFFSET - 6 }

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onStartConnect(node.id, side, e) }}
      title={`Connect from ${side}`}
      style={{
        position: 'absolute',
        ...pos,
        width: 12, height: 12,
        borderRadius: '50%',
        background: isSource ? 'var(--pink)' : 'var(--bg)',
        border: '2px solid var(--pink)',
        cursor: 'crosshair',
        zIndex: 10,
        boxShadow: isSource ? 'var(--glow-pink)' : 'var(--glow-pink-sm)',
        transition: 'all 100ms',
      }}
    />
  )
}

// ── Board node ────────────────────────────────────────────────────────────────
function BoardNode({ node, intent, onMove, onInfo, onStartConnect, onEndConnect, connectingFrom }) {
  const removeNode = useStore(s => s.removeNode)
  const isSystem   = isSystemIntent(intent)
  const dragRef    = useRef({ active: false, ox: 0, oy: 0 })
  const [hovered, setHovered] = useState(false)
  const isSource = connectingFrom?.nodeId === node.id
  const isTarget = connectingFrom && !isSource

  const onMouseDown = (e) => {
    if (e.target.dataset.connector) return
    e.stopPropagation()
    dragRef.current = { active: true, ox: e.clientX - node.x, oy: e.clientY - node.y }

    const onMove_ = (me) => {
      if (!dragRef.current.active) return
      onMove(node.id, me.clientX - dragRef.current.ox, me.clientY - dragRef.current.oy)
    }
    const onUp_ = () => {
      dragRef.current.active = false
      window.removeEventListener('mousemove', onMove_)
      window.removeEventListener('mouseup', onUp_)
    }
    window.addEventListener('mousemove', onMove_)
    window.addEventListener('mouseup', onUp_)
  }

  const onMouseUp = (e) => {
    if (connectingFrom && isTarget) {
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      const midX = rect.left + NODE_W / 2
      const side = e.clientX < midX ? 'left' : 'right'
      onEndConnect(node.id, side)
    }
  }

  const borderColor = isTarget && hovered ? 'var(--pink)'
                    : hovered ? 'var(--line-2)'
                    : 'var(--line-2)'

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: node.x, top: node.y,
        width: NODE_W, height: NODE_H,
        background: 'var(--paper)',
        border: `1px solid ${borderColor}`,
        borderLeft: '3px solid var(--pink)',
        borderRadius: 'var(--radius-md)',
        boxShadow: isTarget && hovered
          ? 'var(--glow-pink), 0 6px 18px rgba(0,0,0,0.45)'
          : hovered
            ? '0 6px 24px rgba(0,0,0,0.5), 0 0 0 1px var(--line-2)'
            : '0 2px 10px rgba(0,0,0,0.4)',
        cursor: connectingFrom ? (isTarget ? 'crosshair' : 'not-allowed') : 'move',
        userSelect: 'none',
        zIndex: hovered ? 20 : 2,
        transition: 'box-shadow 120ms, border-color 120ms',
      }}
    >
      <ConnectorDot side="left" node={node} onStartConnect={onStartConnect}
        isSource={isSource && connectingFrom.side === 'left'} />

      {/* Header */}
      <div style={{
        padding: '6px 8px',
        borderBottom: '1px dotted var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 8,
          color: 'var(--orange)',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}>#{intent.id}</span>
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 500,
          color: isSystem ? 'var(--ink-dim)' : 'var(--ink)',
        }}>
          {shortAction(intent.action)}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onInfo(intent) }}
          className="ghost"
          style={{ padding: '2px 4px', border: '1px solid var(--line)', flexShrink: 0 }}>
          <Info size={10} strokeWidth={2} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); removeNode(node.id) }}
          className="ghost danger"
          style={{ padding: '2px 4px', border: '1px solid var(--line)', flexShrink: 0 }}>
          <X size={10} strokeWidth={2} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '5px 9px 7px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          color: isSystem ? 'var(--ink-faint)' : 'var(--teal)',
          textShadow: isSystem ? 'none' : 'var(--text-glow-teal)',
          fontSize: 10,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 3,
        }}>
          {intent.sender_package || '(system)'}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--ink-faint)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(intent.enqueue_time || intent.poll_time)}
        </div>
      </div>

      <ConnectorDot side="right" node={node} onStartConnect={onStartConnect}
        isSource={isSource && connectingFrom.side === 'right'} />
    </div>
  )
}

// ── Edge label ────────────────────────────────────────────────────────────────
function EdgeLabel({ edge, mx, my, onChange, onRemove }) {
  const [editing, setEditing] = useState(!edge.label)
  const ref = useRef(null)
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  return (
    <foreignObject x={mx - 80} y={my - 14} width={160} height={28} style={{ overflow: 'visible' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--bg-2)',
        border: '1px solid var(--pink-dim)',
        borderRadius: 'var(--radius-sm)',
        padding: '3px 6px',
        fontSize: 10,
        boxShadow: 'var(--glow-pink-sm)',
      }}>
        {editing ? (
          <input ref={ref} defaultValue={edge.label}
            onBlur={e => { onChange(e.target.value); setEditing(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { onChange(e.target.value); setEditing(false) } }}
            style={{ flex: 1, fontSize: 10, padding: '1px 3px', minWidth: 0, border: 0, background: 'transparent' }}
            placeholder="annotate…" />
        ) : (
          <span onClick={() => setEditing(true)} style={{
            flex: 1,
            color: 'var(--ink)',
            cursor: 'text',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {edge.label || <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>add note…</span>}
          </span>
        )}
        <span onClick={onRemove} style={{
          color: 'var(--ink-faint)',
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: 1,
          padding: '0 2px',
        }}>×</span>
      </div>
    </foreignObject>
  )
}

// ── SVG edge ──────────────────────────────────────────────────────────────────
function Edge({ edge, nodes, intents, updateEdgeLabel, removeEdge }) {
  const srcNode = nodes.find(n => n.id === edge.sourceNodeId)
  const dstNode = nodes.find(n => n.id === edge.targetNodeId)
  if (!srcNode || !dstNode) return null

  const src = connectorPos(srcNode, edge.sourceSide)
  const dst = connectorPos(dstNode, edge.targetSide)

  const dx   = Math.abs(dst.x - src.x)
  const pull = Math.max(60, dx * 0.5)
  const cx1  = src.x + (edge.sourceSide === 'right' ? pull : -pull)
  const cx2  = dst.x + (edge.targetSide === 'right' ? pull : -pull)
  const mx   = (src.x + dst.x) / 2
  const my   = (src.y + dst.y) / 2

  const srcIntent = intents.find(i => `node-${i.id}` === edge.sourceNodeId)
  const dstIntent = intents.find(i => `node-${i.id}` === edge.targetNodeId)
  let delta = ''
  if (srcIntent?.enqueue_time && dstIntent?.enqueue_time) {
    const diff = Math.abs(
      new Date(dstIntent.enqueue_time.replace(' ', 'T')) -
      new Date(srcIntent.enqueue_time.replace(' ', 'T'))
    )
    delta = diff < 1000 ? `${diff}MS` : `${(diff / 1000).toFixed(2)}S`
  }

  const path = `M${src.x},${src.y} C${cx1},${src.y} ${cx2},${dst.y} ${dst.x},${dst.y}`

  return (
    <g>
      <path d={path} fill="none" stroke="transparent" strokeWidth={14}
        style={{ cursor: 'pointer' }} onClick={() => removeEdge(edge.id)} />
      <path d={path} fill="none" stroke="var(--pink)" strokeWidth={1.5}
        strokeOpacity={0.85} markerEnd="url(#arrow)" style={{ filter: 'drop-shadow(0 0 3px rgba(255,61,143,0.6))' }} />
      <circle cx={src.x} cy={src.y} r={3} fill="var(--pink)" />
      <circle cx={dst.x} cy={dst.y} r={3} fill="var(--pink)" />
      {delta && (
        <text x={mx} y={my - 22} textAnchor="middle"
          fill="var(--teal)" fontSize={9}
          fontFamily="Silkscreen, monospace"
          style={{ filter: 'drop-shadow(0 0 4px rgba(0,229,255,0.6))' }}>
          {delta}
        </text>
      )}
      <EdgeLabel edge={edge} mx={mx} my={my}
        onChange={label => updateEdgeLabel(edge.id, label)}
        onRemove={() => removeEdge(edge.id)} />
    </g>
  )
}

// ── Board ─────────────────────────────────────────────────────────────────────
export default function Board({ onInfo }) {
  const intents         = useStore(s => s.intents)
  const boardNodes      = useStore(s => s.boardNodes)
  const boardEdges      = useStore(s => s.boardEdges)
  const addBoardNode    = useStore(s => s.addBoardNode)
  const moveBoardNode   = useStore(s => s.moveBoardNode)
  const addBoardEdge    = useStore(s => s.addBoardEdge)
  const updateEdgeLabel = useStore(s => s.updateEdgeLabel)
  const removeEdge      = useStore(s => s.removeEdge)
  const addChain        = useStore(s => s.addChain)

  const [connectingFrom, setConnectingFrom] = useState(null)
  const [wireEnd, setWireEnd]               = useState(null)
  const boardRef = useRef(null)

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const intentId = parseInt(e.dataTransfer.getData('intentId'), 10)
    if (!intentId) return
    const intent = intents.find(i => i.id === intentId)
    if (!intent) return
    const rect = boardRef.current.getBoundingClientRect()
    addBoardNode(intent, e.clientX - rect.left - NODE_W / 2, e.clientY - rect.top - NODE_H / 2)
  }, [intents, addBoardNode])

  const onStartConnect = useCallback((nodeId, side, e) => {
    e.preventDefault()
    setConnectingFrom({ nodeId, side })
    setWireEnd(null)
  }, [])

  const onEndConnect = useCallback(async (targetNodeId, targetSide) => {
    if (!connectingFrom || targetNodeId === connectingFrom.nodeId) {
      setConnectingFrom(null); setWireEnd(null); return
    }

    const sourceIntentId = parseInt(connectingFrom.nodeId.replace('node-', ''), 10)
    const targetIntentId = parseInt(targetNodeId.replace('node-', ''), 10)

    // Reuse a chain already touching either of these nodes
    const existingChainId = (() => {
      const nodeIds = new Set([connectingFrom.nodeId, targetNodeId])
      for (const edge of boardEdges) {
        if (nodeIds.has(edge.sourceNodeId) || nodeIds.has(edge.targetNodeId)) {
          if (edge.chainId) return edge.chainId
        }
      }
      return null
    })()

    let chainId = existingChainId
    try {
      if (!chainId) {
        const chain = await Chains.create(`Chain ${new Date().toISOString().slice(11,19)}`, '')
        chainId = chain.id
        addChain(chain)
      }
      // Each edge contributes two members at distinct positions
      // — positions are forgiving (backend only errors on exact clashes)
      const basePos = Date.now() % 100000
      await Promise.allSettled([
        Chains.addIntent(chainId, sourceIntentId, basePos),
        Chains.addIntent(chainId, targetIntentId, basePos + 1),
      ])
    } catch (err) {
      console.warn('Chain API error (drawing edge anyway):', err)
    }

    addBoardEdge(
      connectingFrom.nodeId, connectingFrom.side,
      targetNodeId, targetSide,
      chainId
    )

    setConnectingFrom(null)
    setWireEnd(null)
  }, [connectingFrom, boardEdges, addBoardEdge, addChain])

  useEffect(() => {
    if (!connectingFrom) return
    const onMouseMove = (e) => {
      const rect = boardRef.current?.getBoundingClientRect()
      if (!rect) return
      setWireEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    const onMouseUp = () => { setConnectingFrom(null); setWireEnd(null) }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [connectingFrom])

  const liveWirePath = (() => {
    if (!connectingFrom || !wireEnd) return null
    const srcNode = boardNodes.find(n => n.id === connectingFrom.nodeId)
    if (!srcNode) return null
    const src  = connectorPos(srcNode, connectingFrom.side)
    const pull = Math.max(60, Math.abs(wireEnd.x - src.x) * 0.5)
    const cx1  = src.x + (connectingFrom.side === 'right' ? pull : -pull)
    return `M${src.x},${src.y} C${cx1},${src.y} ${wireEnd.x},${wireEnd.y} ${wireEnd.x},${wireEnd.y}`
  })()

  return (
    <div
      ref={boardRef}
      className="bg-grid"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => { if (connectingFrom) { setConnectingFrom(null); setWireEnd(null) } }}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg)',
        cursor: connectingFrom ? 'crosshair' : 'default',
      }}
    >
      {boardNodes.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-faint)',
          pointerEvents: 'none',
          gap: 10,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            color: 'var(--pink-dim)',
            textShadow: 'var(--glow-pink-sm)',
            opacity: 0.7,
          }}>◇◆◇</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            color: 'var(--ink-dim)',
            letterSpacing: '0.08em',
          }}>DRAG INTENTS HERE</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-faint)',
            opacity: 0.7,
          }}>
            use the pink dots on each node to draw connections
          </div>
        </div>
      )}

      {/* SVG layer */}
      <svg style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 1, overflow: 'visible',
      }}>
        <defs>
          <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="var(--pink)" fillOpacity={0.9} />
          </marker>
        </defs>

        {boardEdges.map(edge => (
          <Edge key={edge.id} edge={edge} nodes={boardNodes} intents={intents}
            updateEdgeLabel={updateEdgeLabel} removeEdge={removeEdge} />
        ))}

        {liveWirePath && (
          <path d={liveWirePath} fill="none" stroke="var(--pink)"
            strokeWidth={2} strokeDasharray="6 3" strokeOpacity={0.95}
            style={{ filter: 'drop-shadow(0 0 4px rgba(255,61,143,0.7))' }} />
        )}
      </svg>

      {/* Node layer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        {boardNodes.map(node => {
          const intent = intents.find(i => i.id === node.intentId)
          if (!intent) return null
          return (
            <BoardNode key={node.id} node={node} intent={intent}
              onMove={moveBoardNode} onInfo={onInfo}
              onStartConnect={onStartConnect}
              onEndConnect={onEndConnect}
              connectingFrom={connectingFrom} />
          )
        })}
      </div>
    </div>
  )
}
