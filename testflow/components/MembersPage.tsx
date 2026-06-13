'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { ROLE_LABELS, ROLE_COLORS, ROLE_DESCRIPTIONS, INVITABLE_ROLES, CHANGEABLE_ROLES_FOR_INVITED, canManageMembers } from '@/lib/roles'
import type { WorkspaceMember, WorkspaceRole } from '@/types'

export default function MembersPage({ workspaceId, currentRole, currentUserId, isSuperAdmin }: {
  workspaceId: string
  currentRole: WorkspaceRole
  currentUserId: string
  isSuperAdmin?: boolean
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor')
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const sb = createClient()
  const isAdmin = canManageMembers(currentRole)

  useEffect(() => { fetchMembers() }, [])

  const fetchMembers = async () => {
    setLoading(true)
    const { data } = await sb.from('workspace_members')
      .select('*').eq('workspace_id', workspaceId).order('created_at')
    setMembers(data || [])
    setLoading(false)
  }

  const invite = async () => {
    setError(''); setSuccess('')
    if (!inviteEmail.trim()) { setError('Email is required.'); return }
    if (!/\S+@\S+\.\S+/.test(inviteEmail)) { setError('Enter a valid email.'); return }

    // Block inviting admin or super_admin roles
    if (!INVITABLE_ROLES.includes(inviteRole)) {
      setError('Invited members can only be Editor, Tester, or Viewer.')
      return
    }

    setInviting(true)

    // Check: email already in this workspace
    const existing = members.find(m => m.invited_email.toLowerCase() === inviteEmail.trim().toLowerCase())
    if (existing) {
      setError('This email already has a role in this workspace.')
      setInviting(false); return
    }

    const { error: e } = await sb.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: null,
      role: inviteRole,
      invited_email: inviteEmail.trim().toLowerCase(),
      is_invited: true,
      status: 'pending',
    })

    if (e) { setError(e.message); setInviting(false); return }
    setSuccess(`Invite sent to ${inviteEmail.trim()}. They'll get access when they sign up.`)
    setInviteEmail('')
    setInviting(false)
    fetchMembers()
  }

  const updateRole = async (member: WorkspaceMember, newRole: WorkspaceRole) => {
    // Cannot promote invited members to admin
    if (member.is_invited && newRole === 'admin') {
      setError('Invited members cannot be promoted to Admin.')
      return
    }
    // Super admin cannot change internal roles
    if (isSuperAdmin && !isAdmin) {
      setError('Super admin cannot alter workspace roles.')
      return
    }
    await sb.from('workspace_members').update({ role: newRole }).eq('id', member.id)
    fetchMembers()
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member from the workspace?')) return
    await sb.from('workspace_members').delete().eq('id', memberId)
    fetchMembers()
  }

  return (
    <div style={{ flex: 1, background: '#fff', overflowY: 'auto' }}>
      <div style={{ padding: '20px 28px 0', borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Members</h1>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b7280' }}>
          Manage who has access to this workspace and their roles.
        </p>
      </div>

      <div style={{ padding: '0 28px', maxWidth: 700 }}>

        {/* Invite section — only workspace admin, not super admin acting outside their workspace */}
        {isAdmin && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>Invite a team member</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280' }}>
              Invited members can only be assigned Editor, Tester, or Viewer roles.
            </p>

            {error && <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ background: '#f0fdf4', color: '#15803d', fontSize: 13, padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{success}</div>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                onKeyDown={e => e.key === 'Enter' && invite()}
                style={{ flex: 1, minWidth: 200, border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none' }} />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}>
                {INVITABLE_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <button onClick={invite} disabled={inviting}
                style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.6 : 1 }}>
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
              {INVITABLE_ROLES.map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ background: ROLE_COLORS[r].bg, color: ROLE_COLORS[r].text, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap', marginTop: 1 }}>{ROLE_LABELS[r]}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{ROLE_DESCRIPTIONS[r]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members list */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
          </div>

          {loading && <p style={{ padding: '16px', fontSize: 13, color: '#9ca3af' }}>Loading…</p>}

          {members.map((m, i) => {
            const rc = ROLE_COLORS[m.role]
            const isMe = m.user_id === currentUserId
            const isWorkspaceOwner = !m.is_invited  // self-registered = workspace owner/admin
            // Admin can change role of invited members only (not other admins who self-registered)
            const canChangeRole = isAdmin && !isMe && m.is_invited
            const availableRoles = CHANGEABLE_ROLES_FOR_INVITED

            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isWorkspaceOwner ? '#111' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: isWorkspaceOwner ? '#fff' : '#374151', flexShrink: 0 }}>
                  {(m.invited_email || '?')[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.invited_email}</span>
                    {isMe && <span style={{ fontSize: 11, color: '#9ca3af' }}>(you)</span>}
                    {m.status === 'pending' && <span style={{ fontSize: 11, background: '#fef9c3', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>Pending</span>}
                    {m.is_invited && m.status === 'active' && <span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '1px 6px', borderRadius: 4 }}>Invited</span>}
                  </div>
                </div>

                {/* Role — dropdown only for invited members, badge for admins */}
                {canChangeRole ? (
                  <select value={m.role} onChange={e => updateRole(m, e.target.value as WorkspaceRole)}
                    style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer' }}>
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ background: rc.bg, color: rc.text, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, flexShrink: 0 }}>
                    {ROLE_LABELS[m.role]}
                  </span>
                )}

                {/* Remove — admin can remove invited members only */}
                {isAdmin && !isMe && m.is_invited && (
                  <button onClick={() => removeMember(m.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#d1d5db', padding: '2px 4px' }}
                    title="Remove member">✕</button>
                )}
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
          Workspace admins are users who registered directly — they cannot be demoted via invite system.
        </p>
      </div>
    </div>
  )
}
