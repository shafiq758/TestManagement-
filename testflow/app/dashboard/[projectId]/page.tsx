'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { canEditCases, canExecuteRuns, canCreateProjects } from '@/lib/roles'
import MilestonesTab from '@/components/MilestonesTab'
import SprintsTab from '@/components/SprintsTab'
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
  const [tab, setTab] = useState<'cases' | 'runs' | 'sprints' | 'milestones'>('cases')
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')
  const [milestones, setMilestones] = useState<any[]>([])
  const [sprints, setSprints] = useState<any[]>([])
  const [testPlans, setTestPlans] = useState<any[]>([])
  // Global drawer state — rendered at top level to avoid overflow clipping
  const [drawerMilestone, setDrawerMilestone] = useState<any | null>(null)
  const [drawerCase, setDrawerCase] = useState<any | null>(null)
  const [drawerRun, setDrawerRun] = useState<any | null>(null)
  const [drawerRunCase, setDrawerRunCase] = useState<any | null>(null)
  const [drawerRunCaseResults, setDrawerRunCaseResults] = useState<Record<string, RunStatus>>({})
  const [drawerRunId, setDrawerRunId] = useState<string | null>(null)

  const sb = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    // Get user role
    const { data: { session } } = await sb.auth.getSession()
    if (session) {
      const { data: mem } = await sb.from('workspace_members').select('role').eq('user_id', session.user.id).eq('status', 'active').single()
      if (mem) setMyRole(mem.role)
    }
    const [{ data: proj }, { data: secs }, { data: tcs }, { data: trs }, { data: mils }, { data: sprs }, { data: plans }] = await Promise.all([
      sb.from('projects').select('*').eq('id', projectId).single(),
      sb.from('sections').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_cases').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_runs').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('milestones').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('sprints').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_plans').select('*').eq('project_id', projectId).order('created_at'),
    ])
    setProject(proj); setSections(secs || []); setCases(tcs || []); setRuns(trs || [])
    setMilestones(mils || []); setSprints(sprs || []); setTestPlans(plans || [])
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
          {([['cases', 'Test cases'], ['runs', 'Test runs'], ['sprints', 'Sprints'], ['milestones', 'Milestones']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t as any)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#111' : '#6b7280',
              padding: '8px 16px', borderBottom: tab === t ? '2px solid #111' : '2px solid transparent',
              marginBottom: -1,
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
        {tab === 'cases' && (
          <CasesTab sections={sections} cases={cases} projectId={projectId}
            myRole={myRole} onRefresh={load} onViewCase={setDrawerCase} />
        )}
        {tab === 'runs' && (
          <RunsTab runs={runs} cases={cases} sections={sections} sprints={sprints} testPlans={testPlans} projectId={projectId}
            myRole={myRole} onRefresh={load}
            onViewRun={setDrawerRun}
            onViewRunCase={(tc, results, runId) => { setDrawerRunCase(tc); setDrawerRunCaseResults(results); setDrawerRunId(runId) }} />
        )}
        {tab === 'sprints' && (
          <SprintsTab sprints={sprints} milestones={milestones} testPlans={testPlans}
            cases={cases} sections={sections} projectId={projectId}
            canEdit={canEditCases(myRole)} onRefresh={load} />
        )}
        {tab === 'milestones' && (
          <MilestonesTab milestones={milestones} projectId={projectId}
            canEdit={canEditCases(myRole)} onRefresh={load} onViewMilestone={setDrawerMilestone} />
        )}
      </div>

      {/* ── Global Drawers — rendered at top level, never clipped ── */}

      {/* Milestone detail */}
      {drawerMilestone && (
        <GlobalDrawer title={drawerMilestone.name} onClose={() => setDrawerMilestone(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(() => {
              const cfg: Record<string, {bg:string;color:string;label:string}> = {
                open: {bg:'#f3f4f6',color:'#374151',label:'Open'},
                in_progress: {bg:'#dbeafe',color:'#1e40af',label:'In Progress'},
                closed: {bg:'#d1fae5',color:'#065f46',label:'Closed'},
              }
              const c = cfg[drawerMilestone.status]
              return <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{c.label}</span>
            })()}
          </div>
          <GDRow label="Description" value={drawerMilestone.description} />
          <GDRow label="Due date" value={drawerMilestone.due_date ? new Date(drawerMilestone.due_date).toLocaleDateString() : null} />
          <GDRow label="Created" value={new Date(drawerMilestone.created_at).toLocaleDateString()} />
          {/* Linked sprints */}
          {(() => {
            const linked = sprints.filter(s => s.milestone_id === drawerMilestone.id)
            if (linked.length === 0) return null
            return (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sprints ({linked.length})</p>
                {linked.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontSize: 13, flex: 1 }}>🏃 {s.name}</span>
                    <span style={{ fontSize: 11, background: s.status === 'active' ? '#dcfce7' : s.status === 'completed' ? '#dbeafe' : '#f3f4f6', color: s.status === 'active' ? '#15803d' : s.status === 'completed' ? '#1e40af' : '#374151', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>{s.status}</span>
                  </div>
                ))}
              </div>
            )
          })()}
          {canEditCases(myRole) && (
            <button onClick={() => setDrawerMilestone(null)}
              style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
              Close
            </button>
          )}
        </GlobalDrawer>
      )}

      {/* Test Case detail */}
      {drawerCase && (
        <GlobalDrawer title={drawerCase.title} onClose={() => setDrawerCase(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, background: drawerCase.priority === 'high' ? '#fef2f2' : drawerCase.priority === 'medium' ? '#fffbeb' : '#f0fdf4', color: drawerCase.priority === 'high' ? '#dc2626' : drawerCase.priority === 'medium' ? '#d97706' : '#16a34a', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>{drawerCase.priority}</span>
            <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 5 }}>{drawerCase.type}</span>
            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>TC-{drawerCase.id.slice(0,5).toUpperCase()}</span>
          </div>
          <GDRow label="Description" value={drawerCase.description} />
          <GDRow label="Steps to reproduce" value={drawerCase.steps ? <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 13 }}>{drawerCase.steps}</pre> : null} />
          <GDRow label="Expected result" value={drawerCase.expected_result} />
          <GDRow label="Created" value={new Date(drawerCase.created_at).toLocaleDateString()} />
          {canEditCases(myRole) && (
            <button onClick={() => setDrawerCase(null)} style={{ marginTop: 8, border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
              Close
            </button>
          )}
        </GlobalDrawer>
      )}

      {/* Test Run case detail */}
      {drawerRunCase && (
        <GlobalDrawer title={drawerRunCase.title} onClose={() => setDrawerRunCase(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, background: drawerRunCase.priority === 'high' ? '#fef2f2' : drawerRunCase.priority === 'medium' ? '#fffbeb' : '#f0fdf4', color: drawerRunCase.priority === 'high' ? '#dc2626' : drawerRunCase.priority === 'medium' ? '#d97706' : '#16a34a', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>{drawerRunCase.priority}</span>
            <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 5 }}>{drawerRunCase.type}</span>
            <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>TC-{drawerRunCase.id.slice(0,5).toUpperCase()}</span>
          </div>
          <GDRow label="Current status" value={
            <span style={{ fontWeight: 600, color: { pass:'#15803d', fail:'#dc2626', skip:'#ca8a04', untested:'#6b7280' }[drawerRunCaseResults[drawerRunCase.id] || 'untested'] as string }}>
              {drawerRunCaseResults[drawerRunCase.id] || 'untested'}
            </span>
          } />
          <GDRow label="Section" value={drawerRunCase.sectionName} />
          <GDRow label="Description" value={drawerRunCase.description} />
          <GDRow label="Steps to reproduce" value={drawerRunCase.steps ? <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 13 }}>{drawerRunCase.steps}</pre> : null} />
          <GDRow label="Expected result" value={drawerRunCase.expected_result} />
          {drawerRunId && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Update status</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['pass','fail','skip'] as const).map(s => {
                  const sc = {pass:{bg:'#dcfce7',color:'#15803d'},fail:{bg:'#fee2e2',color:'#dc2626'},skip:{bg:'#fef9c3',color:'#ca8a04'}}[s]
                  return <button key={s} onClick={async () => {
                    const run = runs.find(r => r.id === drawerRunId)
                    if (!run) return
                    const sb = createClient()
                    await sb.from('test_runs').update({ results: { ...run.results, [drawerRunCase.id]: s } }).eq('id', drawerRunId)
                    load()
                    setDrawerRunCase(null)
                  }} style={{ flex: 1, padding: '8px 0', fontSize: 13, cursor: 'pointer', borderRadius: 7, border: '1px solid #e5e7eb', fontFamily: 'inherit', fontWeight: 600, background: sc.bg, color: sc.color }}>
                    {s === 'pass' ? '✓ Pass' : s === 'fail' ? '✗ Fail' : '— Skip'}
                  </button>
                })}
              </div>
            </div>
          )}
        </GlobalDrawer>
      )}

      {/* Test Run detail */}
      {drawerRun && (() => {
        const vRunCases = cases.map(c => ({ ...c, sectionName: sections.find(s => s.id === c.section_id)?.name || '' })).filter(c => drawerRun.case_ids.includes(c.id))
        const vResults = drawerRun.results || {}
        const passed = vRunCases.filter(c => vResults[c.id] === 'pass').length
        const failed = vRunCases.filter(c => vResults[c.id] === 'fail').length
        const skipped = vRunCases.filter(c => vResults[c.id] === 'skip').length
        const untested = vRunCases.length - passed - failed - skipped
        const pct = vRunCases.length ? Math.round((passed / vRunCases.length) * 100) : 0
        const sprint = sprints.find(s => s.id === drawerRun.sprint_id)
        const plan = testPlans.find(p => p.id === drawerRun.plan_id)
        const stColors: Record<string, {bg:string;color:string}> = {pass:{bg:'#dcfce7',color:'#15803d'},fail:{bg:'#fee2e2',color:'#dc2626'},skip:{bg:'#fef9c3',color:'#ca8a04'},untested:{bg:'#f3f4f6',color:'#6b7280'}}
        return (
          <GlobalDrawer title={drawerRun.name} onClose={() => setDrawerRun(null)}>
            <GDRow label="Sprint" value={sprint?.name} />
            <GDRow label="Test plan" value={plan?.name} />
            <GDRow label="Created" value={new Date(drawerRun.created_at).toLocaleDateString()} />
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Progress</p>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#15803d' }}>✓ {passed}</span>
                <span style={{ color: '#dc2626' }}>✗ {failed}</span>
                <span style={{ color: '#ca8a04' }}>— {skipped}</span>
                <span style={{ color: '#9ca3af' }}>• {untested} untested</span>
              </div>
              <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a' }} />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{pct}% complete</p>
            </div>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Test cases ({vRunCases.length})</p>
              {vRunCases.map((tc, i) => {
                const st = vResults[tc.id] || 'untested'
                const sc = stColors[st]
                return (
                  <div key={tc.id} onClick={() => { setDrawerRunCase(tc); setDrawerRunCaseResults(vResults); setDrawerRunId(drawerRun.id); setDrawerRun(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', borderRadius: 6 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#f9fafb'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                    <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', minWidth: 52 }}>TC-{tc.id.slice(0,5).toUpperCase()}</span>
                    <span style={{ fontSize: 13, flex: 1, textDecoration: 'underline', textDecorationColor: '#d1d5db' }}>{tc.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: sc.bg, color: sc.color }}>{st}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>→</span>
                  </div>
                )
              })}
            </div>
          </GlobalDrawer>
        )
      })()}
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

function RunsTab({ runs, cases, sections, sprints, testPlans, projectId, myRole, onRefresh, onViewRun, onViewRunCase }: { runs: TestRun[]; cases: TestCase[]; sections: Section[]; sprints: any[]; testPlans: any[]; projectId: string; myRole: WorkspaceRole; onRefresh: () => void; onViewRun: (run: TestRun) => void; onViewRunCase: (tc: any, results: Record<string, RunStatus>, runId: string) => void }) {
  const [creating, setCreating] = useState(false)
  const [activeRun, setActiveRun] = useState<string | null>(null)
  const sb = createClient()

  const createRun = async (name: string, caseIds: string[], sprintId: string, planId: string) => {
    await sb.from('test_runs').insert({ name, case_ids: caseIds, results: {}, project_id: projectId, sprint_id: sprintId, plan_id: planId })
    setCreating(false); onRefresh()
  }

  const updateResult = async (runId: string, caseId: string, status: RunStatus) => {
    const run = runs.find(r => r.id === runId)
    if (!run) return
    const results = { ...run.results, [caseId]: status }
    await sb.from('test_runs').update({ results }).eq('id', runId)
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
                onUpdateResult={updateResult} onBulkUpdate={bulkUpdateResults}
                onViewCase={(tc) => onViewRunCase(tc, results, run.id)} />
            )}
          </div>
        )
      })}

      {creating && (
        <CreateRunModal allCases={allCasesWithSection} sprints={sprints} testPlans={testPlans} onSave={createRun} onClose={() => setCreating(false)} />
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

function RunExecution({ run, runCases, results, onUpdateResult, onBulkUpdate, onViewCase }: {
  run: TestRun
  runCases: any[]
  results: Record<string, RunStatus>
  onUpdateResult: (runId: string, caseId: string, status: RunStatus) => void
  onBulkUpdate: (runId: string, caseIds: string[], status: RunStatus) => void
  onViewCase: (tc: any) => void
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
        return (
          <div key={tc.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
            borderTop: '1px solid #f3f4f6',
            background: isSelected ? '#eff6ff' : 'transparent',
            transition: 'background 0.1s',
          }}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleOne(tc.id)} style={{ cursor: 'pointer', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', minWidth: 52 }}>TC-{tc.id.slice(0, 5).toUpperCase()}</span>
            <button onClick={() => onViewCase(tc)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, flex: 1, color: '#111', textAlign: 'left', textDecoration: 'underline', textDecorationColor: '#d1d5db', fontFamily: 'inherit' }}>{tc.title}</button>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{tc.sectionName}</span>

            {/* Current status badge + individual buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: sc.bg, color: sc.color, minWidth: 54, textAlign: 'center' }}>
                {cur}
              </span>
              <div style={{ display: 'flex', gap: 3 }}>
                {(['pass', 'fail', 'skip'] as const).map(s => (
                  <button key={s} onClick={() => onUpdateResult(run.id, tc.id, s)}
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
        )
      })}
    </div>
    </>
  )
}
