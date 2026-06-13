'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Milestone, MilestoneStatus } from '@/types'

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; bg: string; color: string }> = {
  open:        { label: 'Open',        bg: '#f3f4f6', color: '#374151' },
  in_progress: { label: 'In Progress', bg: '#dbeafe', color: '#1e40af' },
  closed:      { label: 'Closed',      bg: '#d1fae5', color: '#065f46' },
}

function Badge({ status }: { status: MilestoneStatus }) {
  const c = STATUS_CONFIG[status]
  return <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{c.label}</span>
}

function Modal({ title, onClose, children }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>×</button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

export default function MilestonesTab({ milestones, projectId, onRefresh, canEdit, onViewMilestone }: {
  milestones: Milestone[]; projectId: string; onRefresh: () => void; canEdit: boolean; onViewMilestone: (m: Milestone) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Milestone | null>(null)
  const [form, setForm] = useState({ name: '', description: '', status: 'open' as MilestoneStatus, due_date: '' })
  const sb = createClient()

  const openCreate = () => { setForm({ name: '', description: '', status: 'open', due_date: '' }); setEditing(null); setShowModal(true) }
  const openEdit = (m: Milestone) => { setForm({ name: m.name, description: m.description, status: m.status, due_date: m.due_date || '' }); setEditing(m); setShowModal(true) }

  const save = async () => {
    if (!form.name.trim()) return
    if (editing) {
      await sb.from('milestones').update({ ...form, due_date: form.due_date || null }).eq('id', editing.id)
    } else {
      await sb.from('milestones').insert({ ...form, due_date: form.due_date || null, project_id: projectId })
    }
    setShowModal(false); onRefresh()
  }

  const del = async (id: string) => {
    if (!confirm('Delete this milestone?')) return
    await sb.from('milestones').delete().eq('id', id)
    onRefresh()
  }

  const inp = (field: string) => ({
    style: { width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
    value: (form as any)[field],
    onChange: (e: any) => setForm(p => ({ ...p, [field]: e.target.value })),
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</p>
        {canEdit && <button onClick={openCreate} style={btnStyle}>+ Add milestone</button>}
      </div>

      {milestones.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 28, margin: '0 0 10px' }}>🎯</p>
          <p style={{ fontWeight: 500, margin: '0 0 6px' }}>No milestones yet</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Milestones group sprints toward a larger goal.</p>
          {canEdit && <button onClick={openCreate} style={btnStyle}>+ Add milestone</button>}
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {milestones.map(m => (
          <div key={m.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <button onClick={() => onViewMilestone(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: 14, color: '#111', textDecoration: 'underline', textDecorationColor: '#d1d5db', fontFamily: 'inherit' }}>{m.name}</button>
                  <Badge status={m.status} />
                </div>
                {m.description && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#6b7280' }}>{m.description}</p>}
                {m.due_date && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Due {new Date(m.due_date).toLocaleDateString()}</p>}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(m)} style={smBtn}>Edit</button>
                  <button onClick={() => del(m.id)} style={smBtn}>✕</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit milestone' : 'New milestone'} onClose={() => setShowModal(false)}>
          <Field label="Name"><input {...inp('name')} placeholder="Milestone name" autoFocus /></Field>
          <Field label="Description"><textarea {...inp('description')} placeholder="What does this milestone achieve?" rows={3} style={{ ...inp('description').style, resize: 'vertical', fontFamily: 'inherit' }} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as MilestoneStatus }))}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Due date"><input {...inp('due_date')} type="date" /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowModal(false)} style={smBtn}>Cancel</button>
            <button onClick={save} style={{ ...smBtn, background: '#111', color: '#fff', border: 'none' }}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 12px', fontSize: 13, background: '#fff', cursor: 'pointer' }
const smBtn: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 12, background: '#fff', cursor: 'pointer' }
