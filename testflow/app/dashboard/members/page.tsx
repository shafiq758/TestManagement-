'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import MembersPage from '@/components/MembersPage'
import type { WorkspaceRole } from '@/types'

export default function Members() {
  const router = useRouter()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/auth'); return }
      const u = data.session.user
      setUserId(u.id)
      const { data: m } = await sb.from('workspace_members')
        .select('workspace_id, role').eq('user_id', u.id).eq('status', 'active').single()
      if (m) { setWorkspaceId(m.workspace_id); setMyRole(m.role) }
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}><p style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</p></div>
  if (!workspaceId || !userId) return null

  return <MembersPage workspaceId={workspaceId} currentRole={myRole} currentUserId={userId} />
}
