'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function WorkspaceSetup({ userId, userEmail }: { userId: string; userEmail: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    if (!name.trim()) { setError('Workspace name is required.'); return }
    setLoading(true)
    const sb = createClient()
    const { data: ws, error: e } = await sb.from('workspaces')
      .insert({ name: name.trim(), owner_id: userId })
      .select().single()
    if (e || !ws) { setError(e?.message || 'Failed to create workspace'); setLoading(false); return }
    await sb.from('workspace_members').insert({
      workspace_id: ws.id, user_id: userId,
      role: 'admin', invited_email: userEmail,
      is_invited: false, status: 'active'
    })
    // Hard redirect forces full reload so layout picks up new workspace
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '40px 36px', width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#111"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".5"/>
            </svg>
            <span style={{ fontWeight: 600, fontSize: 16 }}>TestFlow</span>
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>Create your workspace</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>A workspace holds your projects and team members.</p>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 5 }}>Workspace name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme QA Team"
            onKeyDown={e => e.key === 'Enter' && create()}
            autoFocus
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none' }} />
        </div>

        <button onClick={create} disabled={loading}
          style={{ width: '100%', background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Creating…' : 'Create workspace'}
        </button>

        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 14 }}>
          You'll be the Admin of this workspace.
        </p>
      </div>
    </div>
  )
}
