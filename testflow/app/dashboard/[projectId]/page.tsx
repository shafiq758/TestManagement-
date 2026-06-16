'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { canEditCases, canExecuteRuns, canCreateProjects } from '@/lib/roles'
import MilestonesTab from '@/components/MilestonesTab'
import SprintsTab from '@/components/SprintsTab'
import BugsTab from '@/components/BugsTab'
import AttachmentUploader, { type Attachment } from '@/components/AttachmentUploader'
import ImportExportModal from '@/components/ImportExportModal'
import type { Bug } from '@/types'
import type { Project, Section, TestCase, TestRun, Priority, CaseType, RunStatus, WorkspaceRole } from '@/types'

// ─── Detail Drawer ───────────────────────────────────────────────────────────

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* Dark overlay — full screen, closes on click */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      {/* Panel — fixed to right edge, above overlay */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 480, background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

// ─── Global Drawer (renders at page level, never clipped) ────────────────────

function GlobalDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} onClick={onClose} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

function GDRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

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
  const [tab, setTab] = useState<'cases' | 'runs' | 'sprints' | 'milestones' | 'bugs'>('cases')
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')
  const [milestones, setMilestones] = useState<any[]>([])
  const [sprints, setSprints] = useState<any[]>([])
  const [testPlans, setTestPlans] = useState<any[]>([])
  const [bugs, setBugs] = useState<Bug[]>([])
  const [execHistory, setExecHistory] = useState<any[]>([])
  // Drill-down navigation stack
  // Each entry: { type: 'milestone'|'sprint'|'plan'|'case'|'run'|'runcase', data: any, extra?: any }
  const [navStack, setNavStack] = useState<Array<{type: string; data: any; extra?: any}>>([])
  const [drawerBug, setDrawerBug] = useState<Bug | null>(null)
  const pushNav = (type: string, data: any, extra?: any) => setNavStack(p => [...p, {type, data, extra}])
  const popNav = () => setNavStack(p => p.slice(0, -1))
  const goToIndex = (i: number) => setNavStack(p => p.slice(0, i + 1))
  const clearNav = () => setNavStack([])
  const [globalCommentModal, setGlobalCommentModal] = useState<{runId: string; caseId: string; status: RunStatus} | null>(null)

  const sb = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    // Get user role
    const { data: { session } } = await sb.auth.getSession()
    if (session) {
      const { data: mem } = await sb.from('workspace_members').select('role').eq('user_id', session.user.id).eq('status', 'active').single()
      if (mem) setMyRole(mem.role)
    }
    const [{ data: proj }, { data: secs }, { data: tcs }, { data: trs }, { data: mils }, { data: sprs }, { data: plans }, { data: bugsData }] = await Promise.all([
      sb.from('projects').select('*').eq('id', projectId).single(),
      sb.from('sections').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_cases').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_runs').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('milestones').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('sprints').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_plans').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('bugs').select('*').eq('project_id', projectId).order('created_at', {ascending: false}),
    ])
    setProject(proj); setSections(secs || []); setCases(tcs || []); setRuns(trs || [])
    setMilestones(mils || []); setSprints(sprs || []); setTestPlans(plans || [])
    setBugs((bugsData as any) || [])
    // Fetch execution history for all runs in project
    const runIds = (trs || []).map((r: any) => r.id)
    if (runIds.length > 0) {
      const { data: hist } = await sb.from('execution_history').select('*').in('test_run_id', runIds).order('executed_at', {ascending: false})
      setExecHistory(hist || [])
    }
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
          {([['cases', 'Test cases'], ['runs', 'Test runs'], ['sprints', 'Sprints'], ['milestones', 'Milestones'], ['bugs', 'Bugs']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t as any)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#111' : '#6b7280',
              padding: '8px 16px', borderBottom: tab === t ? '2px solid #111' : '2px solid transparent',
              marginBottom: -1,
            }}>{label}</button>
          ))}
          <a href={`/dashboard/reports/${projectId}`}
            style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', padding: '8px 16px', borderBottom: '2px solid transparent', display: 'inline-flex', alignItems: 'center', marginBottom: -1 }}>
            📊 Reports
          </a>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
        {tab === 'cases' && (
          <CasesTab sections={sections} cases={cases} projectId={projectId}
            myRole={myRole} onRefresh={load} onViewCase={(tc) => pushNav('case', tc)} />
        )}
        {tab === 'runs' && (
          <RunsTab runs={runs} cases={cases} sections={sections} sprints={sprints} testPlans={testPlans} projectId={projectId}
            myRole={myRole} onRefresh={load} bugs={bugs} execHistory={execHistory}
            onViewRun={(run) => pushNav('run', run)}
            onViewRunCase={(tc, results, runId, bugsArr) => pushNav('runcase', tc, {results, runId, bugs: bugsArr || bugs})} />
        )}
        {tab === 'sprints' && (
          <SprintsTab sprints={sprints} milestones={milestones} testPlans={testPlans}
            cases={cases} sections={sections} projectId={projectId}
            canEdit={canEditCases(myRole)} onRefresh={load}
            onViewSprint={(s) => pushNav('sprint', s)}
            onViewPlan={(p) => pushNav('plan', p)}
            onViewCase={(tc, bugsArr) => pushNav('case', tc, {bugs: bugsArr})}
            bugs={bugs} />
        )}
        {tab === 'milestones' && (
          <MilestonesTab milestones={milestones} projectId={projectId}
            canEdit={canEditCases(myRole)} onRefresh={load} onViewMilestone={(m) => pushNav('milestone', m)} />
        )}
        {tab === 'bugs' && (
          <BugsTab bugs={bugs} projectId={projectId} sprints={sprints}
            testRuns={runs} testCases={cases}
            canEdit={canEditCases(myRole)} onRefresh={load} onViewBug={(b) => pushNav("bug", b)} />
        )}
      </div>

            {/* Global comment modal from drill-down */}
      {globalCommentModal && (
        <FailCommentModal
          status={globalCommentModal.status}
          runId={globalCommentModal.runId}
          caseId={globalCommentModal.caseId}
          allBugs={bugs}
          projectId={projectId}
          sprints={sprints}
          runs={runs}
          cases={cases}
          onConfirm={async (comment) => {
            const run = runs.find(r => r.id === globalCommentModal.runId)
            if (!run) return
            const sb = createClient()
            const results = { ...run.results, [globalCommentModal.caseId]: globalCommentModal.status }
            await sb.from('test_runs').update({ results }).eq('id', globalCommentModal.runId)
            const { data: { session } } = await sb.auth.getSession()
            await sb.from('execution_history').insert({
              test_run_id: globalCommentModal.runId,
              test_case_id: globalCommentModal.caseId,
              status: globalCommentModal.status,
              comment: comment.trim(),
              executed_by: session?.user?.id,
            })
            load()
            setGlobalCommentModal(null)
          }}
          onClose={() => setGlobalCommentModal(null)}
        />
      )}

      {/* ── Drill-down Detail Panel ── */}
      {navStack.length > 0 && <DrillDown
        stack={navStack}
        cases={cases} sections={sections} sprints={sprints}
        testPlans={testPlans} runs={runs} milestones={milestones} bugs={bugs}
        myRole={myRole}
        onPush={pushNav} onPop={popNav} onGoTo={goToIndex} onClose={clearNav}
        onViewBug={(b) => pushNav("bug", b)}
        onUpdateRunResult={async (runId, caseId, status) => {
          const run = runs.find(r => r.id === runId)
          if (!run) return
          const sb = createClient()
          await sb.from('test_runs').update({ results: { ...run.results, [caseId]: status } }).eq('id', runId)
          load()
        }}
      />}

    </div>
  )
}

