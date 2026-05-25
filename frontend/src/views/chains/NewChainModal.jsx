import React, { useState } from 'react'
import Modal from '../../components/Modal'
import { Chains } from '../../lib/api'
import { useStore } from '../../store'
import { useToast } from '../../components/Toast'

export default function NewChainModal({ onClose, onCreated }) {
  const addChain = useStore(s => s.addChain)
  const toast = useToast()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { toast.error('Name is required'); return }
    setSubmitting(true)
    try {
      const chain = await Chains.create(trimmed, desc.trim() || null)
      addChain(chain)
      toast.success(`Chain "${chain.name}" created`)
      onCreated?.(chain)
      onClose()
    } catch (err) {
      const msg = err.status === 409 ? 'A chain with that name already exists' : err.message
      toast.error(`Create failed: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="NEW.CHAIN"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} disabled={submitting}>cancel</button>
        <button className="primary" onClick={submit} disabled={submitting || !name.trim()}>
          {submitting ? 'CREATING…' : 'CREATE'}
        </button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="NAME"
          hint="A short, unique label — e.g. 'Spotify boot sequence'"
        >
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) submit() }}
            placeholder="chain name"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
            maxLength={255}
          />
        </Field>
        <Field
          label="DESCRIPTION"
          hint="Optional — describe what this chain captures."
        >
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="optional notes…"
            style={{ width: '100%', minHeight: 76, fontSize: 11, padding: '8px 10px', resize: 'vertical' }}
          />
        </Field>
      </div>
    </Modal>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 9,
        color: 'var(--orange)',
        letterSpacing: '0.06em',
        marginBottom: 4,
        textShadow: 'var(--glow-orange)',
      }}>{label}</div>
      {children}
      {hint && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-faint)',
          marginTop: 4,
          fontStyle: 'italic',
        }}>{hint}</div>
      )}
    </div>
  )
}
