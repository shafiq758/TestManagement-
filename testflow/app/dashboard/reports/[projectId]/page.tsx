'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────
interface ReportData {
  project: { id: string; name: string }
  sections: any[]
  cases: any[]
  runs: any[]
  bugs: any[]
  sprints: any[]
  plans: any[]
  execHistory: any[]
  milestones: any[]
}

// ─── Color constants ──────────────────────────────────────────────────────────
const PASS_COLOR = '#16a34a'
const FAIL_COLOR = '#dc2626'
const SKIP_COLOR = '#ca8a04'
const UNTESTED_COLOR = '#9ca3af'
const COLORS = [PASS_COLOR, FAIL_COLOR, SKIP_COLOR, UNTESTED_COLOR]

const SEV_COLORS: Record<string, string> = {
  critical: '#b91c1c',
  high: '#c2410c',
  medium: '#d97706',
  low: '#16a34a',
}

// ─── Helper: compute run stats ───────────────────────────────────────────────
function runStats(run: any) {
  const results = run.results || {}
  const total = run.case_ids?.length || 0
  const pass = Object.values(results).filter(v => v === 'pass').length
  const fail = Object.values(results).filter(v => v === 'fail').length
  const skip = Object.values(results).filter(v => v === 'skip').length
  const untested = total - pass - fail - skip
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  return { total, pass, fail, skip, untested, pct }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 140 }}>
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: '0 0 2px', fontSize: 28, fontWeight: 700, color: color || '#111' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{sub}</p>}
    </div>
  )
}