// ─── Test Cases Tab ───────────────────────────────────────────────────────────

function CasesTab({ sections, cases, projectId, myRole, onRefresh, onViewCase }: { sections: Section[]; cases: TestCase[]; projectId: string; myRole: WorkspaceRole; onRefresh: () => void; onViewCase: (tc: any) => void }) {
  const [addingSection, setAddingSection] = useState(false)
  const [sectionName, setSectionName] = useState('')
  const [addingCaseTo, setAddingCaseTo] = useState<string | null>(null)
  const [editingCase, setEditingCase] = useState<TestCase | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showImportExport, setShowImportExport] = useState(false)
  const canEdit = canEditCases(myRole)
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
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn onClick={() => setShowImportExport(true)} sm>↕ Import / Export</Btn>
          {canEditCases(myRole) && <Btn onClick={() => setAddingSection(true)} sm>+ Add section</Btn>}
        </div>
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
                          <button onClick={() => onViewCase(tc)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 500, color: "#111", textDecoration: "underline", textDecorationColor: "#d1d5db", fontFamily: "inherit", textAlign: "left" }}>{tc.title}</button>
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
      {showImportExport && (
        <ImportExportModal
          projectId={projectId} sections={sections} cases={cases}
          onRefresh={onRefresh} onClose={() => setShowImportExport(false)}
        />
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
    attachments: (initial?.attachments || []).map((url: string, i: number) => ({
      url, name: `attachment-${i+1}`,
      type: (url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image') as 'image'|'video',
    })) as Attachment[],
  })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const sb = createClient()

  const save = async () => {
    if (!form.title.trim()) return
    const payload = {
      title: form.title, description: form.description, steps: form.steps,
      expected_result: form.expected_result, priority: form.priority, type: form.type,
      attachments: form.attachments.map((a: Attachment) => a.url),
    }
    if (initial) {
      await sb.from('test_cases').update(payload).eq('id', initial.id)
    } else {
      await sb.from('test_cases').insert({ ...payload, section_id: sectionId, project_id: projectId })
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
      <Field label="Attachments (optional)">
        <AttachmentUploader
          attachments={form.attachments}
          onChange={(atts: Attachment[]) => set('attachments', atts)}
          folder="test-cases"
        />
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={save} disabled={!form.title.trim()}>Save</Btn>
      </div>
    </Modal>
  )
}

// ─── Test Runs Tab ────────────────────────────────────────────────────────────

function RunsTab({ runs, cases, sections, sprints, testPlans, projectId, myRole, onRefresh, onViewRun, onViewRunCase, bugs, execHistory }: { runs: TestRun[]; cases: TestCase[]; sections: Section[]; sprints: any[]; testPlans: any[]; projectId: string; myRole: WorkspaceRole; onRefresh: () => void; onViewRun: (run: TestRun) => void; onViewRunCase: (tc: any, results: Record<string, RunStatus>, runId: string, bugs?: any[]) => void; bugs: any[]; execHistory: any[] }) {
  const [creating, setCreating] = useState(false)
  const [activeRun, setActiveRun] = useState<string | null>(null)
  const [commentModal, setCommentModal] = useState<{runId: string; caseId: string; status: RunStatus} | null>(null)
  const [commentText, setCommentText] = useState('')
  const sb = createClient()

  const createRun = async (name: string, caseIds: string[], sprintId: string, planId: string) => {
    await sb.from('test_runs').insert({ name, case_ids: caseIds, results: {}, project_id: projectId, sprint_id: sprintId, plan_id: planId })
    setCreating(false); onRefresh()
  }

  const updateResult = async (runId: string, caseId: string, status: RunStatus, comment: string = '') => {
    const run = runs.find(r => r.id === runId)
    if (!run) return
    const results = { ...run.results, [caseId]: status }
    await sb.from('test_runs').update({ results }).eq('id', runId)
    // Save to execution history
    const { data: { session } } = await sb.auth.getSession()
    await sb.from('execution_history').insert({
      test_run_id: runId, test_case_id: caseId,
      status, comment: comment.trim(),
      executed_by: session?.user?.id,
    })
    onRefresh()
  }

  const bulkUpdateResults = async (runId: string, caseIds: string[], status: RunStatus) => {
    const run = runs.find(r => r.id === runId)
    if (!run) return
    const results = { ...run.results }
    caseIds.forEach(id => { results[id] = status })
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
        {canExecuteRuns(myRole) && <Btn onClick={() => setCreating(true)} sm disabled={testPlans.length === 0}>▶ New test run</Btn>}
      </div>

      {sprints.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 16 }}>
          Create a Sprint and Test Plan first — test runs must be linked to a test plan.
        </div>
      )}
      {sprints.length > 0 && testPlans.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 16 }}>
          Create a Test Plan inside a sprint first before starting a test run.
        </div>
      )}

      {runs.length === 0 && testPlans.length > 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 32, margin: '0 0 10px' }}>▶</p>
          <p style={{ fontWeight: 500, margin: '0 0 6px' }}>No test runs yet</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Select a sprint and test plan to create your first run.</p>
          {canExecuteRuns(myRole) && <Btn onClick={() => setCreating(true)}>▶ New test run</Btn>}
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
                <button onClick={() => onViewRun(run)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, margin: '0 0 3px', fontWeight: 600, fontSize: 14, color: '#111', textAlign: 'left', textDecoration: 'underline', textDecorationColor: '#d1d5db', fontFamily: 'inherit' }}>{run.name}</button>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                  {new Date(run.created_at).toLocaleDateString()} · {runCases.length} cases
                  {run.sprint_id && sprints.find((s: any) => s.id === run.sprint_id) && <span> · 🏃 {sprints.find((s: any) => s.id === run.sprint_id)?.name}</span>}
                  {run.plan_id && testPlans.find((p: any) => p.id === run.plan_id) && <span> · 📋 {testPlans.find((p: any) => p.id === run.plan_id)?.name}</span>}
                </p>
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
              <RunExecution run={run} runCases={runCases} results={results}
                execHistory={execHistory.filter(h => h.test_run_id === run.id)}
                bugs={bugs}
                onUpdateResult={updateResult} onBulkUpdate={bulkUpdateResults}
                onViewCase={(tc) => onViewRunCase(tc, results, run.id, bugs)}
                onShowComment={(runId, caseId, status) => { setCommentModal({runId, caseId, status}); setCommentText('') }} />
            )}
          </div>
        )
      })}

      {creating && (
        <CreateRunModal allCases={allCasesWithSection} sprints={sprints} testPlans={testPlans} onSave={createRun} onClose={() => setCreating(false)} />
      )}

      {/* Comment modal — FailCommentModal handles all statuses + bug linking */}
      {commentModal && (
        <FailCommentModal
          status={commentModal.status}
          runId={commentModal.runId}
          caseId={commentModal.caseId}
          allBugs={bugs}
          projectId={projectId}
          sprints={sprints}
          runs={runs}
          cases={cases}
          onConfirm={(comment) => {
            updateResult(commentModal.runId, commentModal.caseId, commentModal.status, comment)
            setCommentModal(null)
          }}
          onClose={() => setCommentModal(null)}
        />
      )}


    </div>
  )
}

