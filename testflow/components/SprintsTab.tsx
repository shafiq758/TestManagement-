'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Sprint, SprintStatus, Milestone, TestPlan, TestCase, Section } from '@/types'

const STATUS_CFG: Record<SprintStatus, { label: string; bg: string; color: string }> = {
  planned:   { label: 'Planned',   bg: '#f3f4f6', color: '#374151' },
  active:    { label: 'Active',    bg: '#dcfce7', color: '#15803d' },
  completed: { label: 'Completed', bg: '#dbeafe', color: '#1e40af' },
}

function Badge({ status }: { status: SprintStatus }) {
  const c = STATUS_CFG[status]
  return <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{c.label}</span>
}

function Modal({ title, onClose, children, width = 500 }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }}>
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

const inpStyle: React.CSSProperties = { width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 12px', fontSize: 13, background: '#fff', cursor: 'pointer' }
const smBtn: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 12, background: '#fff', cursor: 'pointer' }

export default function SprintsTab({ sprints, milestones, testPlans, cases, sections, projectId, onRefresh, canEdit }: {
  sprints: Sprint[]; milestones: Milestone[]; testPlans: TestPlan[]
  cases: TestCase[]; sections: Section[]; projectId: string; onRefresh: () => void; canEdit: boolean
}) {
  const [showSprintModal, setShowSprintModal] = useState(false)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [showPlanModal, setShowPlanModal] = useState<string | null>(null) // sprintId
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null)
  const [expandedSprints, setExpandedSprints] = useState<Record<string, boolean>>({})

  const [sprintForm, setSprintForm] = useState({ name: '', goal: '', status: 'planned' as SprintStatus, start_date: '', end_date: '', milestone_id: '' })
  const [planForm, setPlanForm] = useState({ name: '', description: '', case_ids: [] as string[] })
  const [caseSearch, setCaseSearch] = useState('')

  const sb = createClient()

  const toggleSprint = (id: string) => setExpandedSprints(p => ({ ...p, [id]: !p[id] }))

  const openCreateSprint = () => {
    setSprintForm({ name: '', goal: '', status: 'planned', start_date: '', end_date: '', milestone_id: '' })
    setEditingSprint(null); setShowSprintModal(true)
  }
  const openEditSprint = (s: Sprint) => {
    setSprintForm({ name: s.name, goal: s.goal, status: s.status, start_date: s.start_date || '', end_date: s.end_date || '', milestone_id: s.milestone_id || '' })
    setEditingSprint(s); setShowSprintModal(true)
  }

  const saveSprint = async () => {
    if (!sprintForm.name.trim()) return
    const payload = { ...sprintForm, project_id: projectId, start_date: sprintForm.start_date || null, end_date: sprintForm.end_date || null, milestone_id: sprintForm.milestone_id || null }
    if (editingSprint) {
      await sb.from('sprints').update(payload).eq('id', editingSprint.id)
    } else {
      await sb.from('sprints').insert(payload)
    }
    setShowSprintModal(false); onRefresh()
  }

  const deleteSprint = async (id: string) => {
    if (!confirm('Delete this sprint and all its test plans?')) return
    await sb.from('sprints').delete().eq('id', id)
    onRefresh()
  }

  const openCreatePlan = (sprintId: string) => {
    setPlanForm({ name: '', description: '', case_ids: [] })
    setEditingPlan(null); setShowPlanModal(sprintId)
  }
  const openEditPlan = (plan: TestPlan) => {
    setPlanForm({ name: plan.name, description: plan.description, case_ids: plan.case_ids })
    setEditingPlan(plan); setShowPlanModal(plan.sprint_id)
  }

  const savePlan = async () => {
    if (!planForm.name.trim() || !showPlanModal) return
    if (editingPlan) {
      await sb.from('test_plans').update(planForm).eq('id', editingPlan.id)
    } else {
      await sb.from('test_plans').insert({ ...planForm, sprint_id: showPlanModal, project_id: projectId })
    }
    setShowPlanModal(null); onRefresh()
  }

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this test plan?')) return
    await sb.from('test_plans').delete().eq('id', id)
    onRefresh()
  }

  const toggleCase = (id: string) => setPlanForm(p => ({
    ...p, case_ids: p.case_ids.includes(id) ? p.case_ids.filter(x => x !== id) : [...p.case_ids, id]
  }))

  const filteredCases = cases.filter(c =>
    !caseSearch || c.title.toLowerCase().includes(caseSearch.toLowerCase())
  )

  const allCasesWithSection = cases.map(c => ({
    ...c, sectionName: sections.find(s => s.id === c.section_id)?.name || ''
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{sprints.length} sprint{sprints.length !== 1 ? 's' : ''}</p>
        {canEdit && <button onClick={openCreateSprint} style={btnStyle}>+ Add sprint</button>}
      </div>

      {sprints.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 28, margin: '0 0 10px' }}>🏃</p>
          <p style={{ fontWeight: 500, margin: '0 0 6px' }}>No sprints yet</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Sprints organize test plans and runs into time-boxed periods.</p>
          {canEdit && <button onClick={openCreateSprint} style={btnStyle}>+ Add sprint</button>}
        </div>
      )}

      {sprints.map(sprint => {
        const sprintPlans = testPlans.filter(p => p.sprint_id === sprint.id)
        const milestone = milestones.find(m => m.id === sprint.milestone_id)
        const isOpen = expandedSprints[sprint.id] !== false

        return (
          <div key={sprint.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
            {/* Sprint header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f9fafb', borderBottom: isOpen ? '1px solid #e5e7eb' : 'none' }}>
              <button onClick={() => toggleSprint(sprint.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af', padding: 0 }}>
                {isOpen ? '▾' : '▸'}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{sprint.name}</span>
                  <Badge status={sprint.status} />
                  {milestone && <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>🎯 {milestone.name}</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
                  {sprint.start_date && <span>Start: {new Date(sprint.start_date).toLocaleDateString()}</span>}
                  {sprint.end_date && <span>End: {new Date(sprint.end_date).toLocaleDateString()}</span>}
                  <span>{sprintPlans.length} test plan{sprintPlans.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openCreatePlan(sprint.id)} style={smBtn}>+ Test plan</button>
                  <button onClick={() => openEditSprint(sprint)} style={smBtn}>Edit</button>
                  <button onClick={() => deleteSprint(sprint.id)} style={smBtn}>✕</button>
                </div>
              )}
            </div>

            {/* Sprint goal */}
            {isOpen && sprint.goal && (
              <div style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>🎯 Goal: {sprint.goal}</p>
              </div>
            )}

            {/* Test plans */}
            {isOpen && (
              <div>
                {sprintPlans.length === 0 && (
                  <p style={{ padding: '14px 16px', margin: 0, fontSize: 13, color: '#9ca3af' }}>
                    No test plans yet —{' '}
                    {canEdit && <button onClick={() => openCreatePlan(sprint.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', fontSize: 13, textDecoration: 'underline', fontFamily: 'inherit' }}>create one</button>}
                  </p>
                )}
                {sprintPlans.map((plan, i) => {
                  const planCases = allCasesWithSection.filter(c => plan.case_ids.includes(c.id))
                  return (
                    <div key={plan.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>📋 {plan.name}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>{planCases.length} case{planCases.length !== 1 ? 's' : ''}</span>
                          </div>
                          {plan.description && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>{plan.description}</p>}
                          {/* Case list */}
                          {planCases.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {planCases.slice(0, 5).map(c => (
                                <span key={c.id} style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '1px 7px', borderRadius: 4 }}>
                                  TC-{c.id.slice(0, 5).toUpperCase()}
                                </span>
                              ))}
                              {planCases.length > 5 && <span style={{ fontSize: 11, color: '#9ca3af' }}>+{planCases.length - 5} more</span>}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEditPlan(plan)} style={smBtn}>Edit</button>
                            <button onClick={() => deletePlan(plan.id)} style={smBtn}>✕</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Sprint Modal */}
      {showSprintModal && (
        <Modal title={editingSprint ? 'Edit sprint' : 'New sprint'} onClose={() => setShowSprintModal(false)}>
          <Field label="Sprint name"><input value={sprintForm.name} onChange={e => setSprintForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Sprint 1" autoFocus style={inpStyle} /></Field>
          <Field label="Goal"><textarea value={sprintForm.goal} onChange={e => setSprintForm(p => ({ ...p, goal: e.target.value }))} placeholder="What should this sprint achieve?" rows={2} style={{ ...inpStyle, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <Field label="Start date"><input value={sprintForm.start_date} onChange={e => setSprintForm(p => ({ ...p, start_date: e.target.value }))} type="date" style={inpStyle} /></Field>
            <Field label="End date"><input value={sprintForm.end_date} onChange={e => setSprintForm(p => ({ ...p, end_date: e.target.value }))} type="date" style={inpStyle} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <Field label="Status">
              <select value={sprintForm.status} onChange={e => setSprintForm(p => ({ ...p, status: e.target.value as SprintStatus }))} style={{ ...inpStyle, cursor: 'pointer' }}>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <Field label="Milestone (optional)">
              <select value={sprintForm.milestone_id} onChange={e => setSprintForm(p => ({ ...p, milestone_id: e.target.value }))} style={{ ...inpStyle, cursor: 'pointer' }}>
                <option value="">None</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowSprintModal(false)} style={smBtn}>Cancel</button>
            <button onClick={saveSprint} style={{ ...smBtn, background: '#111', color: '#fff', border: 'none' }}>Save</button>
          </div>
        </Modal>
      )}

      {/* Test Plan Modal */}
      {showPlanModal && (
        <Modal title={editingPlan ? 'Edit test plan' : 'New test plan'} onClose={() => setShowPlanModal(null)} width={560}>
          <Field label="Plan name"><input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Regression suite" autoFocus style={inpStyle} /></Field>
          <Field label="Description"><textarea value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} placeholder="What does this plan cover?" rows={2} style={{ ...inpStyle, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Select test cases ({planForm.case_ids.length} selected)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPlanForm(p => ({ ...p, case_ids: cases.map(c => c.id) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontFamily: 'inherit' }}>All</button>
                <button onClick={() => setPlanForm(p => ({ ...p, case_ids: [] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6b7280', fontFamily: 'inherit' }}>None</button>
              </div>
            </div>
            <input value={caseSearch} onChange={e => setCaseSearch(e.target.value)} placeholder="Search test cases..." style={{ ...inpStyle, marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              {filteredCases.map((tc, i) => {
                const sec = sections.find(s => s.id === tc.section_id)
                return (
                  <label key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: planForm.case_ids.includes(tc.id) ? '#eff6ff' : '#fff' }}>
                    <input type="checkbox" checked={planForm.case_ids.includes(tc.id)} onChange={() => toggleCase(tc.id)} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>TC-{tc.id.slice(0, 5).toUpperCase()}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{tc.title}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{sec?.name}</span>
                  </label>
                )
              })}
              {filteredCases.length === 0 && <p style={{ padding: '12px', fontSize: 13, color: '#9ca3af', margin: 0 }}>No test cases found.</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowPlanModal(null)} style={smBtn}>Cancel</button>
            <button onClick={savePlan} disabled={!planForm.name.trim()} style={{ ...smBtn, background: '#111', color: '#fff', border: 'none', opacity: planForm.name.trim() ? 1 : 0.5 }}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
