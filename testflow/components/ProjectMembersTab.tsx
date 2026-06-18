'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface ProjectMembersTabProps {
  projectId: string
  workspaceId: string
  myRole: string
  isAdmin: boolean
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  editor: { bg: '#dcfce7', color: '#15803d' },
  tester: { bg: '#dbeafe', color: '#1e40af' },
  viewer: { bg: '#f3f4f6', color: '#374151' },
}

export default function ProjectMembersTab({ projectId, workspaceId, myRole, isAdmin }: ProjectMembersTabProps) {
  const [members, setMembers] = useState<any[]>([])
  const [wsMembers, setWsMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'editor' | 'tester' | 'viewer'>('viewer')
  const [adding, setAdding] = useState(false)
  const sb = createClient()

  useEffect(() => { load() }, [projectId])

  const load = async () => {
    const [{ data: pm }, { data: wm }] = await Promise.all([
      sb.from('project_members').select('*').eq('project_id', projectId),
      sb.from('workspace_members').select('user_id, invited_email, display_name, role').eq('workspace_id', workspaceId),
    ])
    // Enrich project members with workspace member info
    const enriched = (pm || []).map((m: any) => ({
      ...m,
      workspace_members: (wm || []).find((w: any) => w.user_id === m.user_id) || {}
    }))
    setMembers(enriched)
    setWsMembers(wm || [])
    setLoading(false)
  }

  // Workspace members not yet added to project
  const availableToAdd = wsMembers.filter(wm =>
    !members.some(pm => pm.user_id === wm.user_id) && wm.role !== 'admin'
  )

  const addMember = async () => {
    if (!selectedUserId) return
    setAdding(true)
    const { data: { session } } = await sb.auth.getSession()
    const res = await fetch('/api/project-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ project_id: projectId, user_id: selectedUserId, role: selectedRole, invited_by: session?.user.id }),
    })
    if (res.ok) {
      setShowAddModal(false)
      setSelectedUserId('')
      setSelectedRole('viewer')
      await load()
    } else {
      const err = await res.json()
      alert('Error: ' + err.error)
    }
    setAdding(false)
  }

  const updateRole = async (memberId: string, role: string) => {
    const { data: { session } } = await sb.auth.getSession()
    await fetch('/api/project-members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id: memberId, role, project_id: projectId }),
    })
    setMembers(p => p.map(m => m.id === memberId ? { ...m, role } : m))
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member from the project?')) return
    const { data: { session } } = await sb.auth.getSession()
    await fetch('/api/project-members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id: memberId, project_id: projectId }),
    })
    setMembers(p => p.filter(m => m.id !== memberId))
  }

  if (loading) return <div style={{ padding: 32, color: '#9ca3af', fontSize: 13 }}>Loading members…</div>

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Project Members</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Control who can access this project and their role.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAddModal(true)}
            style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + Add member
          </button>
        )}
      </div>

      {/* Members list */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px', gap: 8, padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {['Member', 'Workspace Role', 'Project Role', ''].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {/* Admin row (always shown) */}
        {wsMembers.filter(wm => wm.role === 'admin').map(admin => (
          <div key={admin.user_id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                {(admin.display_name || admin.invited_email || 'A')[0].toUpperCase()}
              </div>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 500 }}>{admin.display_name || admin.invited_email?.split('@')[0]}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{admin.invited_email}</p>
              </div>
            </div>
            <span style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>admin</span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>Full access</span>
            <span />
          </div>
        ))}

        {/* Project members */}
        {members.map(member => {
          const rc = ROLE_COLORS[member.role] || ROLE_COLORS.viewer
          const wsMember = wsMembers.find(wm => wm.user_id === member.user_id)
          const wsRc = ROLE_COLORS[wsMember?.role || 'viewer'] || ROLE_COLORS.viewer
          return (
            <div key={member.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                  {(member.workspace_members?.display_name || member.workspace_members?.invited_email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 500 }}>
                    {member.workspace_members?.display_name || member.workspace_members?.invited_email?.split('@')[0]}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{member.workspace_members?.invited_email}</p>
                </div>
              </div>
              <span style={{ fontSize: 11, background: wsRc.bg, color: wsRc.color, padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                {wsMember?.role || '—'}
              </span>
              {isAdmin ? (
                <select value={member.role} onChange={e => updateRole(member.id, e.target.value)}
                  style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 6px', background: rc.bg, color: rc.color, cursor: 'pointer', outline: 'none', fontWeight: 600 }}>
                  <option value="editor">editor</option>
                  <option value="tester">tester</option>
                  <option value="viewer">viewer</option>
                </select>
              ) : (
                <span style={{ fontSize: 11, background: rc.bg, color: rc.color, padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>{member.role}</span>
              )}
              {isAdmin && (
                <button onClick={() => removeMember(member.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, padding: 0 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#d1d5db'}>
                  ✕
                </button>
              )}
            </div>
          )
        })}

        {members.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No members added yet. {isAdmin ? 'Click "+ Add member" to get started.' : 'Contact your admin to be added.'}
          </div>
        )}
      </div>

      {/* Add member modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Add member to project</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>Member</label>
              <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }}>
                <option value="">Select a workspace member…</option>
                {availableToAdd.map(wm => (
                  <option key={wm.user_id} value={wm.user_id}>
                    {wm.display_name || wm.invited_email?.split('@')[0]} ({wm.invited_email})
                  </option>
                ))}
              </select>
              {availableToAdd.length === 0 && (
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>All workspace members are already added to this project.</p>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>Project Role</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['editor', 'tester', 'viewer'] as const).map(role => {
                  const rc = ROLE_COLORS[role]
                  return (
                    <button key={role} onClick={() => setSelectedRole(role)}
                      style={{ flex: 1, padding: '8px 0', fontSize: 12, cursor: 'pointer', borderRadius: 7, border: `1px solid ${selectedRole === role ? rc.color : '#e5e7eb'}`, background: selectedRole === role ? rc.bg : '#fff', color: selectedRole === role ? rc.color : '#374151', fontWeight: selectedRole === role ? 600 : 400 }}>
                      {role}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                {selectedRole === 'editor' ? 'Can create and edit test cases, runs, bugs, and docs.' :
                 selectedRole === 'tester' ? 'Can execute test runs and report bugs.' :
                 'Can view everything but cannot make changes.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addMember} disabled={!selectedUserId || adding}
                style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: selectedUserId ? 'pointer' : 'not-allowed', opacity: selectedUserId ? 1 : 0.5 }}>
                {adding ? 'Adding…' : 'Add to project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