function CreateRunModal({ allCases, sprints, testPlans, onSave, onClose }: {
  allCases: any[]; sprints: any[]; testPlans: any[]
  onSave: (name: string, ids: string[], sprintId: string, planId: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [sprintId, setSprintId] = useState(sprints[0]?.id || '')
  const [planId, setPlanId] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  // Plans for selected sprint
  const sprintPlans = testPlans.filter(p => p.sprint_id === sprintId)

  // When sprint changes, reset plan and auto-select first plan's cases
  const handleSprintChange = (sid: string) => {
    setSprintId(sid)
    setPlanId('')
    setSelected([])
  }

  // When plan changes, auto-populate cases from plan
  const handlePlanChange = (pid: string) => {
    setPlanId(pid)
    const plan = testPlans.find(p => p.id === pid)
    setSelected(plan?.case_ids || [])
  }

  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  // Filter cases based on search, type, priority
  const planCaseIds = testPlans.find(p => p.id === planId)?.case_ids || []
  const planCases = planId ? allCases.filter(c => planCaseIds.includes(c.id)) : allCases
  const filtered = planCases.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || c.type === filterType
    const matchPriority = !filterPriority || c.priority === filterPriority
    return matchSearch && matchType && matchPriority
  })

  const selStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 10px', fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer' }

  return (
    <Modal title="New test run" onClose={onClose} width={580}>
      <Field label="Run name" required>
        <Inp value={name} onChange={setName} placeholder="e.g. Sprint 1 regression" autoFocus />
      </Field>

      {/* Step 1: Select Sprint */}
      <Field label="Sprint" required>
        <select value={sprintId} onChange={e => handleSprintChange(e.target.value)} style={{ ...selStyle, width: '100%' }}>
          <option value="">— Select sprint —</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
        </select>
      </Field>

      {/* Step 2: Select Test Plan */}
      {sprintId && (
        <Field label="Test plan" required>
          {sprintPlans.length === 0 ? (
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>No test plans in this sprint. Create one in the Sprints tab first.</p>
          ) : (
            <select value={planId} onChange={e => handlePlanChange(e.target.value)} style={{ ...selStyle, width: '100%' }}>
              <option value="">— Select test plan —</option>
              {sprintPlans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.case_ids.length} cases)</option>)}
            </select>
          )}
        </Field>
      )}

      {/* Step 3: Filter and select cases */}
      {planId && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Test cases ({selected.length} selected)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelected(filtered.map(c => c.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontFamily: 'inherit' }}>Select all</button>
              <button onClick={() => setSelected([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6b7280', fontFamily: 'inherit' }}>None</button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title..." style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 10px', fontSize: 12, outline: 'none' }} />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selStyle}>
              <option value="">All types</option>
              <option value="functional">Functional</option>
              <option value="regression">Regression</option>
              <option value="smoke">Smoke</option>
              <option value="integration">Integration</option>
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={selStyle}>
              <option value="">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            {filtered.map((tc, i) => (
              <label key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: selected.includes(tc.id) ? '#eff6ff' : '#fff' }}>
                <input type="checkbox" checked={selected.includes(tc.id)} onChange={() => toggle(tc.id)} style={{ cursor: 'pointer' }} />
                <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>TC-{tc.id.slice(0, 5).toUpperCase()}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{tc.title}</span>
                <span style={{ fontSize: 11, background: tc.priority === 'high' ? '#fef2f2' : tc.priority === 'medium' ? '#fffbeb' : '#f0fdf4', color: tc.priority === 'high' ? '#dc2626' : tc.priority === 'medium' ? '#d97706' : '#16a34a', padding: '1px 6px', borderRadius: 4 }}>{tc.priority}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{tc.type}</span>
              </label>
            ))}
            {filtered.length === 0 && <p style={{ padding: '12px', fontSize: 13, color: '#9ca3af', margin: 0 }}>No cases match filters.</p>}
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '5px 0 0' }}>{selected.length} of {filtered.length} shown selected</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary disabled={!name.trim() || !sprintId || !planId || selected.length === 0}
          onClick={() => onSave(name.trim(), selected, sprintId, planId)}>Create run</Btn>
      </div>
    </Modal>
  )
}

// ─── Run Execution with bulk selection ───────────────────────────────────────

