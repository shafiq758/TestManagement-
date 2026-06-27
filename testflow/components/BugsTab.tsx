'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import MentionInput from '@/components/MentionInput'
import AttachmentUploader, { type Attachment } from '@/components/AttachmentUploader'
import type { Bug, BugSeverity, BugStatus, Priority, WorkspaceRole } from '@/types'

const SEVERITY_CFG: Record<BugSeverity, {label:string;bg:string;color:string}> = {
  critical: {label:'Critical', bg:'#fef2f2', color:'#b91c1c'},
  high:     {label:'High',     bg:'#fff7ed', color:'#c2410c'},
  medium:   {label:'Medium',   bg:'#fffbeb', color:'#d97706'},
  low:      {label:'Low',      bg:'#f0fdf4', color:'#15803d'},
}
const STATUS_CFG: Record<BugStatus, {label:string;bg:string;color:string}> = {
  open:        {label:'Open',        bg:'#fef2f2', color:'#dc2626'},
  in_progress: {label:'In Progress', bg:'#eff6ff', color:'#2563eb'},
  resolved:    {label:'Resolved',    bg:'#f0fdf4', color:'#15803d'},
  closed:      {label:'Closed',      bg:'#f3f4f6', color:'#374151'},
  wont_fix:    {label:"Won't Fix",   bg:'#faf5ff', color:'#7c3aed'},
}
const PRIORITY_CFG: Record<Priority, {label:string;bg:string;color:string}> = {
  high:   {label:'High',   bg:'#fef2f2', color:'#dc2626'},
  medium: {label:'Medium', bg:'#fffbeb', color:'#d97706'},
  low:    {label:'Low',    bg:'#f0fdf4', color:'#15803d'},
}

function SeverityBadge({ s }: { s: BugSeverity }) {
  const c = SEVERITY_CFG[s]
  return <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{c.label}</span>
}
function StatusBadge({ s }: { s: BugStatus }) {
  const c = STATUS_CFG[s]
  return <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{c.label}</span>
}

