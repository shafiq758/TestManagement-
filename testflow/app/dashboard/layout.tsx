'use client'
import { useEffect, useState, useCallback } from 'react'
import { useInactivity } from '@/lib/useInactivity'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { canCreateProjects, canManageMembers, ROLE_LABELS, ROLE_COLORS } from '@/lib/roles'
import WorkspaceSetup from '@/components/WorkspaceSetup'
import type { Project, Workspace, WorkspaceRole } from '@/types'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const activeId = params?.projectId as string | undefined
  const [projects, setProjects] = useState<Project[]>([])
  const [user, setUser] = useState<any>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'projects' | 'members'>('projects')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/auth'); return }
      const u = data.session.user
      // Super admin has their own panel
      if (u.email === 'muhamad.shafiqurrehman@gmail.com') {
        router.replace('/superadmin'); return
      }
      setUser(u)
      await loadWorkspace(sb, u)
      setLoading(false)
    })
  }, [])

  const loadWorkspace = async (sb: any, u: any) => {
    // Check if user is a member of any workspace
    const { data: membership } = await sb.from('workspace_members')
      .select('*, workspaces(*)')
      .eq('user_id', u.id)
      .eq('status', 'active')
      .order('created_at')
      .limit(1)
      .single()

    if (membership?.workspaces) {
      setWorkspace(membership.workspaces)
      setMyRole(membership.role)
      fetchProjects(sb, membership.workspaces.id)
      // Also claim any pending invites by email
      await claimPendingInvite(sb, u)
    } else {
      // Check for pending invite by email
      const claimed = await claimPendingInvite(sb, u)
      if (claimed) {
        await loadWorkspace(sb, u)
      }
    }
  }

  const claimPendingInvite = async (sb: any, u: any) => {
    const { data: pending } = await sb.from('workspace_members')
      .select('*').eq('invited_email', u.email).eq('status', 'pending').limit(1).single()
    if (pending) {
      await sb.from('workspace_members').update({ user_id: u.id, status: 'active' }).eq('id', pending.id)
      return true
    }
    return false
  }

  const fetchProjects = async (sb: any, wsId: string) => {
    const { data: { session } } = await sb.auth.getSession()
    const { data: memberData } = await sb.from('workspace_members').select('role, user_id').eq('user_id', session?.user.id || '').eq('workspace_id', wsId).single()
    
    let projectData
    if (memberData?.role === 'admin') {
      // Admins see all projects
      const { data } = await sb.from('projects').select('*').eq('workspace_id', wsId).order('created_at')
      projectData = data
    } else {
      // Others only see projects they're added to
      const { data: pm } = await sb.from('project_members').select('project_id').eq('user_id', session?.user.id || '')
      const projectIds = (pm || []).map((p: any) => p.project_id)
      if (projectIds.length > 0) {
        const { data } = await sb.from('projects').select('*').eq('workspace_id', wsId).in('id', projectIds).order('created_at')
        projectData = data
      } else {
        projectData = []
      }
    }
    setProjects(projectData || [])
  }

  const createProject = async () => {
    if (!newName.trim() || !workspace) return
    const sb = createClient()
    const { data, error } = await sb.from('projects').insert({ name: newName.trim(), workspace_id: workspace.id }).select().single()
    if (error) {
      if (error.code === '23505') alert(`A project named "${newName.trim()}" already exists in this workspace.`)
      else alert(error.message)
      return
    }
    if (data) {
      setProjects(p => [...p, data])
      setNewName(''); setCreating(false)
      router.push(`/dashboard/${data.id}`)
    }
  }

  const deleteProject = async (projectId: string, projectName: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(`Delete project "${projectName}"? This will permanently delete all sections, test cases, runs, sprints, milestones and bugs inside it.`)) return
    const sb = createClient()
    await sb.from('projects').delete().eq('id', projectId)
    setProjects(p => p.filter(x => x.id !== projectId))
    if (activeId === projectId) router.push('/dashboard')
  }

  const logout = useCallback(async () => {
    await createClient().auth.signOut()
    router.replace('/auth')
  }, [router])

  const { showWarning, secondsLeft, reset } = useInactivity(logout)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p>
    </div>
  )

  // No workspace — show setup screen
  if (!workspace) return <WorkspaceSetup userId={user?.id} userEmail={user?.email} />

  const rc = ROLE_COLORS[myRole]

  return (
    <>
    {showWarning && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#f59e0b', color: '#111', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 }}>
        <span>⚠️ You've been inactive for 15 minutes. You'll be logged out in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}.</span>
        <button onClick={reset} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Stay logged in
        </button>
      </div>
    )}
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', marginTop: showWarning ? 40 : 0 }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#111"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".5"/>
            </svg>
            <span style={{ fontWeight: 600, fontSize: 15 }}>TestFlow</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {workspace.name}
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {(['projects', 'members'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: activeTab === t ? 600 : 400,
              color: activeTab === t ? '#111' : '#9ca3af',
              padding: '8px 4px',
              borderBottom: activeTab === t ? '2px solid #111' : '2px solid transparent',
              fontFamily: 'inherit', textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {activeTab === 'projects' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px 6px' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projects</span>
                {canCreateProjects(myRole) && (
                  <button onClick={() => setCreating(true)} style={iconBtn} title="New project">+</button>
                )}
              </div>

              {projects.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 2, gap: 0 }}
                onMouseEnter={e => { const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement; if(btn) btn.style.opacity='1' }}
                onMouseLeave={e => { const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement; if(btn) btn.style.opacity='0' }}>
                <Link href={`/dashboard/${p.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 8, flex: 1,
                  padding: '7px 10px', borderRadius: 8, textDecoration: 'none',
                  background: activeId === p.id ? '#fff' : 'transparent',
                  border: activeId === p.id ? '1px solid #e5e7eb' : '1px solid transparent',
                  color: '#111', fontSize: 13,
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4a1 1 0 011-1h3l1.5 2H13a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" fill="#9ca3af"/>
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </Link>
                {activeId === p.id && (
                  <Link href={`/dashboard/docs/${p.id}`}
                    style={{ display: 'block', fontSize: 11, color: '#6b7280', textDecoration: 'none', padding: '3px 10px 3px 32px', borderRadius: 6 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#111'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6b7280'}>
                    📄 Docs
                  </Link>
                )}
                {canCreateProjects(myRole) && (
                  <button className="del-btn" onClick={(e) => deleteProject(p.id, p.name, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#d1d5db', padding: '2px 4px', opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                    title="Delete project">✕</button>
                )}
              </div>
              ))}

              {creating && canCreateProjects(myRole) && (
                <div style={{ padding: '6px 4px', display: 'flex', gap: 4 }}>
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Project name" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setCreating(false) }}
                    style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none' }} />
                  <button onClick={createProject} style={{ ...iconBtn, color: '#16a34a' }}>✓</button>
                  <button onClick={() => setCreating(false)} style={{ ...iconBtn, color: '#6b7280' }}>✕</button>
                </div>
              )}

              {projects.length === 0 && !creating && (
                <p style={{ fontSize: 12, color: '#9ca3af', padding: '4px 10px' }}>
                  {canCreateProjects(myRole) ? 'No projects yet' : 'No projects available'}
                </p>
              )}
            </>
          )}

          {activeTab === 'members' && (
            <div style={{ padding: '4px' }}>
              <button onClick={() => router.push('/dashboard/members')}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: '1px solid transparent', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', fontSize: 13, color: '#111', fontFamily: 'inherit' }}>
                👥 Manage members
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {user?.user_metadata?.name || user?.email}
            </p>
            <span style={{ ...rc, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, flexShrink: 0, marginLeft: 6 }}>{ROLE_LABELS[myRole]}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/dashboard/settings" style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none' }}>Settings</Link>
            <span style={{ color: '#e5e7eb' }}>·</span>
            <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af', padding: 0 }}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
    </>
  )
}

const sidebarStyle: React.CSSProperties = {
  width: 224, flexShrink: 0, background: '#f9fafb',
  borderRight: '1px solid #e5e7eb', display: 'flex',
  flexDirection: 'column', height: '100vh',
}
const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 16, color: '#9ca3af', padding: '2px 4px', lineHeight: 1,
}