function RunExecution({ run, runCases, results, execHistory, bugs, onUpdateResult, onBulkUpdate, onViewCase, onShowComment }: {
  run: TestRun
  runCases: any[]
  results: Record<string, RunStatus>
  execHistory: any[]
  bugs: any[]
  onUpdateResult: (runId: string, caseId: string, status: RunStatus, comment?: string) => void
  onBulkUpdate: (runId: string, caseIds: string[], status: RunStatus) => void
  onViewCase: (tc: any) => void
  onShowComment: (runId: string, caseId: string, status: RunStatus) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const allSelected = selected.length === runCases.length && runCases.length > 0
  const someSelected = selected.length > 0

  const toggleOne = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAll = () => setSelected(allSelected ? [] : runCases.map(c => c.id))

  const bulkSet = (status: RunStatus) => {
    if (selected.length === 0) return
    onBulkUpdate(run.id, selected, status)
    setSelected([])
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    pass: { bg: '#dcfce7', color: '#15803d' },
    fail: { bg: '#fee2e2', color: '#dc2626' },
    skip: { bg: '#fef9c3', color: '#ca8a04' },
    untested: { bg: '#f3f4f6', color: '#6b7280' },
  }

  return (
    <>
    <div>
      {/* Bulk action toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid #f3f4f6', background: someSelected ? '#eff6ff' : '#fafafa' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll}
            ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
            style={{ cursor: 'pointer' }} />
          {someSelected ? `${selected.length} selected` : 'Select all'}
        </label>

        {someSelected && (
          <>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Set as:</span>
            {(['pass', 'fail', 'skip'] as const).map(s => (
              <button key={s} onClick={() => bulkSet(s)} style={{
                padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 6, border: '1px solid #e5e7eb',
                background: statusColors[s].bg, color: statusColors[s].color, fontWeight: 600,
              }}>
                {s === 'pass' ? '✓ Pass' : s === 'fail' ? '✗ Fail' : '— Skip'}
              </button>
            ))}
            <button onClick={() => setSelected([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af', fontFamily: 'inherit', marginLeft: 'auto' }}>
              Clear selection
            </button>
          </>
        )}

        {!someSelected && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Select cases to bulk update status</span>
        )}
      </div>

      {/* Case rows */}
      {runCases.map((tc, i) => {
        const cur = (results[tc.id] || 'untested') as RunStatus
        const isSelected = selected.includes(tc.id)
        const sc = statusColors[cur]
        const hist = execHistory.filter((h: any) => h.test_case_id === tc.id).slice(0, 5)
        const hc: Record<string, {bg:string;color:string}> = {
          pass:{bg:'#dcfce7',color:'#15803d'},
          fail:{bg:'#fee2e2',color:'#dc2626'},
          skip:{bg:'#fef9c3',color:'#ca8a04'},
        }
        return (
          <div key={tc.id}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
              borderTop: '1px solid #f3f4f6',
              background: isSelected ? '#eff6ff' : 'transparent',
              transition: 'background 0.1s',
            }}>
              <input type="checkbox" checked={isSelected} onChange={() => toggleOne(tc.id)} style={{ cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', minWidth: 52 }}>TC-{tc.id.slice(0, 5).toUpperCase()}</span>
              <button onClick={() => onViewCase(tc)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, flex: 1, color: '#111', textAlign: 'left', textDecoration: 'underline', textDecorationColor: '#d1d5db', fontFamily: 'inherit' }}>{tc.title}</button>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{tc.sectionName}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: sc.bg, color: sc.color, minWidth: 54, textAlign: 'center' }}>
                  {cur}
                </span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['pass', 'fail', 'skip'] as const).map(s => (
                    <button key={s} onClick={() => onShowComment(run.id, tc.id, s)}
                      title={s}
                      style={{
                        width: 24, height: 24, fontSize: 12, cursor: 'pointer',
                        borderRadius: 4, border: `1px solid ${cur === s ? statusColors[s].color : '#e5e7eb'}`,
                        background: cur === s ? statusColors[s].bg : '#fff',
                        color: cur === s ? statusColors[s].color : '#9ca3af',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {s === 'pass' ? '✓' : s === 'fail' ? '✗' : '–'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {hist.length > 0 && (
              <div style={{ padding: '5px 16px 8px 58px', background: '#fafafa', borderTop: '1px solid #f9fafb' }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Execution History</p>
                {hist.map((h: any) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ background: (hc[h.status]||{bg:'#f3f4f6',color:'#6b7280'}).bg, color: (hc[h.status]||{bg:'#f3f4f6',color:'#6b7280'}).color, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, minWidth: 34, textAlign: 'center' as const }}>{h.status}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(h.executed_at).toLocaleString()}</span>
                    {h.comment && <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>"{h.comment}"</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
    </>
  )
}

// ─── DrillDown Panel ─────────────────────────────────────────────────────────
// Renders as a full-height overlay with breadcrumb navigation

function DrillDown({ stack, cases, sections, sprints, testPlans, runs, milestones, bugs, myRole, onPush, onPop, onGoTo, onClose, onUpdateRunResult, onViewBug, onShowComment }: {
  stack: Array<{type: string; data: any; extra?: any}>
  cases: any[]; sections: any[]; sprints: any[]; testPlans: any[]; runs: any[]; milestones: any[]; bugs: any[]
  myRole: WorkspaceRole
  onPush: (type: string, data: any, extra?: any) => void
  onPop: () => void
  onGoTo: (i: number) => void
  onClose: () => void
  onUpdateRunResult: (runId: string, caseId: string, status: RunStatus) => void
  onViewBug: (b: any) => void
  onShowComment?: (runId: string, caseId: string, status: RunStatus) => void
}) {
  const current = stack[stack.length - 1]

  const stColors: Record<string, {bg:string;color:string}> = {
    pass: {bg:'#dcfce7',color:'#15803d'},
    fail: {bg:'#fee2e2',color:'#dc2626'},
    skip: {bg:'#fef9c3',color:'#ca8a04'},
    untested: {bg:'#f3f4f6',color:'#6b7280'},
  }
  const milestoneStatusCfg: Record<string, {bg:string;color:string;label:string}> = {
    open: {bg:'#f3f4f6',color:'#374151',label:'Open'},
    in_progress: {bg:'#dbeafe',color:'#1e40af',label:'In Progress'},
    closed: {bg:'#d1fae5',color:'#065f46',label:'Closed'},
  }
  const sprintStatusCfg: Record<string, {bg:string;color:string;label:string}> = {
    planned: {bg:'#f3f4f6',color:'#374151',label:'Planned'},
    active: {bg:'#dcfce7',color:'#15803d',label:'Active'},
    completed: {bg:'#dbeafe',color:'#1e40af',label:'Completed'},
  }
  const priorityCfg: Record<string, {bg:string;color:string}> = {
    high: {bg:'#fef2f2',color:'#dc2626'},
    medium: {bg:'#fffbeb',color:'#d97706'},
    low: {bg:'#f0fdf4',color:'#16a34a'},
  }

  const typeLabel: Record<string, string> = {
    milestone: '🎯 Milestone', sprint: '🏃 Sprint', plan: '📋 Test Plan',
    case: '🧪 Test Case', run: '▶ Test Run', runcase: '🧪 Test Case',
  }

  const renderContent = () => {
    const { type, data, extra } = current

    // ── MILESTONE ──
    if (type === 'milestone') {
      const linkedSprints = sprints.filter(s => s.milestone_id === data.id)
      const msc = milestoneStatusCfg[data.status]
      return (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <span style={{ background: msc.bg, color: msc.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{msc.label}</span>
            {data.due_date && <span style={{ fontSize: 11, color: '#6b7280', padding: '2px 8px', background: '#f3f4f6', borderRadius: 5 }}>Due {new Date(data.due_date).toLocaleDateString()}</span>}
          </div>
          {data.description && <DDRow label="Description" value={data.description} />}
          <DDRow label="Created" value={new Date(data.created_at).toLocaleDateString()} />
          <div style={{ marginTop: 8 }}>
            <p style={sectionLabel}>Sprints ({linkedSprints.length})</p>
            {linkedSprints.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>No sprints linked to this milestone.</p>}
            {linkedSprints.map((s, i) => {
              const sc = sprintStatusCfg[s.status]
              const planCount = testPlans.filter(p => p.sprint_id === s.id).length
              return (
                <DDCard key={s.id} onClick={() => onPush('sprint', s)} last={i === linkedSprints.length - 1}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 13 }}>{s.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{planCount} test plan{planCount !== 1 ? 's' : ''}{s.start_date ? ` · ${new Date(s.start_date).toLocaleDateString()}` : ''}</p>
                  </div>
                  <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{sc.label}</span>
                  <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
                </DDCard>
              )
            })}
          </div>
        </div>
      )
    }

    // ── SPRINT ──
    if (type === 'sprint') {
      const sprintPlans = testPlans.filter(p => p.sprint_id === data.id)
      const sprintRuns = runs.filter(r => r.sprint_id === data.id)
      const milestone = milestones.find(m => m.id === data.milestone_id)
      const sc = sprintStatusCfg[data.status]
      return (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{sc.label}</span>
            {milestone && <span style={{ fontSize: 11, color: '#6b7280', padding: '2px 8px', background: '#f3f4f6', borderRadius: 5 }}>🎯 {milestone.name}</span>}
          </div>
          {data.goal && <DDRow label="Goal" value={data.goal} />}
          {(data.start_date || data.end_date) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {data.start_date && <DDRow label="Start" value={new Date(data.start_date).toLocaleDateString()} />}
              {data.end_date && <DDRow label="End" value={new Date(data.end_date).toLocaleDateString()} />}
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <p style={sectionLabel}>Test Plans ({sprintPlans.length})</p>
            {sprintPlans.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>No test plans in this sprint.</p>}
            {sprintPlans.map((plan, i) => (
              <DDCard key={plan.id} onClick={() => onPush('plan', plan)} last={i === sprintPlans.length - 1}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 13 }}>📋 {plan.name}</p>
                  {plan.description && <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{plan.description}</p>}
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{plan.case_ids.length} cases</span>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
              </DDCard>
            ))}
          </div>
          {sprintRuns.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={sectionLabel}>Test Runs ({sprintRuns.length})</p>
              {sprintRuns.map((run, i) => {
                const res = run.results || {}
                const passed = run.case_ids.filter((id: string) => res[id] === 'pass').length
                const pct = run.case_ids.length ? Math.round((passed / run.case_ids.length) * 100) : 0
                return (
                  <DDCard key={run.id} onClick={() => onPush('run', run)} last={i === sprintRuns.length - 1}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 13 }}>▶ {run.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{run.case_ids.length} cases · {pct}% passed</p>
                    </div>
                    <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
                  </DDCard>
                )
              })}
            </div>
          )}
          {(() => {
            const sprintBugs = bugs.filter((b: any) => b.sprint_id === data.id)
            if (sprintBugs.length === 0) return null
            const sevCfgS: Record<string, {bg:string;color:string}> = {critical:{bg:'#fef2f2',color:'#b91c1c'},high:{bg:'#fff7ed',color:'#c2410c'},medium:{bg:'#fffbeb',color:'#d97706'},low:{bg:'#f0fdf4',color:'#15803d'}}
            const stCfgS: Record<string, {bg:string;color:string;label:string}> = {open:{bg:'#fef2f2',color:'#dc2626',label:'Open'},in_progress:{bg:'#eff6ff',color:'#2563eb',label:'In Progress'},resolved:{bg:'#f0fdf4',color:'#15803d',label:'Resolved'},closed:{bg:'#f3f4f6',color:'#374151',label:'Closed'},wont_fix:{bg:'#faf5ff',color:'#7c3aed',label:"Won't Fix"}}
            return (
              <div>
                <p style={sectionLabel}>Bugs ({sprintBugs.length})</p>
                {sprintBugs.map((bug: any, i: number) => {
                  const sc = sevCfgS[bug.severity] || sevCfgS.medium
                  const bc = stCfgS[bug.status] || stCfgS.open
                  return (
                    <DDCard key={bug.id} onClick={() => onPush('bug', bug)} last={i === sprintBugs.length - 1}>
                      <div style={{ flex: 1 }}><p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 13 }}>🐛 {bug.title}</p></div>
                      <span style={{ background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3 }}>{bug.severity}</span>
                      <span style={{ background: bc.bg, color: bc.color, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3 }}>{bc.label}</span>
                      <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
                    </DDCard>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )
    }

    // ── TEST PLAN ──
    if (type === 'plan') {
      const planCases = cases.map(c => ({...c, sectionName: sections.find(s => s.id === c.section_id)?.name || ''})).filter(c => data.case_ids.includes(c.id))
      return (
        <div>
          {data.description && <DDRow label="Description" value={data.description} />}
          <DDRow label="Cases" value={`${planCases.length} test case${planCases.length !== 1 ? 's' : ''}`} />
          <div style={{ marginTop: 8 }}>
            <p style={sectionLabel}>Test Cases ({planCases.length})</p>
            {planCases.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>No test cases in this plan.</p>}
            {planCases.map((tc, i) => {
              const pc = priorityCfg[tc.priority]
              return (
                <DDCard key={tc.id} onClick={() => onPush('case', tc, {bugs})} last={i === planCases.length - 1}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 13 }}>{tc.title}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{tc.sectionName} · {tc.type}</p>
                  </div>
                  <span style={{ background: pc.bg, color: pc.color, fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4 }}>{tc.priority}</span>
                  <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
                </DDCard>
              )
            })}
          </div>
        </div>
      )
    }

    // ── TEST CASE ──
    if (type === 'case' || type === 'runcase') {
      const pc = priorityCfg[data.priority]
      const runResults = extra?.results
      const runId = extra?.runId
      // Only show bugs when coming from run/plan context (extra.bugs set), not Test Cases tab
      const showBugs = extra?.bugs !== undefined
      const linkedBugs = showBugs ? (extra.bugs as any[]).filter((b: any) => {
        const matchesCase = b.test_case_id === data.id
        if (extra?.runId) return matchesCase && b.test_run_id === extra.runId
        return matchesCase
      }) : []
      const stCfg: Record<string, {bg:string;color:string;label:string}> = {
        open:{bg:'#fef2f2',color:'#dc2626',label:'Open'},
        in_progress:{bg:'#eff6ff',color:'#2563eb',label:'In Progress'},
        resolved:{bg:'#f0fdf4',color:'#15803d',label:'Resolved'},
        closed:{bg:'#f3f4f6',color:'#374151',label:'Closed'},
        wont_fix:{bg:'#faf5ff',color:'#7c3aed',label:"Won't Fix"},
      }
      const sevCfg: Record<string, {bg:string;color:string}> = {
        critical:{bg:'#fef2f2',color:'#b91c1c'},
        high:{bg:'#fff7ed',color:'#c2410c'},
        medium:{bg:'#fffbeb',color:'#d97706'},
        low:{bg:'#f0fdf4',color:'#15803d'},
      }
      return (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ background: pc.bg, color: pc.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{data.priority}</span>
            <span style={{ background: '#f3f4f6', color: '#374151', fontSize: 11, padding: '2px 8px', borderRadius: 5 }}>{data.type}</span>
            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>TC-{data.id.slice(0,5).toUpperCase()}</span>
          </div>
          {runResults && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>Current Status</p>
              <span style={{ background: stColors[runResults[data.id] || 'untested'].bg, color: stColors[runResults[data.id] || 'untested'].color, fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 6 }}>
                {runResults[data.id] || 'untested'}
              </span>
            </div>
          )}
          {data.sectionName && <DDRow label="Section" value={data.sectionName} />}
          {data.description && <DDRow label="Description" value={data.description} />}
          {data.steps && <DDRow label="Steps to reproduce" value={<pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151' }}>{data.steps}</pre>} />}
          {data.expected_result && <DDRow label="Expected result" value={data.expected_result} />}
          {/* Linked bugs — only shown from run/plan context */}
          {showBugs && <div style={{ marginTop: 8 }}>
            <p style={sectionLabel}>Linked bugs ({linkedBugs.length})</p>
            {linkedBugs.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No bugs linked to this test case.</p>}
            {linkedBugs.map((bug: any, i: number) => {
              const sc = sevCfg[bug.severity]
              const bc = stCfg[bug.status]
              return (
                <DDCard key={bug.id} onClick={() => onViewBug(bug)} last={i === linkedBugs.length - 1}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 13 }}>🐛 {bug.title}</p>
                  </div>
                  <span style={{ background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3 }}>{bug.severity}</span>
                  <span style={{ background: bc.bg, color: bc.color, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3 }}>{bc.label}</span>
                  <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
                </DDCard>
              )
            })}
          </div>}
          {runId && (
            <div style={{ marginTop: 20 }}>
              <p style={sectionLabel}>Update Status</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['pass','fail','skip'] as const).map(s => (
                  <button key={s} onClick={() => onShowComment ? onShowComment(runId, data.id, s) : onUpdateRunResult(runId, data.id, s)}
                    style={{ flex: 1, padding: '9px 0', fontSize: 13, cursor: 'pointer', borderRadius: 7, border: '1px solid #e5e7eb', fontFamily: 'inherit', fontWeight: 600, background: stColors[s].bg, color: stColors[s].color }}>
                    {s === 'pass' ? '✓ Pass' : s === 'fail' ? '✗ Fail' : '— Skip'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // ── TEST RUN ──
    if (type === 'run') {
      const runCases = cases.map(c => ({...c, sectionName: sections.find(s => s.id === c.section_id)?.name || ''})).filter(c => data.case_ids.includes(c.id))
      const res = data.results || {}
      const passed = runCases.filter(c => res[c.id] === 'pass').length
      const failed = runCases.filter(c => res[c.id] === 'fail').length
      const skipped = runCases.filter(c => res[c.id] === 'skip').length
      const untested = runCases.length - passed - failed - skipped
      const pct = runCases.length ? Math.round((passed / runCases.length) * 100) : 0
      const sprint = sprints.find(s => s.id === data.sprint_id)
      const plan = testPlans.find(p => p.id === data.plan_id)
      return (
        <div>
          {sprint && <DDRow label="Sprint" value={<button onClick={() => onPush('sprint', sprint)} style={linkBtn}>🏃 {sprint.name} →</button>} />}
          {plan && <DDRow label="Test plan" value={<button onClick={() => onPush('plan', plan)} style={linkBtn}>📋 {plan.name} →</button>} />}
          <DDRow label="Created" value={new Date(data.created_at).toLocaleDateString()} />
          <div style={{ marginBottom: 16 }}>
            <p style={sectionLabel}>Progress</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#15803d' }}>✓ {passed} pass</span>
              <span style={{ color: '#dc2626' }}>✗ {failed} fail</span>
              <span style={{ color: '#ca8a04' }}>— {skipped} skip</span>
              <span style={{ color: '#9ca3af' }}>• {untested} untested</span>
            </div>
            <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a' }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{pct}% complete</p>
          </div>
          <p style={sectionLabel}>Test Cases ({runCases.length})</p>
          {runCases.map((tc, i) => {
            const st = res[tc.id] || 'untested'
            const sc = stColors[st]
            const pc = priorityCfg[tc.priority]
            const tcBugs = bugs.filter((b: any) => b.test_case_id === tc.id)
            return (
              <DDCard key={tc.id} onClick={() => onPush('runcase', tc, {results: res, runId: data.id, bugs})} last={i === runCases.length - 1}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 13 }}>{tc.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{tc.sectionName}{tcBugs.length > 0 ? ` · 🐛 ${tcBugs.length} bug${tcBugs.length !== 1 ? 's' : ''}` : ''}</p>
                </div>
                <span style={{ background: pc.bg, color: pc.color, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3 }}>{tc.priority}</span>
                <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{st}</span>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
              </DDCard>
            )
          })}
          {(() => {
            const runBugs = bugs.filter((b: any) => b.test_run_id === data.id && b.test_run_id !== null)
            if (runBugs.length === 0) return null
            const sevCfgR: Record<string, {bg:string;color:string}> = {critical:{bg:'#fef2f2',color:'#b91c1c'},high:{bg:'#fff7ed',color:'#c2410c'},medium:{bg:'#fffbeb',color:'#d97706'},low:{bg:'#f0fdf4',color:'#15803d'}}
            const stCfgR: Record<string, {bg:string;color:string;label:string}> = {open:{bg:'#fef2f2',color:'#dc2626',label:'Open'},in_progress:{bg:'#eff6ff',color:'#2563eb',label:'In Progress'},resolved:{bg:'#f0fdf4',color:'#15803d',label:'Resolved'},closed:{bg:'#f3f4f6',color:'#374151',label:'Closed'},wont_fix:{bg:'#faf5ff',color:'#7c3aed',label:"Won't Fix"}}
            return (
              <div style={{ marginTop: 16 }}>
                <p style={sectionLabel}>Bugs in this run ({runBugs.length})</p>
                {runBugs.map((bug: any, i: number) => {
                  const sc = sevCfgR[bug.severity] || sevCfgR.medium
                  const bc = stCfgR[bug.status] || stCfgR.open
                  return (
                    <DDCard key={bug.id} onClick={() => onPush('bug', bug)} last={i === runBugs.length - 1}>
                      <div style={{ flex: 1 }}><p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 13 }}>🐛 {bug.title}</p></div>
                      <span style={{ background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3 }}>{bug.severity}</span>
                      <span style={{ background: bc.bg, color: bc.color, fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3 }}>{bc.label}</span>
                      <span style={{ color: '#9ca3af', fontSize: 13 }}>→</span>
                    </DDCard>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )
    }

    // ── BUG ──
    if (type === 'bug') {
      const sprint = sprints.find(s => s.id === data.sprint_id)
      const run = runs.find(r => r.id === data.test_run_id)
      const tc = cases.find(c => c.id === data.test_case_id)
      const sevCfgB: Record<string, {bg:string;color:string;label:string}> = {
        critical:{bg:'#fef2f2',color:'#b91c1c',label:'Critical'},
        high:{bg:'#fff7ed',color:'#c2410c',label:'High'},
        medium:{bg:'#fffbeb',color:'#d97706',label:'Medium'},
        low:{bg:'#f0fdf4',color:'#15803d',label:'Low'},
      }
      const stCfgB: Record<string, {bg:string;color:string;label:string}> = {
        open:{bg:'#fef2f2',color:'#dc2626',label:'Open'},
        in_progress:{bg:'#eff6ff',color:'#2563eb',label:'In Progress'},
        resolved:{bg:'#f0fdf4',color:'#15803d',label:'Resolved'},
        closed:{bg:'#f3f4f6',color:'#374151',label:'Closed'},
        wont_fix:{bg:'#faf5ff',color:'#7c3aed',label:"Won't Fix"},
      }
      const sc = sevCfgB[data.severity] || sevCfgB.medium
      const bc = stCfgB[data.status] || stCfgB.open
      const imgs = (data.attachments||[]).filter((u: string) => !u.match(/\.(mp4|webm|mov)$/i))
      const vids = (data.attachments||[]).filter((u: string) => u.match(/\.(mp4|webm|mov)$/i))
      return (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{sc.label}</span>
            <span style={{ background: bc.bg, color: bc.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{bc.label}</span>
          </div>
          {sprint && <DDRow label="Sprint" value={<button onClick={() => onPush('sprint', sprint)} style={linkBtn}>🏃 {sprint.name} →</button>} />}
          {run && <DDRow label="Test run" value={<button onClick={() => onPush('run', run)} style={linkBtn}>▶ {run.name} →</button>} />}
          {tc && <DDRow label="Test case" value={<button onClick={() => onPush('case', {...tc, sectionName: sections.find(s => s.id === tc.section_id)?.name || ''})} style={linkBtn}>🧪 {tc.title} →</button>} />}
          {data.description && <DDRow label="Description" value={data.description} />}
          {data.steps && <DDRow label="Steps to reproduce" value={<pre style={{ margin:0, fontFamily:'inherit', whiteSpace:'pre-wrap', fontSize:13, color:'#374151' }}>{data.steps}</pre>} />}
          {data.expected_result && <DDRow label="Expected result" value={data.expected_result} />}
          {data.actual_result && <DDRow label="Actual result" value={data.actual_result} />}
          {imgs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>Screenshots ({imgs.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                {imgs.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`screenshot-${i+1}`} style={{ width:'100%', height:90, objectFit:'cover', borderRadius:6, border:'1px solid #e5e7eb', display:'block' }} />
                  </a>
                ))}
              </div>
            </div>
          )}
          {vids.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>Videos ({vids.length})</p>
              {vids.map((url: string, i: number) => (
                <video key={i} src={url} controls style={{ width:'100%', borderRadius:6, marginBottom:6 }} />
              ))}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex' }}>
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} onClick={onClose} />
      {/* Panel */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 520, background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
        {/* Breadcrumb header */}
        <div style={{ padding: '0 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
          {/* Breadcrumb trail */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 0 0', flexWrap: 'wrap' }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af', fontFamily: 'inherit', padding: '2px 4px' }}>Project</button>
            {stack.map((entry, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#d1d5db' }}>›</span>
                <button onClick={() => i < stack.length - 1 ? onGoTo(i) : undefined}
                  style={{ background: 'none', border: 'none', cursor: i < stack.length - 1 ? 'pointer' : 'default', fontSize: 12, color: i === stack.length - 1 ? '#111' : '#6b7280', fontFamily: 'inherit', fontWeight: i === stack.length - 1 ? 600 : 400, padding: '2px 4px' }}>
                  {entry.data.name || entry.data.title}
                </button>
              </span>
            ))}
          </div>
          {/* Current title + back */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {stack.length > 1 && (
                <button onClick={onPop} style={{ background: 'none', border: '1px solid #e5e7eb', cursor: 'pointer', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#6b7280', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ← Back
                </button>
              )}
              <div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{typeLabel[current.type]}</span>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{current.data.name || current.data.title}</h2>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1 }}>×</button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

// DrillDown helper components
function DDRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={sectionLabel}>{label}</p>
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

function DDCard({ children, onClick, last }: { children: React.ReactNode; onClick: () => void; last?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: last ? 0 : 6, background: hovered ? '#f9fafb' : '#fff', transition: 'background 0.1s' }}>
      {children}
    </div>
  )
}

const sectionLabel: React.CSSProperties = { margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: '#2563eb', fontFamily: 'inherit', textDecoration: 'underline' }
const bugLinkBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: '#2563eb', fontFamily: 'inherit', textDecoration: 'underline', textAlign: 'left' as const }

// ─── Fail Comment Modal ───────────────────────────────────────────────────────
function FailCommentModal({ status, runId, caseId, allBugs, projectId, sprints, runs, cases, onConfirm, onClose }: {
  status: RunStatus; runId: string; caseId: string
  allBugs: any[]; projectId: string; sprints: any[]; runs: any[]; cases: any[]
  onConfirm: (comment: string, bugId?: string) => void
  onClose: () => void
}) {
  const [comment, setComment] = useState('')
  const [bugAction, setBugAction] = useState<'none' | 'link' | 'create'>('none')
  const [bugSearch, setBugSearch] = useState('')
  const [selectedBugId, setSelectedBugId] = useState('')
  const [newBugTitle, setNewBugTitle] = useState('')
  const [newBugSeverity, setNewBugSeverity] = useState('medium')
  const [newBugPriority, setNewBugPriority] = useState('medium')
  const [newBugStatus, setNewBugStatus] = useState('open')
  const [newBugDescription, setNewBugDescription] = useState('')
  const [newBugSteps, setNewBugSteps] = useState('')
  const [newBugExpected, setNewBugExpected] = useState('')
  const [newBugActual, setNewBugActual] = useState('')
  const [creating, setCreating] = useState(false)
  const sb = createClient()

  const sc = ({pass:{bg:'#dcfce7',color:'#15803d'},fail:{bg:'#fee2e2',color:'#dc2626'},skip:{bg:'#fef9c3',color:'#ca8a04'}} as any)[status]

  // Filter bugs by search
  const filteredBugs = allBugs.filter(b => {
    const q = bugSearch.toLowerCase()
    return b.title.toLowerCase().includes(q) || b.id.slice(0,8).toUpperCase().includes(q.toUpperCase())
  }).slice(0, 10)

  const handleConfirm = async () => {
    setCreating(true)
    let bugId = selectedBugId || undefined

    // Link existing bug — update its test_run_id and test_case_id
    if (bugAction === 'link' && selectedBugId) {
      await sb.from('bugs').update({
        test_run_id: runId,
        test_case_id: caseId,
      }).eq('id', selectedBugId)
      bugId = selectedBugId
    }

    // Create new bug if needed
    if (bugAction === 'create' && newBugTitle.trim()) {
      const { data: { session } } = await sb.auth.getSession()
      const { data: newBug } = await sb.from('bugs').insert({
        title: newBugTitle.trim(),
        description: newBugDescription.trim() || comment.trim(),
        steps: newBugSteps.trim(),
        expected_result: newBugExpected.trim(),
        actual_result: newBugActual.trim(),
        severity: newBugSeverity,
        status: newBugStatus,
        priority: newBugPriority,
        project_id: projectId,
        test_run_id: runId,
        test_case_id: caseId,
        created_by: session?.user?.id,
      }).select().single()
      bugId = newBug?.id
    }

    onConfirm(comment, bugId)
    setCreating(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Mark as {status === 'pass' ? '✓ Pass' : status === 'fail' ? '✗ Fail' : '— Skip'}
          </span>
          <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{status}</span>
        </div>

        <div style={{ padding: 20 }}>
          {/* Comment */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>
              Comment <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="e.g. Failed on Chrome only, passed on Firefox"
              rows={3} autoFocus
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
          </div>

          {/* Bug linking — only for fail */}
          {status === 'fail' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>Bug (optional)</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button onClick={() => setBugAction('none')}
                  style={{ flex: 1, padding: '7px 0', fontSize: 12, cursor: 'pointer', borderRadius: 6, border: `1px solid ${bugAction === 'none' ? '#111' : '#d1d5db'}`, background: bugAction === 'none' ? '#111' : '#fff', color: bugAction === 'none' ? '#fff' : '#374151', fontWeight: bugAction === 'none' ? 600 : 400 }}>
                  No bug
                </button>
                <button onClick={() => setBugAction('link')}
                  style={{ flex: 1, padding: '7px 0', fontSize: 12, cursor: 'pointer', borderRadius: 6, border: `1px solid ${bugAction === 'link' ? '#2563eb' : '#d1d5db'}`, background: bugAction === 'link' ? '#eff6ff' : '#fff', color: bugAction === 'link' ? '#2563eb' : '#374151', fontWeight: bugAction === 'link' ? 600 : 400 }}>
                  Link existing
                </button>
                <button onClick={() => setBugAction('create')}
                  style={{ flex: 1, padding: '7px 0', fontSize: 12, cursor: 'pointer', borderRadius: 6, border: `1px solid ${bugAction === 'create' ? '#dc2626' : '#d1d5db'}`, background: bugAction === 'create' ? '#fef2f2' : '#fff', color: bugAction === 'create' ? '#dc2626' : '#374151', fontWeight: bugAction === 'create' ? 600 : 400 }}>
                  + New bug
                </button>
              </div>

              {/* Link existing bug */}
              {bugAction === 'link' && (
                <div>
                  <input value={bugSearch} onChange={e => { setBugSearch(e.target.value); setSelectedBugId('') }}
                    placeholder="Search by title or ID..."
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 8 }} />
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 7 }}>
                    {filteredBugs.length === 0 && <p style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af', margin: 0 }}>No bugs found</p>}
                    {filteredBugs.map((bug, i) => {
                      const sevC: any = {critical:'#b91c1c',high:'#c2410c',medium:'#d97706',low:'#15803d'}
                      const stC: any = {open:'#dc2626',in_progress:'#2563eb',resolved:'#15803d',closed:'#374151',wont_fix:'#7c3aed'}
                      return (
                        <div key={bug.id} onClick={() => setSelectedBugId(bug.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: selectedBugId === bug.id ? '#eff6ff' : '#fff' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: selectedBugId === bug.id ? 600 : 400 }}>🐛 {bug.title}</p>
                            <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{bug.id.slice(0,8).toUpperCase()}</p>
                          </div>
                          <span style={{ fontSize: 10, color: sevC[bug.severity], fontWeight: 600 }}>{bug.severity}</span>
                          <span style={{ fontSize: 10, color: stC[bug.status], fontWeight: 600 }}>{bug.status.replace('_',' ')}</span>
                          {selectedBugId === bug.id && <span style={{ color: '#2563eb', fontSize: 14 }}>✓</span>}
                        </div>
                      )
                    })}
                  </div>
                  {selectedBugId && <p style={{ fontSize: 12, color: '#2563eb', margin: '6px 0 0' }}>✓ Bug selected</p>}
                </div>
              )}

              {/* Create new bug — full form */}
              {bugAction === 'create' && (
                <div style={{ border: '1px solid #fecaca', borderRadius: 8, padding: 14, background: '#fff5f5' }}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Title *</label>
                    <input value={newBugTitle} onChange={e => setNewBugTitle(e.target.value)}
                      placeholder="Brief summary of the bug"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, background: '#fff' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Severity</label>
                      <select value={newBugSeverity} onChange={e => setNewBugSeverity(e.target.value)}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 8px', fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer' }}>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Priority</label>
                      <select value={newBugPriority} onChange={e => setNewBugPriority(e.target.value)}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 8px', fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer' }}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Status</label>
                      <select value={newBugStatus} onChange={e => setNewBugStatus(e.target.value)}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 8px', fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer' }}>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Description</label>
                    <textarea value={newBugDescription} onChange={e => setNewBugDescription(e.target.value)}
                      placeholder="What went wrong?"
                      rows={2} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Steps to reproduce</label>
                    <textarea value={newBugSteps} onChange={e => setNewBugSteps(e.target.value)}
                      placeholder="1. Go to... 2. Click... 3. Observe..."
                      rows={3} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Expected result</label>
                      <textarea value={newBugExpected} onChange={e => setNewBugExpected(e.target.value)}
                        placeholder="What should happen?"
                        rows={2} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Actual result</label>
                      <textarea value={newBugActual} onChange={e => setNewBugActual(e.target.value)}
                        placeholder="What actually happened?"
                        rows={2} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>Bug will be linked to this test case and run automatically.</p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleConfirm} disabled={creating || (bugAction === 'create' && !newBugTitle.trim())}
              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}`, borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Saving...' : `Confirm ${status}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
