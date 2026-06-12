'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Project } from '@/types'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const activeId = params?.projectId as string | undefined
  const [projects, setProjects] = useState<Project[]>([])
  const [user, setUser] = useState<any>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/auth'); return }
      setUser(data.session.user)
      fetchProjects(sb, data.session.user.id)
    })
  }, [])

  const fetchProjects = async (sb: any, uid: string) => {
    const { data } = await sb.from('projects').select('*').eq('user_id', uid).order('created_at')
    setProjects(data || [])
  }

  const createProject = async () => {
    if (!newName.trim() || !user) return
    const sb = createClient()
    const { data } = await sb.from('projects').insert({ name: newName.trim(), user_id: user.id }).select().single()
    if (data) {
      setProjects(p => [...p, data])
      setNewName(''); setCreating(false)
      router.push(`/dashboard/${data.id}`)
    }
  }

  const logout = async () => {
    await createClient().auth.signOut()
    router.replace('/auth')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#111"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".5"/>
            </svg>
            <span style={{ fontWeight: 600, fontSize: 15 }}>TestFlow</span>
          </div>
        </div>

        <div style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projects</span>
            <button onClick={() => setCreating(true)} style={iconBtn} title="New project">+</button>
          </div>

          {projects.map(p => (
            <Link key={p.id} href={`/dashboard/${p.id}`} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 8, textDecoration: 'none',
              background: activeId === p.id ? '#fff' : 'transparent',
              border: activeId === p.id ? '1px solid #e5e7eb' : '1px solid transparent',
              color: '#111', fontSize: 13, marginBottom: 2,
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4a1 1 0 011-1h3l1.5 2H13a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" fill="#9ca3af"/>
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </Link>
          ))}

          {creating && (
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
            <p style={{ fontSize: 12, color: '#9ca3af', padding: '4px 10px' }}>No projects yet</p>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
            {user?.user_metadata?.name || user?.email}
          </p>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ca3af', padding: 0 }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
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
