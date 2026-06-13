'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { canEditCases, canExecuteRuns } from '@/lib/roles'
import type { Project, Section, TestCase, TestRun, Priority, CaseType, RunStatus, WorkspaceRole } from '@/types'

// ─── UI primitives ────────────────────────────────────────────────────────────

function Btn({ children, onClick, primary, sm, disabled, style = {} }: any) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        border: primary ? 'none' : '1px solid #d1d5db',
        borderRadius: 7, padding: sm ? '5px 10px' : '7px 14px',
        fontSize: sm ? 12 : 13, fontWeight: primary ? 500 : 400,
        background: primary ? '#111' : '#fff', color: primary ? '#fff' : '#374151',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap', ...style,
      }}>{children}</button>
  )
}

function Inp({ value, onChange, placeholder, type = 'text', onKeyDown, autoFocus, style = {} }: any) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      type={type} onKeyDown={onKeyDown} autoFocus={autoFocus}
      style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', width: '100%', background: '#fff', ...style }} />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: any) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', width: '100%', resize: 'vertical', background: '#fff', fontFamily: 'inherit' }} />
  )
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
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

function Modal({ title, onClose, children, width = 500 }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  )
}

function Badge({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return <span style={{ background: color, color: textColor, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5 }}>{label}</span>
}

const PRIORITY_BADGE: Record<Priority, any> = {
  high: { label: 'High', color: '#fef2f2', textColor: '#dc2626' },
  medium: { label: 'Medium', color: '#fffbeb', textColor: '#d97706' },
  low: { label: 'Low', color: '#f0fdf4', textColor: '#16a34a' },
}

const STATUS_BTN: Record<string, { bg: string; color: string }> = {
  pass: { bg: '#dcfce7', color: '#15803d' },
  fail: { bg: '#fee2e2', color: '#dc2626' },
  skip: { bg: '#fef9c3', color: '#ca8a04' },
  untested: { bg: '#f3f4f6', color: '#6b7280' },
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { projectId } = useParams() as { projectId: string }
  const [project, setProject] = useState<Project | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [cases, setCases] = useState<TestCase[]>([])
  const [runs, setRuns] = useState<TestRun[]>([])
  const [tab, setTab] = useState<'cases' | 'runs'>('cases')
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')

  const sb = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    // Get user role
    const { data: { session } } = await sb.auth.getSession()
    if (session) {
      const { data: mem } = await sb.from('workspace_members').select('role').eq('user_id', session.user.id).eq('status', 'active').single()
      if (mem) setMyRole(mem.role)
    }
    const [{ data: proj }, { data: secs }, { data: tcs }, { data: trs }] = await Promise.all([
      sb.from('projects').select('*').eq('id', projectId).single(),
      sb.from('sections').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_cases').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_runs').select('*').eq('project_id', projectId).order('created_at'),
    ])
    setProject(proj); setSections(secs || []); setCases(tcs || []); setRuns(trs || [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}><p style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</p></div>
  if (!project) return <div style={{ padding: 24 }}><p style={{ color: '#ef4444' }}>Project not found.</p></div>

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '18px 26px 0', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 600 }}>{project.name}</h1>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['cases', 'runs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#111' : '#6b7280',
              padding: '8px 16px', borderBottom: tab === t ? '2px solid #111' : '2px solid transparent',
              marginBottom: -1, textTransform: 'capitalize',
            }}>{t === 'cases' ? 'Test cases' : 'Test runs'}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
        {tab === 'cases' && (
          <CasesTab sections={sections} cases={cases} projectId={projectId}
            myRole={myRole} onRefresh={load} />
        )}
        {tab === 'runs' && (
          <RunsTab runs={runs} cases={cases} sections={sections} projectId={projectId}
            myRole={myRole} onRefresh={load} />
        )}
      </div>
    </div>
  )
}

// ─── Test Cases Tab ───────────────────────────────────────────────────────────

