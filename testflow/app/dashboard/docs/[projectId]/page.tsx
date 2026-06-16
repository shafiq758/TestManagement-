'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { canEditCases } from '@/lib/roles'
import type { WorkspaceRole } from '@/types'

export default function DocsListPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const [docs, setDocs] = useState<any[]>([])
  const [project, setProject] = useState<any>(null)
  const [sprints, setSprints] = useState<any[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const sb = createClient()

  useEffect(() => { load() }, [projectId])

  const load = async () => {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.replace('/auth'); return }

    const [{ data: proj }, { data: docsData }, { data: sprs }, { data: mils }, { data: member }] = await Promise.all([
      sb.from('projects').select('*, workspaces(name)').eq('id', projectId).single(),
      sb.from('documents').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }),
      sb.from('sprints').select('*').eq('project_id', projectId),
      sb.from('milestones').select('*').eq('project_id', projectId),
      sb.from('workspace_members').select('role').eq('user_id', session.user.id).single(),
    ])

    setProject(proj)
    setDocs(docsData || [])
    setSprints(sprs || [])
    setMilestones(mils || [])
    setMyRole((member?.role || 'viewer') as WorkspaceRole)
    setLoading(false)
  }

  const createDoc = async () => {
    setCreating(true)
    const { data: { session } } = await sb.auth.getSession()
    const { data: doc } = await sb.from('documents').insert({
      title: 'Untitled Document',
      content: {},
      project_id: projectId,
      created_by: session?.user.id,
      updated_by: session?.user.id,
    }).select().single()

    if (doc) router.push(`/dashboard/docs/${projectId}/${doc.id}`)
    setCreating(false)
  }

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this document? This cannot be undone.')) return
    await sb.from('documents').delete().eq('id', id)
    setDocs(p => p.filter(d => d.id !== id))
  }

  const filtered = docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))
  const canEdit = canEditCases(myRole)

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading docs…</div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <button onClick={() => router.push(`/dashboard/${projectId}`)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit', padding: 0, marginBottom: 4 }}>
              ← {project?.name}
            </button>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>📄 Docs</h1>
          </div>
          {canEdit && (
            <button onClick={createDoc} disabled={creating}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Creating…' : '+ New document'}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            style={{ width: 300, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#fff' }} />
        </div>

        {/* Empty state */}
        {docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>📄</p>
            <p style={{ fontWeight: 600, fontSize: 16, margin: '0 0 8px' }}>No documents yet</p>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>Create PRDs, test strategies, and specs linked to your sprints.</p>
            {canEdit && <button onClick={createDoc} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>+ Create first document</button>}
          </div>
        )}

        {/* Docs grid */}
        {filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map(doc => {
              const sprint = sprints.find(s => s.id === doc.sprint_id)
              const milestone = milestones.find(m => m.id === doc.milestone_id)
              return (
                <div key={doc.id} onClick={() => router.push(`/dashboard/docs/${projectId}/${doc.id}`)}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'box-shadow 0.15s', position: 'relative' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.4, flex: 1, paddingRight: 8 }}>{doc.title}</h3>
                    {canEdit && (
                      <button onClick={(e) => deleteDoc(doc.id, e)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, padding: '0 2px', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#d1d5db'}>
                        ×
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {sprint && <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 4, fontWeight: 500 }}>🏃 {sprint.name}</span>}
                    {milestone && <span style={{ fontSize: 11, background: '#f5f3ff', color: '#7c3aed', padding: '2px 7px', borderRadius: 4, fontWeight: 500 }}>🎯 {milestone.name}</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                    Updated {new Date(doc.updated_at).toLocaleDateString()}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {filtered.length === 0 && docs.length > 0 && (
          <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No documents match your search.</p>
        )}
      </div>
    </div>
  )
}