// ─── Section heading ─────────────────────────────────────────────────────────
function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h2>
      {action}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'runs' | 'coverage' | 'bugs' | 'sprints'>('overview')
  const [exporting, setExporting] = useState(false)
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>([]) // empty = all sprints
  const [showSprintFilter, setShowSprintFilter] = useState(false)
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]) // empty = all runs
  const [showRunFilter, setShowRunFilter] = useState(false)

  // Toggle sprint selection
  const toggleSprint = (id: string) => setSelectedSprintIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const clearSprintFilter = () => setSelectedSprintIds([])

  // Toggle run selection
  const toggleRun = (id: string) => setSelectedRunIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const clearRunFilter = () => setSelectedRunIds([])
  const sb = createClient()

  useEffect(() => { load() }, [projectId])

  const load = async () => {
    setLoading(true)
    const [
      { data: proj },
      { data: secs },
      { data: cases },
      { data: runs },
      { data: bugs },
      { data: sprints },
      { data: plans },
      { data: hist },
      { data: milestones },
    ] = await Promise.all([
      sb.from('projects').select('*').eq('id', projectId).single(),
      sb.from('sections').select('*').eq('project_id', projectId),
      sb.from('test_cases').select('*').eq('project_id', projectId),
      sb.from('test_runs').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('bugs').select('*').eq('project_id', projectId),
      sb.from('sprints').select('*').eq('project_id', projectId).order('created_at'),
      sb.from('test_plans').select('*').eq('project_id', projectId),
      sb.from('execution_history').select('*').in('test_run_id', []),
      sb.from('milestones').select('*').eq('project_id', projectId),
    ])

    // Fetch execution history separately after getting run IDs
    const runIds = (runs || []).map((r: any) => r.id)
    let execHistory: any[] = []
    if (runIds.length > 0) {
      const { data: h } = await sb.from('execution_history').select('*').in('test_run_id', runIds).order('executed_at')
      execHistory = h || []
    }

    setData({
      project: proj,
      sections: secs || [],
      cases: cases || [],
      runs: runs || [],
      bugs: bugs || [],
      sprints: sprints || [],
      plans: plans || [],
      execHistory,
      milestones: milestones || [],
    })
    setLoading(false)
  }

  // ── Export PDF ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!data) return
    setExporting(true)
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text(`Test Report — ${data.project.name}`, 14, 20)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28)

    // Overview stats
    doc.setFontSize(13)
    doc.setTextColor(0)
    doc.text('Overview', 14, 40)

    const totalRuns = data.runs.length
    const totalCases = data.cases.length
    const totalBugs = data.bugs.length
    const openBugs = data.bugs.filter(b => b.status === 'open').length

    autoTable(doc, {
      startY: 44,
      head: [['Metric', 'Value']],
      body: [
        ['Total Test Cases', totalCases],
        ['Total Test Runs', totalRuns],
        ['Total Bugs', totalBugs],
        ['Open Bugs', openBugs],
      ],
      theme: 'striped',
    })

    // Test runs table
    const runsY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(13)
    doc.text('Test Runs', 14, runsY)

    autoTable(doc, {
      startY: runsY + 4,
      head: [['Run Name', 'Sprint', 'Total', 'Pass', 'Fail', 'Skip', 'Untested', 'Pass %']],
      body: filteredRuns.map((run: any) => {
        const s = runStats(run)
        const sprint = data.sprints.find((sp: any) => sp.id === run.sprint_id)
        return [run.name, sprint?.name || '—', s.total, s.pass, s.fail, s.skip, s.untested, `${s.pct}%`]
      }),
      theme: 'striped',
    })

    // Per-run detailed breakdown
    if (filteredRuns.length > 0 && filteredRuns.length <= 10) {
      filteredRuns.forEach((run: any) => {
        const runCaseIds = run.case_ids || []
        const runResults = run.results || {}
        const failedCases = runCaseIds.filter((id: string) => runResults[id] === 'fail')
        if (failedCases.length === 0) return
        const detailY = (doc as any).lastAutoTable.finalY + 8
        doc.setFontSize(11)
        doc.text(`Failed cases in: ${run.name}`, 14, detailY)
        autoTable(doc, {
          startY: detailY + 4,
          head: [['Case ID', 'Title', 'Comment']],
          body: failedCases.map((caseId: string) => {
            const tc = data.cases.find((c: any) => c.id === caseId)
            const hist = data.execHistory.filter((h: any) => h.test_case_id === caseId && h.test_run_id === run.id && h.status === 'fail')
            const lastComment = hist[hist.length - 1]?.comment || ''
            return [`TC-${caseId.slice(0,5).toUpperCase()}`, tc?.title || '—', lastComment]
          }),
          theme: 'striped',
          styles: { fontSize: 10 },
        })
      })
    }

    // Bugs table
    if (data.bugs.length > 0) {
      const bugsY = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(13)
      doc.text('Bugs', 14, bugsY)
      autoTable(doc, {
        startY: bugsY + 4,
        head: [['Title', 'Severity', 'Status', 'Priority']],
        body: data.bugs.map(b => [b.title, b.severity, b.status.replace('_', ' '), b.priority]),
        theme: 'striped',
      })
    }

    doc.save(`${data.project.name}_report.pdf`)
    setExporting(false)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
      Loading reports…
    </div>
  )
  if (!data) return null

  // ── Filtered data based on selected sprints ─────────────────────────────────
  const activeSprints = selectedSprintIds.length > 0
    ? data.sprints.filter(s => selectedSprintIds.includes(s.id))
    : data.sprints

  const activeSprintIds = new Set(activeSprints.map(s => s.id))

  // Filter runs, bugs, plans by selected sprints
  const sprintFilteredRuns = selectedSprintIds.length > 0
    ? data.runs.filter((r: any) => r.sprint_id && activeSprintIds.has(r.sprint_id))
    : data.runs

  const filteredRuns = selectedRunIds.length > 0
    ? sprintFilteredRuns.filter((r: any) => selectedRunIds.includes(r.id))
    : sprintFilteredRuns

  const filteredBugs = selectedSprintIds.length > 0
    ? data.bugs.filter(b => b.sprint_id && activeSprintIds.has(b.sprint_id))
    : data.bugs

  const filteredPlans = selectedSprintIds.length > 0
    ? data.plans.filter(p => p.sprint_id && activeSprintIds.has(p.sprint_id))
    : data.plans

  // Get all case IDs covered in filtered runs
  const filteredRunCaseIds = new Set(filteredRuns.flatMap((r: any) => r.case_ids || []))

  // ── Computed values ─────────────────────────────────────────────────────────
  const totalCases = data.cases.length
  const totalRuns = filteredRuns.length
  const totalBugs = filteredBugs.length
  const openBugs = filteredBugs.filter((b: any) => b.status === 'open').length

  // Overall pass/fail across all runs
  let totalPass = 0, totalFail = 0, totalSkip = 0, totalUntested = 0
  filteredRuns.forEach(run => {
    const s = runStats(run)
    totalPass += s.pass; totalFail += s.fail; totalSkip += s.skip; totalUntested += s.untested
  })
  const overallTotal = totalPass + totalFail + totalSkip + totalUntested
  const overallPct = overallTotal > 0 ? Math.round((totalPass / overallTotal) * 100) : 0

  // Trend data (pass % per run)
  const trendData = filteredRuns.map((run: any) => {
    const s = runStats(run)
    return { name: run.name.length > 12 ? run.name.slice(0, 12) + '…' : run.name, pass: s.pass, fail: s.fail, skip: s.skip, untested: s.untested, pct: s.pct }
  })

  // Coverage: cases that have been executed at least once
  const filteredExecHistory = selectedSprintIds.length > 0
    ? data.execHistory.filter(h => filteredRuns.some((r: any) => r.id === h.test_run_id))
    : data.execHistory
  const executedCaseIds = new Set(filteredExecHistory.map((h: any) => h.test_case_id))
  const coveredCases = data.cases.filter(c => executedCaseIds.has(c.id)).length
  const coveragePct = totalCases > 0 ? Math.round((coveredCases / totalCases) * 100) : 0

  // Coverage by section
  const coverageBySection = data.sections.map(sec => {
    const secCases = data.cases.filter(c => c.section_id === sec.id)
    const covered = secCases.filter(c => executedCaseIds.has(c.id)).length
    return { name: sec.name, total: secCases.length, covered, pct: secCases.length > 0 ? Math.round((covered / secCases.length) * 100) : 0 }
  }).filter(s => s.total > 0)

  // Bugs by severity
  const bugsBySeverity = ['critical', 'high', 'medium', 'low'].map(sev => ({
    name: sev.charAt(0).toUpperCase() + sev.slice(1),
    value: filteredBugs.filter((b: any) => b.severity === sev).length,
    color: SEV_COLORS[sev],
  })).filter(b => b.value > 0)

  // Bugs by status
  const bugsByStatus = [
    { name: 'Open', value: filteredBugs.filter((b: any) => b.status === 'open').length, color: '#dc2626' },
    { name: 'In Progress', value: filteredBugs.filter((b: any) => b.status === 'in_progress').length, color: '#2563eb' },
    { name: 'Resolved', value: filteredBugs.filter((b: any) => b.status === 'resolved').length, color: '#16a34a' },
    { name: 'Closed', value: filteredBugs.filter((b: any) => b.status === 'closed').length, color: '#6b7280' },
    { name: "Won't Fix", value: filteredBugs.filter((b: any) => b.status === 'wont_fix').length, color: '#7c3aed' },
  ].filter(b => b.value > 0)

  // Sprint summary
  const sprintSummary = activeSprints.map((sprint: any) => {
    const sprintPlans = data.plans.filter((p: any) => p.sprint_id === sprint.id)
    const sprintRuns = filteredRuns.filter((r: any) => r.sprint_id === sprint.id)
    const sprintBugs = filteredBugs.filter((b: any) => b.sprint_id === sprint.id)
    let sprintPass = 0, sprintTotal = 0
    sprintRuns.forEach(run => { const s = runStats(run); sprintPass += s.pass; sprintTotal += s.total })
    return {
      name: sprint.name, status: sprint.status,
      plans: sprintPlans.length, runs: sprintRuns.length,
      bugs: sprintBugs.length, openBugs: sprintBugs.filter(b => b.status === 'open').length,
      pct: sprintTotal > 0 ? Math.round((sprintPass / sprintTotal) * 100) : 0,
      total: sprintTotal,
    }
  })

  const tabStyle = (t: string): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: activeTab === t ? 600 : 400,
    color: activeTab === t ? '#111' : '#6b7280',
    padding: '10px 16px', borderBottom: activeTab === t ? '2px solid #111' : '2px solid transparent',
  })

  const cardGrid: React.CSSProperties = { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit', padding: 0, marginBottom: 4 }}>
              ← Back to project
            </button>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Reports — {data.project.name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            {/* Run filter */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowRunFilter(p => !p)}
                style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', background: selectedRunIds.length > 0 ? '#fef9c3' : '#fff', color: selectedRunIds.length > 0 ? '#ca8a04' : '#374151', fontWeight: selectedRunIds.length > 0 ? 600 : 400 }}>
                ▶ {selectedRunIds.length === 0 ? 'All runs' : `${selectedRunIds.length} run${selectedRunIds.length !== 1 ? 's' : ''} selected`} ▾
              </button>
              {showRunFilter && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 260, padding: 8, maxHeight: 320, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px 8px', borderBottom: '1px solid #f3f4f6', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Filter by run</span>
                    {selectedRunIds.length > 0 && (
                      <button onClick={clearRunFilter} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontFamily: 'inherit' }}>Clear all</button>
                    )}
                  </div>
                  {sprintFilteredRuns.map((run: any) => {
                    const sprint = data.sprints.find((s: any) => s.id === run.sprint_id)
                    const s = runStats(run)
                    const isSelected = selectedRunIds.includes(run.id)
                    return (
                      <div key={run.id} onClick={() => toggleRun(run.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', borderRadius: 6, background: isSelected ? '#fef9c3' : 'transparent' }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? '#ca8a04' : '#d1d5db'}`, background: isSelected ? '#ca8a04' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{sprint?.name || 'No sprint'} · {s.pct}% pass</p>
                        </div>
                        <span style={{ fontSize: 11, color: s.pct >= 80 ? PASS_COLOR : s.pct >= 50 ? '#d97706' : FAIL_COLOR, fontWeight: 600 }}>{s.pct}%</span>
                      </div>
                    )
                  })}
                  {sprintFilteredRuns.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', padding: '8px 10px', margin: 0 }}>No runs yet.</p>}
                  <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 6, paddingTop: 8 }}>
                    <button onClick={() => setShowRunFilter(false)}
                      style={{ width: '100%', background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sprint filter */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSprintFilter(p => !p)}
                style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', background: selectedSprintIds.length > 0 ? '#eff6ff' : '#fff', color: selectedSprintIds.length > 0 ? '#2563eb' : '#374151', fontWeight: selectedSprintIds.length > 0 ? 600 : 400 }}>
                🏃 {selectedSprintIds.length === 0 ? 'All sprints' : `${selectedSprintIds.length} sprint${selectedSprintIds.length !== 1 ? 's' : ''} selected`} ▾
              </button>
              {showSprintFilter && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 220, padding: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px 8px', borderBottom: '1px solid #f3f4f6', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Filter by sprint</span>
                    {selectedSprintIds.length > 0 && (
                      <button onClick={clearSprintFilter} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontFamily: 'inherit' }}>Clear all</button>
                    )}
                  </div>
                  {data.sprints.map(sprint => {
                    const sc: Record<string,{bg:string;color:string}> = {
                      planned:{bg:'#f3f4f6',color:'#374151'},
                      active:{bg:'#dcfce7',color:'#15803d'},
                      completed:{bg:'#dbeafe',color:'#1e40af'},
                    }
                    const ss = sc[sprint.status] || sc.planned
                    const isSelected = selectedSprintIds.includes(sprint.id)
                    return (
                      <div key={sprint.id} onClick={() => toggleSprint(sprint.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', borderRadius: 6, background: isSelected ? '#eff6ff' : 'transparent' }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? '#2563eb' : '#d1d5db'}`, background: isSelected ? '#2563eb' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 13, flex: 1 }}>{sprint.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: ss.bg, color: ss.color }}>{sprint.status}</span>
                      </div>
                    )
                  })}
                  {data.sprints.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', padding: '8px 10px', margin: 0 }}>No sprints yet.</p>}
                  <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 6, paddingTop: 8 }}>
                    <button onClick={() => setShowSprintFilter(false)}
                      style={{ width: '100%', background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleExportPDF} disabled={exporting}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
              {exporting ? 'Exporting…' : '⬇ Export PDF'}
            </button>
          </div>
        </div>
        {/* Sprint filter active banner */}
        {(selectedSprintIds.length > 0 || selectedRunIds.length > 0) && (
          <div style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {selectedSprintIds.length > 0 && (
              <span style={{ fontSize: 12, background: '#eff6ff', color: '#2563eb', padding: '2px 10px', borderRadius: 5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                🏃 {activeSprints.map((s: any) => s.name).join(', ')}
                <button onClick={clearSprintFilter} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#93c5fd', fontFamily: 'inherit', padding: 0 }}>✕</button>
              </span>
            )}
            {selectedRunIds.length > 0 && (
              <span style={{ fontSize: 12, background: '#fef9c3', color: '#ca8a04', padding: '2px 10px', borderRadius: 5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                ▶ {selectedRunIds.length} run{selectedRunIds.length !== 1 ? 's' : ''} selected
                <button onClick={clearRunFilter} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#fbbf24', fontFamily: 'inherit', padding: 0 }}>✕</button>
              </span>
            )}
          </div>
        )}
        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {(['overview', 'runs', 'coverage', 'bugs', 'sprints'] as const).map(t => (
            <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 24 }}>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div>
            {/* Top stats */}
            <div style={cardGrid}>
              <StatCard label="Test Cases" value={totalCases} sub={`${data.sections.length} sections`} />
              <StatCard label="Test Runs" value={totalRuns} />
              <StatCard label="Overall Pass Rate" value={`${overallPct}%`} sub={`${totalPass} passed`} color={overallPct >= 80 ? PASS_COLOR : overallPct >= 50 ? '#d97706' : FAIL_COLOR} />
              <StatCard label="Open Bugs" value={openBugs} sub={`${totalBugs} total`} color={openBugs > 0 ? FAIL_COLOR : PASS_COLOR} />
              <StatCard label="Coverage" value={`${coveragePct}%`} sub={`${coveredCases} of ${totalCases} cases run`} />
            </div>

            {/* Pass/fail breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <SectionHead title="Overall Results" />
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  {[
                    { label: 'Pass', value: totalPass, color: PASS_COLOR },
                    { label: 'Fail', value: totalFail, color: FAIL_COLOR },
                    { label: 'Skip', value: totalSkip, color: SKIP_COLOR },
                    { label: 'Untested', value: totalUntested, color: UNTESTED_COLOR },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{item.label}</p>
                    </div>
                  ))}
                </div>
                {overallTotal > 0 && (
                  <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                    {totalPass > 0 && <div style={{ width: `${(totalPass/overallTotal)*100}%`, background: PASS_COLOR }} />}
                    {totalFail > 0 && <div style={{ width: `${(totalFail/overallTotal)*100}%`, background: FAIL_COLOR }} />}
                    {totalSkip > 0 && <div style={{ width: `${(totalSkip/overallTotal)*100}%`, background: SKIP_COLOR }} />}
                    {totalUntested > 0 && <div style={{ width: `${(totalUntested/overallTotal)*100}%`, background: '#e5e7eb' }} />}
                  </div>
                )}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <SectionHead title="Bugs by Status" />
                {bugsByStatus.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No bugs reported yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={bugsByStatus} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                        {bugsByStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Pass rate trend */}
            {trendData.length > 1 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <SectionHead title="Pass Rate Trend (across runs)" />
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Line type="monotone" dataKey="pct" stroke={PASS_COLOR} strokeWidth={2} dot={{ fill: PASS_COLOR, r: 4 }} name="Pass %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── RUNS TAB ── */}
        {activeTab === 'runs' && (
          <div>
            <div style={cardGrid}>
              <StatCard label="Total Runs" value={totalRuns} />
              <StatCard label="Total Executions" value={data.execHistory.length} />
              <StatCard label="Avg Pass Rate" value={`${totalRuns > 0 ? Math.round(filteredRuns.reduce((sum: number, r: any) => sum + runStats(r).pct, 0) / totalRuns) : 0}%`} />
            </div>

            {/* Bar chart: pass/fail per run */}
            {trendData.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <SectionHead title="Results per Run" />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={trendData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="pass" fill={PASS_COLOR} name="Pass" radius={[3,3,0,0]} />
                    <Bar dataKey="fail" fill={FAIL_COLOR} name="Fail" radius={[3,3,0,0]} />
                    <Bar dataKey="skip" fill={SKIP_COLOR} name="Skip" radius={[3,3,0,0]} />
                    <Bar dataKey="untested" fill="#e5e7eb" name="Untested" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Run detail table */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Run Name', 'Date', 'Total', 'Pass', 'Fail', 'Skip', 'Untested', 'Pass %'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run: any, i: number) => {
                    const s = runStats(run)
                    return (
                      <tr key={run.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{run.name}</td>
                        <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{new Date(run.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 14px' }}>{s.total}</td>
                        <td style={{ padding: '10px 14px', color: PASS_COLOR, fontWeight: 600 }}>{s.pass}</td>
                        <td style={{ padding: '10px 14px', color: FAIL_COLOR, fontWeight: 600 }}>{s.fail}</td>
                        <td style={{ padding: '10px 14px', color: SKIP_COLOR }}>{s.skip}</td>
                        <td style={{ padding: '10px 14px', color: UNTESTED_COLOR }}>{s.untested}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                              <div style={{ width: `${s.pct}%`, height: '100%', background: s.pct >= 80 ? PASS_COLOR : s.pct >= 50 ? '#d97706' : FAIL_COLOR }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: s.pct >= 80 ? PASS_COLOR : s.pct >= 50 ? '#d97706' : FAIL_COLOR }}>{s.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredRuns.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No test runs yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── COVERAGE TAB ── */}
        {activeTab === 'coverage' && (
          <div>
            <div style={cardGrid}>
              <StatCard label="Total Cases" value={totalCases} />
              <StatCard label="Executed" value={coveredCases} sub="at least once" />
              <StatCard label="Never Run" value={totalCases - coveredCases} color={totalCases - coveredCases > 0 ? FAIL_COLOR : PASS_COLOR} />
              <StatCard label="Coverage" value={`${coveragePct}%`} color={coveragePct >= 80 ? PASS_COLOR : coveragePct >= 50 ? '#d97706' : FAIL_COLOR} />
            </div>

            {/* Coverage by section */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <SectionHead title="Coverage by Section" />
              {coverageBySection.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No sections yet.</p>
              ) : (
                <div>
                  {coverageBySection.map((sec, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{sec.name}</span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{sec.covered}/{sec.total} cases · {sec.pct}%</span>
                      </div>
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${sec.pct}%`, height: '100%', background: sec.pct >= 80 ? PASS_COLOR : sec.pct >= 50 ? '#d97706' : FAIL_COLOR, borderRadius: 4, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Never run cases */}
            {(() => {
              const neverRun = data.cases.filter(c => !executedCaseIds.has(c.id))
              if (neverRun.length === 0) return (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 14, color: PASS_COLOR, fontWeight: 600 }}>✓ All test cases have been executed at least once!</p>
                </div>
              )
              return (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', background: '#fef2f2' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: FAIL_COLOR }}>⚠ {neverRun.length} test case{neverRun.length !== 1 ? 's' : ''} never executed</p>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['ID', 'Title', 'Section', 'Priority'].map(h => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {neverRun.map((tc, i) => {
                        const sec = data.sections.find(s => s.id === tc.section_id)
                        const pc: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }
                        return (
                          <tr key={tc.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                            <td style={{ padding: '9px 14px', color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>TC-{tc.id.slice(0,5).toUpperCase()}</td>
                            <td style={{ padding: '9px 14px', fontWeight: 500 }}>{tc.title}</td>
                            <td style={{ padding: '9px 14px', color: '#6b7280' }}>{sec?.name || '—'}</td>
                            <td style={{ padding: '9px 14px', color: pc[tc.priority] || '#6b7280', fontWeight: 600 }}>{tc.priority}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── BUGS TAB ── */}
        {activeTab === 'bugs' && (
          <div>
            <div style={cardGrid}>
              <StatCard label="Total Bugs" value={totalBugs} />
              <StatCard label="Open" value={openBugs} color={openBugs > 0 ? FAIL_COLOR : PASS_COLOR} />
              <StatCard label="Resolved" value={data.bugs.filter(b => b.status === 'resolved').length} color={PASS_COLOR} />
              <StatCard label="Critical" value={data.bugs.filter(b => b.severity === 'critical').length} color={data.bugs.filter(b => b.severity === 'critical').length > 0 ? '#b91c1c' : PASS_COLOR} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* By severity */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <SectionHead title="By Severity" />
                {bugsBySeverity.length === 0 ? <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No bugs yet.</p> : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={bugsBySeverity} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
                      <Tooltip />
                      <Bar dataKey="value" name="Bugs" radius={[0,3,3,0]}>
                        {bugsBySeverity.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* By status */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <SectionHead title="By Status" />
                {bugsByStatus.length === 0 ? <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No bugs yet.</p> : (
                  <div>
                    {bugsByStatus.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13 }}>{s.name}</span>
                        <div style={{ width: 100, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${totalBugs > 0 ? (s.value/totalBugs)*100 : 0}%`, height: '100%', background: s.color }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: s.color, minWidth: 24, textAlign: 'right' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bug list */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Title', 'Severity', 'Priority', 'Status', 'Sprint', 'Created'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBugs.map((bug: any, i: number) => {
                    const sprint = data.sprints.find(s => s.id === bug.sprint_id)
                    const sevC: Record<string,string> = {critical:'#b91c1c',high:'#c2410c',medium:'#d97706',low:'#16a34a'}
                    const stC: Record<string,string> = {open:'#dc2626',in_progress:'#2563eb',resolved:'#16a34a',closed:'#6b7280',wont_fix:'#7c3aed'}
                    return (
                      <tr key={bug.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{bug.title}</td>
                        <td style={{ padding: '10px 14px', color: sevC[bug.severity], fontWeight: 600, textTransform: 'capitalize' }}>{bug.severity}</td>
                        <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>{bug.priority}</td>
                        <td style={{ padding: '10px 14px', color: stC[bug.status], fontWeight: 600 }}>{bug.status.replace('_',' ')}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280' }}>{sprint?.name || '—'}</td>
                        <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{new Date(bug.created_at).toLocaleDateString()}</td>
                      </tr>
                    )
                  })}
                  {filteredBugs.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No bugs reported yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SPRINTS TAB ── */}
        {activeTab === 'sprints' && (
          <div>
            <div style={cardGrid}>
              <StatCard label="Total Sprints" value={data.sprints.length} />
              <StatCard label="Active" value={data.sprints.filter(s => s.status === 'active').length} color="#15803d" />
              <StatCard label="Completed" value={data.sprints.filter(s => s.status === 'completed').length} color="#2563eb" />
              <StatCard label="Milestones" value={data.milestones.length} />
            </div>

            {/* Sprint summary table */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Sprint', 'Status', 'Plans', 'Runs', 'Open Bugs', 'Pass Rate'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sprintSummary.map((s, i) => {
                    const sc: Record<string,{bg:string;color:string;label:string}> = {
                      planned:{bg:'#f3f4f6',color:'#374151',label:'Planned'},
                      active:{bg:'#dcfce7',color:'#15803d',label:'Active'},
                      completed:{bg:'#dbeafe',color:'#1e40af',label:'Completed'},
                    }
                    const ss = sc[s.status] || sc.planned
                    return (
                      <tr key={i} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{s.name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{ss.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{s.plans}</td>
                        <td style={{ padding: '10px 14px' }}>{s.runs}</td>
                        <td style={{ padding: '10px 14px', color: s.openBugs > 0 ? FAIL_COLOR : PASS_COLOR, fontWeight: 600 }}>{s.openBugs}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {s.total > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                                <div style={{ width: `${s.pct}%`, height: '100%', background: s.pct >= 80 ? PASS_COLOR : s.pct >= 50 ? '#d97706' : FAIL_COLOR }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{s.pct}%</span>
                            </div>
                          ) : <span style={{ color: '#9ca3af', fontSize: 12 }}>No runs</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {sprintSummary.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No sprints yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Sprint pass rate chart */}
            {sprintSummary.filter(s => s.total > 0).length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <SectionHead title="Pass Rate by Sprint" />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sprintSummary.filter(s => s.total > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="pct" name="Pass Rate" radius={[4,4,0,0]}>
                      {sprintSummary.filter(s => s.total > 0).map((s, i) => (
                        <Cell key={i} fill={s.pct >= 80 ? PASS_COLOR : s.pct >= 50 ? '#d97706' : FAIL_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