function CasesTab({ sections, cases, projectId, myRole, onRefresh }: { sections: Section[]; cases: TestCase[]; projectId: string; myRole: WorkspaceRole; onRefresh: () => void }) {
  const [addingSection, setAddingSection] = useState(false)
  const [sectionName, setSectionName] = useState('')
  const [addingCaseTo, setAddingCaseTo] = useState<string | null>(null)
  const [editingCase, setEditingCase] = useState<TestCase | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const sb = createClient()

  const createSection = async () => {
    if (!sectionName.trim()) return
    await sb.from('sections').insert({ name: sectionName.trim(), project_id: projectId })
    setSectionName(''); setAddingSection(false); onRefresh()
  }

  const deleteSection = async (id: string) => {
    if (!confirm('Delete this section and all its test cases?')) return
    await sb.from('test_cases').delete().eq('section_id', id)
    await sb.from('sections').delete().eq('id', id)
    onRefresh()
  }

  const deleteCase = async (id: string) => {
    if (!confirm('Delete this test case?')) return
    await sb.from('test_cases').delete().eq('id', id)
    onRefresh()
  }

  const total = cases.length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          {total} test case{total !== 1 ? 's' : ''} · {sections.length} section{sections.length !== 1 ? 's' : ''}
        </p>
        {canEditCases(myRole) && <Btn onClick={() => setAddingSection(true)} sm>+ Add section</Btn>}
      </div>

      {addingSection && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <Inp value={sectionName} onChange={setSectionName} placeholder="Section name" autoFocus
            onKeyDown={(e: any) => { if (e.key === 'Enter') createSection(); if (e.key === 'Escape') setAddingSection(false) }} />
          <Btn onClick={createSection} primary sm>Save</Btn>
          <Btn onClick={() => setAddingSection(false)} sm>Cancel</Btn>
        </div>
      )}

      {sections.length === 0 && !addingSection && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 32, margin: '0 0 10px' }}>📂</p>
          <p style={{ fontWeight: 500, margin: '0 0 6px' }}>No sections yet</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Sections group your test cases.</p>
          <Btn onClick={() => setAddingSection(true)}>+ Add section</Btn>
        </div>
      )}

      {sections.map(section => {
        const sectionCases = cases.filter(c => c.section_id === section.id)
        const isOpen = !collapsed[section.id]
        return (
          <div key={section.id} style={{ marginBottom: 10, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f9fafb', borderBottom: isOpen ? '1px solid #e5e7eb' : 'none' }}>
              <button onClick={() => setCollapsed(p => ({ ...p, [section.id]: !p[section.id] }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#9ca3af', padding: 0 }}>
                {isOpen ? '▾' : '▸'}
              </button>
              <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{section.name}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{sectionCases.length} case{sectionCases.length !== 1 ? 's' : ''}</span>
              {canEditCases(myRole) && <Btn sm onClick={() => setAddingCaseTo(section.id)}>+ Add case</Btn>}
              <button onClick={() => deleteSection(section.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#d1d5db', padding: '2px 4px' }}>✕</button>
            </div>

            {isOpen && (
              <div>
                {sectionCases.map((tc, i) => {
                  const pb = PRIORITY_BADGE[tc.priority]
                  return (
                    <div key={tc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                      <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', paddingTop: 2, minWidth: 48 }}>TC-{tc.id.slice(0, 5).toUpperCase()}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{tc.title}</span>
                          <Badge {...pb} />
                          <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{tc.type}</span>
                        </div>
                        {tc.description && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>{tc.description}</p>}
                      </div>
                      {canEditCases(myRole) && <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <Btn sm onClick={() => setEditingCase(tc)}>Edit</Btn>
                        <Btn sm onClick={() => deleteCase(tc.id)}>✕</Btn>
                      </div>}
                    </div>
                  )
                })}
                {sectionCases.length === 0 && (
                  <p style={{ fontSize: 12, color: '#9ca3af', padding: '12px 14px', margin: 0 }}>
                    No test cases — <button onClick={() => setAddingCaseTo(section.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', fontSize: 12, textDecoration: 'underline', fontFamily: 'inherit' }}>add one</button>
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {addingCaseTo && (
        <CaseModal title="Add test case" projectId={projectId} sectionId={addingCaseTo}
          onSave={() => { setAddingCaseTo(null); onRefresh() }} onClose={() => setAddingCaseTo(null)} />
      )}
      {editingCase && (
        <CaseModal title="Edit test case" projectId={projectId} sectionId={editingCase.section_id}
          initial={editingCase}
          onSave={() => { setEditingCase(null); onRefresh() }} onClose={() => setEditingCase(null)} />
      )}
    </div>
  )
}

function CaseModal({ title, projectId, sectionId, initial, onSave, onClose }: any) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    steps: initial?.steps || '',
    expected_result: initial?.expected_result || '',
    priority: (initial?.priority || 'medium') as Priority,
    type: (initial?.type || 'functional') as CaseType,
  })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const sb = createClient()

  const save = async () => {
    if (!form.title.trim()) return
    if (initial) {
      await sb.from('test_cases').update({ ...form }).eq('id', initial.id)
    } else {
      await sb.from('test_cases').insert({ ...form, section_id: sectionId, project_id: projectId })
    }
    onSave()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Title" required><Inp value={form.title} onChange={(v: string) => set('title', v)} placeholder="Test case title" autoFocus /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>Priority</label>
          <Sel value={form.priority} onChange={v => set('priority', v)} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>Type</label>
          <Sel value={form.type} onChange={v => set('type', v)} options={[{ value: 'functional', label: 'Functional' }, { value: 'regression', label: 'Regression' }, { value: 'smoke', label: 'Smoke' }, { value: 'integration', label: 'Integration' }]} />
        </div>
      </div>
      <Field label="Description"><Textarea value={form.description} onChange={(v: string) => set('description', v)} placeholder="Brief description" rows={2} /></Field>
      <Field label="Steps to reproduce"><Textarea value={form.steps} onChange={(v: string) => set('steps', v)} placeholder={"1. Navigate to...\n2. Click...\n3. Verify..."} rows={4} /></Field>
      <Field label="Expected result"><Textarea value={form.expected_result} onChange={(v: string) => set('expected_result', v)} placeholder="What should happen?" rows={2} /></Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={save} disabled={!form.title.trim()}>Save</Btn>
      </div>
    </Modal>
  )
}

// ─── Test Runs Tab ────────────────────────────────────────────────────────────

function RunsTab({ runs, cases, sections, projectId, myRole, onRefresh }: { runs: TestRun[]; cases: TestCase[]; sections: Section[]; projectId: string; myRole: WorkspaceRole; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [activeRun, setActiveRun] = useState<string | null>(null)
  const sb = createClient()

  const createRun = async (name: string, caseIds: string[]) => {
    await sb.from('test_runs').insert({ name, case_ids: caseIds, results: {}, project_id: projectId })
    setCreating(false); onRefresh()
  }

  const updateResult = async (runId: string, caseId: string, status: RunStatus) => {
    const run = runs.find(r => r.id === runId)
    if (!run) return
    const results = { ...run.results, [caseId]: status }
    await sb.from('test_runs').update({ results }).eq('id', runId)
    onRefresh()
  }

  const deleteRun = async (id: string) => {
    if (!confirm('Delete this test run?')) return
    await sb.from('test_runs').delete().eq('id', id)
    onRefresh()
  }

  const allCasesWithSection = cases.map(c => ({
    ...c,
    sectionName: sections.find(s => s.id === c.section_id)?.name || '',
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          {runs.length} run{runs.length !== 1 ? 's' : ''}
        </p>
        {canExecuteRuns(myRole) && <Btn onClick={() => setCreating(true)} sm disabled={cases.length === 0}>▶ New test run</Btn>}
      </div>

      {cases.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 16 }}>
          Create test cases first before starting a test run.
        </div>
      )}

      {runs.length === 0 && cases.length > 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 32, margin: '0 0 10px' }}>▶</p>
          <p style={{ fontWeight: 500, margin: '0 0 6px' }}>No test runs yet</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Create a run to track execution against your test cases.</p>
          <Btn onClick={() => setCreating(true)}>▶ New test run</Btn>
        </div>
      )}

      {runs.map(run => {
        const runCases = allCasesWithSection.filter(c => run.case_ids.includes(c.id))
        const results = run.results || {}
        const passed = runCases.filter(c => results[c.id] === 'pass').length
        const failed = runCases.filter(c => results[c.id] === 'fail').length
        const skipped = runCases.filter(c => results[c.id] === 'skip').length
        const untested = runCases.length - passed - failed - skipped
        const pct = runCases.length ? Math.round((passed / runCases.length) * 100) : 0
        const isActive = activeRun === run.id

        return (
          <div key={run.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f9fafb' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: 14 }}>{run.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{new Date(run.created_at).toLocaleDateString()} · {runCases.length} cases</p>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                {[['pass', passed, '#16a34a'], ['fail', failed, '#dc2626'], ['skip', skipped, '#ca8a04'], ['—', untested, '#9ca3af']].map(([label, n, color]) => (
                  <span key={label as string} style={{ color: color as string }}>{n as number} {label}</span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 64, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 30 }}>{pct}%</span>
              </div>
              <Btn sm onClick={() => setActiveRun(isActive ? null : run.id)}>{isActive ? 'Close' : 'Execute'}</Btn>
              <button onClick={() => deleteRun(run.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#d1d5db' }}>✕</button>
            </div>

            {isActive && (
              <div>
                {runCases.map((tc, i) => {
                  const cur = (results[tc.id] || 'untested') as RunStatus
                  return (
                    <div key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderTop: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', minWidth: 48 }}>TC-{tc.id.slice(0, 5).toUpperCase()}</span>
                      <span style={{ fontSize: 13, flex: 1 }}>{tc.title}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{tc.sectionName}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['pass', 'fail', 'skip'] as const).map(s => (
                          <button key={s} onClick={() => updateResult(run.id, tc.id, s)}
                            style={{
                              padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                              borderRadius: 5, border: '1px solid #e5e7eb',
                              background: cur === s ? STATUS_BTN[s].bg : '#fff',
                              color: cur === s ? STATUS_BTN[s].color : '#9ca3af',
                              fontWeight: cur === s ? 600 : 400,
                            }}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {creating && (
        <CreateRunModal allCases={allCasesWithSection} onSave={createRun} onClose={() => setCreating(false)} />
      )}
    </div>
  )
}

function CreateRunModal({ allCases, onSave, onClose }: { allCases: any[]; onSave: (name: string, ids: string[]) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>(allCases.map(c => c.id))
  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  return (
    <Modal title="New test run" onClose={onClose} width={540}>
      <Field label="Run name" required>
        <Inp value={name} onChange={setName} placeholder="e.g. Sprint 14 smoke" autoFocus />
      </Field>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Test cases</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected(allCases.map(c => c.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontFamily: 'inherit' }}>Select all</button>
            <button onClick={() => setSelected([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6b7280', fontFamily: 'inherit' }}>Deselect all</button>
          </div>
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          {allCases.map((tc, i) => (
            <label key={tc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
              borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
              background: selected.includes(tc.id) ? '#eff6ff' : '#fff',
            }}>
              <input type="checkbox" checked={selected.includes(tc.id)} onChange={() => toggle(tc.id)} style={{ cursor: 'pointer' }} />
              <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>TC-{tc.id.slice(0, 5).toUpperCase()}</span>
              <span style={{ fontSize: 13, flex: 1 }}>{tc.title}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{tc.sectionName}</span>
            </label>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '5px 0 0' }}>{selected.length} of {allCases.length} selected</p>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary disabled={!name.trim() || selected.length === 0} onClick={() => onSave(name.trim(), selected)}>Create run</Btn>
      </div>
    </Modal>
  )
}
