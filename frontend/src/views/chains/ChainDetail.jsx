import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Trash2, ExternalLink, GripVertical, Info, X } from 'lucide-react'
import { Chains } from '../../lib/api'
import { useStore } from '../../store'
import { formatTime, formatDelta, shortAction, isSystemIntent } from '../../utils'
import { useToast } from '../../components/Toast'
import Modal from '../../components/Modal'

/**
 * Detail panel — receives the active chain (full row from the chains list)
 * and fetches/renders its ordered members + handles edit/delete.
 */
export default function ChainDetail({ chain, onDeleted, onOpenInBoard, onInfo }) {
  const updateLocal = useStore(s => s.updateChainLocal)
  const removeLocal = useStore(s => s.removeChain)
  const toast = useToast()

  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [nameDraft, setNameDraft] = useState(chain.name)
  const [descDraft, setDescDraft] = useState(chain.description || '')

  // Fetch members whenever the active chain changes
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    Chains.members(chain.id)
      .then(rows => { if (!cancelled) setMembers(rows || []) })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(()  => { if (!cancelled) setLoading(false) })
    setNameDraft(chain.name)
    setDescDraft(chain.description || '')
    setEditingName(false); setEditingDesc(false)
    return () => { cancelled = true }
  }, [chain.id]) // intentional: depend on chain.id, not the whole obj

  // ── Name / description edits ─────────────────────────────────────────────
  const saveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === chain.name) { setEditingName(false); return }
    try {
      const updated = await Chains.update(chain.id, { name: trimmed })
      updateLocal(chain.id, updated)
      toast.success(`Renamed to "${updated.name}"`)
    } catch (err) {
      toast.error(`Rename failed: ${err.body || err.message}`)
      setNameDraft(chain.name)
    }
    setEditingName(false)
  }
  const saveDesc = async () => {
    if (descDraft === (chain.description || '')) { setEditingDesc(false); return }
    try {
      const updated = await Chains.update(chain.id, { description: descDraft })
      updateLocal(chain.id, updated)
      toast.success('Description updated')
    } catch (err) {
      toast.error(`Update failed: ${err.message}`)
      setDescDraft(chain.description || '')
    }
    setEditingDesc(false)
  }

  // ── Delete chain ─────────────────────────────────────────────────────────
  const onConfirmDelete = async () => {
    try {
      await Chains.remove(chain.id)
      removeLocal(chain.id)
      toast.success(`Chain "${chain.name}" deleted`)
      onDeleted?.()
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`)
    } finally {
      setConfirmDel(false)
    }
  }

  // ── Reorder members (drag-and-drop with position swap) ──────────────────
  const reorder = useCallback(async (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    // Optimistic reorder locally
    const next = [...members]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setMembers(next)

    // Reassign positions. Backend enforces uniqueness on (chain_id, position),
    // so we first push everything to a high temporary band, then renumber.
    try {
      const STAGING = 100_000
      // Step 1: stage all items above any real position
      await Promise.all(next.map((m, i) =>
        Chains.updateMember(chain.id, m.id, { position: STAGING + i })
      ))
      // Step 2: write final positions
      await Promise.all(next.map((m, i) =>
        Chains.updateMember(chain.id, m.id, { position: i + 1 })
      ))
      // Refresh from server to pick up canonical state
      const fresh = await Chains.members(chain.id)
      setMembers(fresh || [])
      toast.success('Reordered')
    } catch (err) {
      toast.error(`Reorder failed: ${err.message}`)
      // Restore from server
      const fresh = await Chains.members(chain.id).catch(() => null)
      if (fresh) setMembers(fresh)
    }
  }, [members, chain.id, toast])

  // ── Remove single member ────────────────────────────────────────────────
  const removeMember = async (memberId) => {
    try {
      await Chains.removeMember(chain.id, memberId)
      setMembers(ms => ms.filter(m => m.id !== memberId))
      toast.success('Step removed from chain')
    } catch (err) {
      toast.error(`Remove failed: ${err.message}`)
    }
  }

  // ── Update label ────────────────────────────────────────────────────────
  const updateLabel = async (memberId, label) => {
    try {
      const updated = await Chains.updateMember(chain.id, memberId, { label })
      setMembers(ms => ms.map(m => m.id === memberId ? { ...m, label: updated.label } : m))
    } catch (err) {
      toast.error(`Label update failed: ${err.message}`)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-2)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameDraft(chain.name); setEditingName(false) } }}
              style={{ fontFamily: 'var(--font-display)', fontSize: 20, padding: '4px 8px', width: '100%' }}
            />
          ) : (
            <h2
              onClick={() => setEditingName(true)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                color: 'var(--pink)',
                textShadow: '1.5px 1.5px 0 var(--teal-dim), 0 0 12px rgba(255,61,143,0.4)',
                letterSpacing: '0.04em',
                cursor: 'text',
                marginBottom: 8,
                fontWeight: 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title="Click to rename"
            >
              {chain.name.toUpperCase()}
            </h2>
          )}
          {editingDesc ? (
            <textarea
              autoFocus
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={e => { if (e.key === 'Escape') { setDescDraft(chain.description || ''); setEditingDesc(false) } }}
              placeholder="add a description…"
              style={{ width: '100%', minHeight: 50, fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'vertical' }}
            />
          ) : (
            <div
              onClick={() => setEditingDesc(true)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: chain.description ? 'var(--ink-dim)' : 'var(--ink-faint)',
                fontStyle: chain.description ? 'normal' : 'italic',
                cursor: 'text',
                padding: '3px 0',
                minHeight: 16,
              }}
              title="Click to edit description"
            >
              {chain.description || 'click to add description…'}
            </div>
          )}
          <div style={{
            marginTop: 8,
            display: 'flex',
            gap: 14,
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            color: 'var(--ink-faint)',
            letterSpacing: '0.06em',
          }}>
            <span>#{String(chain.id).padStart(4, '0')}</span>
            <span style={{ color: 'var(--teal)' }}>{members.length} INTENTS</span>
            <span>CREATED {chain.created_at?.slice(0, 10)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onOpenInBoard?.(chain.id, members)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            disabled={members.length === 0}
            title={members.length === 0 ? 'No members yet' : 'Open in Board'}
          >
            <ExternalLink size={11} strokeWidth={2} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.06em' }}>OPEN IN BOARD</span>
          </button>
          <button
            className="danger"
            onClick={() => setConfirmDel(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            title="Delete chain"
          >
            <Trash2 size={11} strokeWidth={2} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.06em' }}>DELETE</span>
          </button>
        </div>
      </div>

      {/* Members list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
        {loading && <SkeletonRows />}
        {!loading && error && (
          <div style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            Failed to load members: {error}
          </div>
        )}
        {!loading && !error && members.length === 0 && (
          <EmptyMembers />
        )}
        {!loading && members.length > 0 && (
          <MembersList
            members={members}
            onReorder={reorder}
            onRemove={removeMember}
            onUpdateLabel={updateLabel}
            onInfo={onInfo}
          />
        )}
      </div>

      {confirmDel && (
        <Modal
          title={`DELETE CHAIN`}
          onClose={() => setConfirmDel(false)}
          footer={<>
            <button onClick={() => setConfirmDel(false)}>cancel</button>
            <button className="danger primary" onClick={onConfirmDelete}
              style={{ background: 'var(--red)', borderColor: 'var(--red)', color: 'var(--bg)' }}>
              DELETE
            </button>
          </>}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>
            Delete <span style={{ color: 'var(--pink)' }}>"{chain.name}"</span> and all {members.length} step{members.length === 1 ? '' : 's'}?
            <div style={{ marginTop: 10, color: 'var(--ink-faint)', fontSize: 11 }}>
              The underlying intents in the database will not be deleted — only this chain and its membership records.
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Members list with drag-to-reorder ─────────────────────────────────────────

function MembersList({ members, onReorder, onRemove, onUpdateLabel, onInfo }) {
  const [dragIdx, setDragIdx]   = useState(null)
  const [overIdx, setOverIdx]   = useState(null)

  return (
    <div>
      {members.map((m, i) => {
        const prev = members[i - 1]
        const delta = prev && prev.enqueue_time && m.enqueue_time
          ? formatDelta(prev.enqueue_time, m.enqueue_time)
          : null

        return (
          <React.Fragment key={m.id}>
            {/* drop-zone indicator above this row */}
            {overIdx === i && dragIdx !== null && dragIdx !== i && (
              <div style={{
                height: 2,
                background: 'var(--pink)',
                boxShadow: 'var(--glow-pink-sm)',
                margin: '4px 0',
              }} />
            )}
            <MemberRow
              member={m}
              index={i}
              delta={delta}
              dragging={dragIdx === i}
              onDragStart={() => setDragIdx(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
              onDragEnter={() => setOverIdx(i)}
              onDrop={() => {
                if (dragIdx !== null) onReorder(dragIdx, i)
                setDragIdx(null); setOverIdx(null)
              }}
              onRemove={() => onRemove(m.id)}
              onUpdateLabel={(label) => onUpdateLabel(m.id, label)}
              onInfo={() => onInfo?.({
                id: m.intent_id,
                action: m.action,
                sender_package: m.sender_package,
                target_component: m.target_component,
                enqueue_time: m.enqueue_time,
              })}
            />
          </React.Fragment>
        )
      })}
    </div>
  )
}

function MemberRow({
  member, index, delta,
  dragging,
  onDragStart, onDragEnd, onDragEnter, onDrop,
  onRemove, onUpdateLabel, onInfo,
}) {
  const isSystem = isSystemIntent({ sender_package: member.sender_package })
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(member.label || '')
  useEffect(() => setLabelDraft(member.label || ''), [member.label])

  const saveLabel = () => {
    setEditingLabel(false)
    if (labelDraft !== (member.label || '')) onUpdateLabel(labelDraft)
  }

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
      style={{
        opacity: dragging ? 0.4 : 1,
        display: 'grid',
        gridTemplateColumns: '20px 38px 1fr 60px 56px',
        gap: 12,
        alignItems: 'center',
        padding: '10px 8px',
        borderBottom: '1px dotted var(--line)',
        background: dragging ? 'var(--pink-mist)' : 'transparent',
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = 'var(--pink-mist)' }}
      onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Drag handle */}
      <div style={{ cursor: 'grab', color: 'var(--ink-faint)', display: 'flex', justifyContent: 'center' }}
        title="Drag to reorder">
        <GripVertical size={14} strokeWidth={1.5} />
      </div>

      {/* Position */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 11,
        color: 'var(--orange)',
        textShadow: 'var(--glow-orange)',
        letterSpacing: '0.05em',
        textAlign: 'center',
      }}>{String(index + 1).padStart(2, '0')}</div>

      {/* Content */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 500,
          color: isSystem ? 'var(--ink-dim)' : 'var(--ink)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: 2,
        }}>
          {shortAction(member.action) || '(no action)'}
        </div>
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-faint)',
        }}>
          <span style={{
            color: isSystem ? 'var(--ink-faint)' : 'var(--teal)',
            textShadow: isSystem ? 'none' : 'var(--text-glow-teal)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 220,
          }}>
            {member.sender_package || '(system)'}
          </span>
          <span style={{ color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(member.enqueue_time)}
          </span>
          <span style={{ color: 'var(--ink-trace)' }}>·</span>
          {editingLabel ? (
            <input
              autoFocus
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={e => {
                if (e.key === 'Enter') saveLabel()
                if (e.key === 'Escape') { setLabelDraft(member.label || ''); setEditingLabel(false) }
              }}
              placeholder="label…"
              style={{ fontSize: 10, padding: '1px 4px', minWidth: 0, width: 160 }}
            />
          ) : (
            <span
              onClick={() => setEditingLabel(true)}
              style={{
                color: member.label ? 'var(--pink)' : 'var(--ink-faint)',
                cursor: 'text',
                fontStyle: member.label ? 'normal' : 'italic',
                textShadow: member.label ? 'var(--text-glow-pink)' : 'none',
              }}
              title="Click to edit annotation"
            >
              {member.label || 'add label…'}
            </span>
          )}
        </div>
      </div>

      {/* Delta from previous */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 9,
        color: delta ? 'var(--teal)' : 'var(--ink-trace)',
        textShadow: delta ? 'var(--text-glow-teal)' : 'none',
        textAlign: 'right',
        letterSpacing: '0.04em',
      }}>
        {delta || 'START'}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button
          className="ghost"
          onClick={onInfo}
          style={{ padding: 4, border: '1px solid var(--line)' }}
          title="View intent details"
        >
          <Info size={11} strokeWidth={2} />
        </button>
        <button
          className="ghost danger"
          onClick={onRemove}
          style={{ padding: 4, border: '1px solid var(--line)' }}
          title="Remove from chain"
        >
          <X size={11} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

// ── Empty / skeleton states ──────────────────────────────────────────────────

function EmptyMembers() {
  return (
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
      }}>· · ·</div>
      <div style={{ marginBottom: 6 }}>This chain has no steps yet.</div>
      <div style={{ color: 'var(--ink-trace)', fontSize: 10 }}>
        Drop intents on the board and draw connections to add them here.
      </div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '20px 38px 1fr 60px 56px',
          gap: 12,
          padding: '10px 8px',
          borderBottom: '1px dotted var(--line)',
          opacity: 1 - i * 0.25,
        }}>
          <div style={{ height: 12, background: 'var(--paper)', borderRadius: 2 }} />
          <div style={{ height: 12, background: 'var(--paper)', borderRadius: 2 }} />
          <div style={{ height: 12, background: 'var(--paper)', borderRadius: 2 }} />
          <div style={{ height: 12, background: 'var(--paper)', borderRadius: 2 }} />
          <div style={{ height: 12, background: 'var(--paper)', borderRadius: 2 }} />
        </div>
      ))}
    </div>
  )
}