function Modal({ title, onClose, children, width = 560 }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', width: '100%', maxWidth: width, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>×</button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children, required }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const sel: React.CSSProperties = { ...inp, cursor: 'pointer', background: '#fff' }

export default function BugsTab({ bugs, projectId, sprints, testRuns, testCases, canEdit, onRefresh, onViewBug, members = [] }: {
  bugs: Bug[]; projectId: string; sprints: any[]; testRuns: any[]; testCases: any[]
  canEdit: boolean; onRefresh: () => void; onViewBug: (b: Bug) => void
  members?: any[]
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Bug | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [search, setSearch] = useState('')
  const sb = createClient()

  const emptyForm = {
    title: '', description: '', steps: '', expected_result: '', actual_result: '',
    severity: 'medium' as BugSeverity, status: 'open' as BugStatus, priority: 'medium' as Priority,
    sprint_id: '', test_run_id: '', test_case_id: '', attachments: [] as Attachment[],
  }
  const [form, setForm] = useState(emptyForm)
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const openCreate = () => { setForm(emptyForm); setEditing(null); setShowModal(true) }
  const openEdit = (b: Bug) => {
    setForm({
      title: b.title, description: b.description, steps: b.steps,
      expected_result: b.expected_result, actual_result: b.actual_result,
      severity: b.severity, status: b.status, priority: b.priority,
      sprint_id: b.sprint_id || '', test_run_id: b.test_run_id || '',
      test_case_id: b.test_case_id || '',
      attachments: (b.attachments || []).map((url, i) => ({
        url, name: `attachment-${i+1}`,
        type: (url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image') as 'image' | 'video',
      })),
    })
    setEditing(b); setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return
    const { data: { session } } = await sb.auth.getSession()
    const payload = {
      title: form.title.trim(), description: form.description, steps: form.steps,
      expected_result: form.expected_result, actual_result: form.actual_result,
      severity: form.severity, status: form.status, priority: form.priority,
      project_id: projectId,
      sprint_id: form.sprint_id || null, test_run_id: form.test_run_id || null,
      test_case_id: form.test_case_id || null,
      attachments: form.attachments.map(a => a.url),
      created_by: session?.user?.id,
    }

    let bugId = editing?.id || ''
    if (editing) {
      await sb.from('bugs').update(payload).eq('id', editing.id)
    } else {
      // Get the new bug's ID for the notification link
      const { data: newBug } = await sb.from('bugs').insert(payload).select().single()
      bugId = newBug?.id || ''
    }

    // Send mention notifications with correct redirect link
    const mentionText = [form.description, form.steps, form.expected_result, form.actual_result].join(' ')
    if (mentionText.includes('@') && session && bugId) {
      try {
        const { data: projData } = await sb.from('projects').select('workspace_id').eq('id', projectId).single()
        if (projData) {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: mentionText, projectId, type: 'mention',
              link: `/dashboard/${projectId}?open=bug&id=${bugId}`,
              createdBy: session.user.id,
              workspaceId: projData.workspace_id,
            }),
          })
        }
      } catch(e) { console.error('Notification error:', e) }
    }

    setShowModal(false); onRefresh()
  }

  const del = async (id: string) => {
    if (!confirm('Delete this bug?')) return
    await sb.from('bugs').delete().eq('id', id)
    onRefresh()
  }

  const filtered = bugs.filter(b => {
    const matchSearch = !search || b.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || b.status === filterStatus
    const matchSeverity = !filterSeverity || b.severity === filterSeverity
    return matchSearch && matchStatus && matchSeverity
  })

  const btnStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 12px', fontSize: 13, background: '#fff', cursor: 'pointer' }
  const smBtn: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 12, background: '#fff', cursor: 'pointer' }
  const selStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 10px', fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bugs…"
            style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 10px', fontSize: 12, outline: 'none', width: 180 }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={selStyle}>
            <option value="">All severities</option>
            {Object.entries(SEVERITY_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>{filtered.length} bug{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {canEdit && <button onClick={openCreate} style={btnStyle}>🐛 Report bug</button>}
      </div>

      {bugs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 32, margin: '0 0 10px' }}>🐛</p>
          <p style={{ fontWeight: 500, margin: '0 0 6px' }}>No bugs reported yet</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Track bugs and link them to test cases and runs.</p>
          {canEdit && <button onClick={openCreate} style={btnStyle}>🐛 Report first bug</button>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(bug => {
          const sprint = sprints.find(s => s.id === bug.sprint_id)
          const run = testRuns.find(r => r.id === bug.test_run_id)
          const tc = testCases.find(c => c.id === bug.test_case_id)
          const imgCount = (bug.attachments || []).filter(u => !u.match(/\.(mp4|webm|mov)$/i)).length
          const vidCount = (bug.attachments || []).length - imgCount
          return (
            <div key={bug.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <button onClick={() => onViewBug(bug)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: 14, color: '#111', textDecoration: 'underline', textDecorationColor: '#d1d5db', fontFamily: 'inherit', textAlign: 'left' }}>
                      {bug.title}
                    </button>
                    <SeverityBadge s={bug.severity} />
                    <StatusBadge s={bug.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#9ca3af', flexWrap: 'wrap' }}>
                    {sprint && <span>🏃 {sprint.name}</span>}
                    {run && <span>▶ {run.name}</span>}
                    {tc && <span>🧪 {tc.title}</span>}
                    {imgCount > 0 && <span>🖼 {imgCount} image{imgCount !== 1 ? 's' : ''}</span>}
                    {vidCount > 0 && <span>🎬 {vidCount} video{vidCount !== 1 ? 's' : ''}</span>}
                    <span>{new Date(bug.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => openEdit(bug)} style={smBtn}>Edit</button>
                    <button onClick={() => del(bug.id)} style={smBtn}>✕</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit bug' : 'Report bug'} onClose={() => setShowModal(false)}>
          <Field label="Title" required>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Brief summary of the bug" autoFocus style={inp} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>Severity</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)} style={sel}>
                {Object.entries(SEVERITY_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} style={sel}>
                {Object.entries(PRIORITY_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={sel}>
                {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>Sprint (optional)</label>
              <select value={form.sprint_id} onChange={e => { set('sprint_id', e.target.value); set('test_run_id', '') }} style={sel}>
                <option value="">None</option>
                {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>Test run (optional)</label>
              <select value={form.test_run_id} onChange={e => set('test_run_id', e.target.value)} style={sel}>
                <option value="">None</option>
                {testRuns.filter(r => !form.sprint_id || r.sprint_id === form.sprint_id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <Field label="Linked test case (optional)">
            <select value={form.test_case_id} onChange={e => set('test_case_id', e.target.value)} style={sel}>
              <option value="">None</option>
              {testCases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <MentionInput value={form.description} onChange={val => set('description', val)} members={members} placeholder="What went wrong? Type @ to mention someone" rows={3} />
          </Field>
          <Field label="Steps to reproduce">
            <textarea value={form.steps} onChange={e => set('steps', e.target.value)} placeholder={"1. Go to...\n2. Click...\n3. Observe..."} rows={4} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Field label="Expected result">
              <textarea value={form.expected_result} onChange={e => set('expected_result', e.target.value)} placeholder="What should happen?" rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Actual result">
              <textarea value={form.actual_result} onChange={e => set('actual_result', e.target.value)} placeholder="What actually happened?" rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
          </div>
          <Field label="Attachments (images & videos up to 25MB)">
            <AttachmentUploader attachments={form.attachments} onChange={atts => set('attachments', atts)} folder="bugs" />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={() => setShowModal(false)} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={!form.title.trim()}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: form.title.trim() ? 'pointer' : 'not-allowed', opacity: form.title.trim() ? 1 : 0.5 }}>
              {editing ? 'Save changes' : 'Report bug'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
