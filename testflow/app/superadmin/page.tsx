'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const SUPER_ADMIN_EMAIL = 'muhamad.shafiqurrehman@gmail.com'

interface WorkspaceRow {
  id: string
  name: string
  owner_id: string
  created_at: string
  member_count?: number
  owner_email?: string
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [unlockRequests, setUnlockRequests] = useState<any[]>([])
  const [blockedUsers, setBlockedUsers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'workspaces' | 'blocked'>('workspaces')
  const sb = createClient()

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/auth'); return }
      if (data.session.user.email !== SUPER_ADMIN_EMAIL) {
        router.replace('/dashboard'); return
      }
      await fetchWorkspaces()
      setLoading(false)
    })
  }, [])

  const fetchWorkspaces = async () => {
    const { data: ws } = await sb.from('workspaces').select('*').order('created_at')
    if (!ws) return

    // Get member counts and owner emails
    const enriched = await Promise.all(ws.map(async (w) => {
      const { count } = await sb.from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', w.id).eq('status', 'active')

      const { data: owner } = await sb.from('workspace_members')
        .select('invited_email').eq('workspace_id', w.id)
        .eq('is_invited', false).eq('status', 'active').single()

      return { ...w, member_count: count || 0, owner_email: owner?.invited_email || '—' }
    }))
    setWorkspaces(enriched)
    // Fetch unlock requests
    const { data: requests } = await sb.from('unlock_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setUnlockRequests(requests || [])
    // Fetch blocked users
    const { data: blocked } = await sb.from('otp_attempts').select('*').eq('blocked', true).order('blocked_at', { ascending: false })
    setBlockedUsers(blocked || [])
  }

  const unlockUser = async (email: string) => {
    await sb.from('otp_attempts').update({ blocked: false, attempts: 0, blocked_at: null }).eq('email', email)
    await sb.from('unlock_requests').update({ status: 'resolved' }).eq('email', email)
    fetchWorkspaces()
  }

  const deleteWorkspace = async (ws: WorkspaceRow) => {
    if (!confirm(`Delete workspace "${ws.name}"? This will permanently delete all projects, test cases, and runs inside it. This cannot be undone.`)) return
    setDeleting(ws.id)
    const { error: e } = await sb.from('workspaces').delete().eq('id', ws.id)
    if (e) { setError(e.message); setDeleting(null); return }
    setWorkspaces(p => p.filter(w => w.id !== ws.id))
    setDeleting(null)
  }

  const logout = async () => {
    await sb.auth.signOut()
    router.replace('/auth')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Top bar */}
      <div style={{ background: '#111', color: '#fff', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#fff"/>
            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#fff" opacity=".4"/>
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#fff" opacity=".4"/>
            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#fff" opacity=".6"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: 15 }}>TestFlow</span>
          <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.05em' }}>SUPER ADMIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{SUPER_ADMIN_EMAIL}</span>
          <button onClick={logout} style={{ background: 'none', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', fontSize: 12, padding: '5px 12px', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600 }}>Workspace Management</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            View and delete workspaces. You cannot alter roles inside workspaces.
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{error}</div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total workspaces', value: workspaces.length },
            { label: 'Total members', value: workspaces.reduce((n, w) => n + (w.member_count || 0), 0) },
            { label: 'Active workspaces', value: workspaces.length },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
          {(['workspaces', 'blocked'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: activeTab === t ? 600 : 400,
              color: activeTab === t ? '#111' : '#6b7280',
              padding: '8px 16px', borderBottom: activeTab === t ? '2px solid #111' : '2px solid transparent',
              marginBottom: -1, textTransform: 'capitalize',
            }}>
              {t === 'workspaces' ? 'Workspaces' : `Blocked Users ${blockedUsers.length > 0 ? `(${blockedUsers.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Unlock requests banner */}
        {unlockRequests.length > 0 && (
          <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#92400e' }}>⚠️ {unlockRequests.length} pending unlock request{unlockRequests.length !== 1 ? 's' : ''}</span>
            <button onClick={() => setActiveTab('blocked')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#92400e', fontWeight: 600, textDecoration: 'underline', fontFamily: 'inherit' }}>View</button>
          </div>
        )}

        {/* Blocked users tab */}
        {activeTab === 'blocked' && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Blocked users</span>
            </div>
            {blockedUsers.length === 0 && <p style={{ padding: '20px 18px', fontSize: 13, color: '#9ca3af', margin: 0 }}>No blocked users.</p>}
            {blockedUsers.map((u, i) => {
              const req = unlockRequests.find(r => r.email === u.email)
              return (
                <div key={u.id} style={{ padding: '14px 18px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 3px', fontWeight: 500, fontSize: 14 }}>{u.email}</p>
                    <p style={{ margin: '0 0 3px', fontSize: 12, color: '#9ca3af' }}>Blocked at {new Date(u.blocked_at).toLocaleString()} · {u.attempts} failed attempts</p>
                    {req && (
                      <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginTop: 6 }}>
                        <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 500, color: '#92400e' }}>Unlock request:</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>{req.message}</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => unlockUser(u.email)}
                    style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
                    Unlock
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Workspaces table */}
        {activeTab === 'workspaces' && <>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'grid', gridTemplateColumns: '2fr 2fr 80px 100px', gap: 12 }}>
            {['Workspace', 'Owner', 'Members', ''].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {workspaces.length === 0 && (
            <p style={{ padding: '24px 18px', fontSize: 13, color: '#9ca3af', margin: 0 }}>No workspaces yet.</p>
          )}

          {workspaces.map((ws, i) => (
            <div key={ws.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 80px 100px', gap: 12,
              padding: '14px 18px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
              alignItems: 'center',
            }}>
              <div>
                <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 14 }}>{ws.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{ws.id.slice(0, 8)}…</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{ws.owner_email}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{new Date(ws.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{ws.member_count}</span>
              </div>
              <div>
                <button
                  onClick={() => deleteWorkspace(ws)}
                  disabled={deleting === ws.id}
                  style={{
                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                    borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500,
                    cursor: deleting === ws.id ? 'not-allowed' : 'pointer',
                    opacity: deleting === ws.id ? 0.5 : 1,
                  }}>
                  {deleting === ws.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>
            ⚠️ Deleting a workspace permanently removes all projects, sections, test cases, test runs, and members inside it. This action cannot be undone.
          </p>
        </div>
        </>}
      </div>
    </div>
  )
}
