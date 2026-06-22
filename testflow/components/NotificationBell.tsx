'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const sb = createClient()

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!userId) return
    load()

    // Poll every 30 seconds for new notifications
    const interval = setInterval(load, 30000)

    // Real-time subscription
    const channel = sb.channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications(p => [payload.new, ...p])
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      sb.removeChannel(channel)
    }
  }, [userId])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const load = async () => {
    const { data } = await sb.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  const markRead = async (id: string) => {
    await sb.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    setLoading(true)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, userId }),
    })
    setNotifications(p => p.map(n => ({ ...n, read: true })))
    setLoading(false)
  }

  const handleClick = async (n: any) => {
    await markRead(n.id)
    setShowDropdown(false)
    if (n.link) router.push(n.link)
  }

  const typeIcon: Record<string, string> = {
    mention: '💬',
    comment: '📝',
    reply: '↩',
    bug_assigned: '🐛',
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button onClick={() => setShowDropdown(p => !p)}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f3f4f6'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
        <span style={{ fontSize: 18 }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#dc2626', color: '#fff',
            fontSize: 9, fontWeight: 700,
            minWidth: 16, height: 16, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'fixed',
          bottom: 60,
          left: 16,
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          width: 340, maxHeight: 480, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              Notifications {unreadCount > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, marginLeft: 6 }}>{unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={loading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#2563eb', fontFamily: 'inherit' }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>🔔</p>
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No notifications yet</p>
              </div>
            )}
            {notifications.map(n => (
              <div key={n.id} onClick={() => handleClick(n)}
                style={{
                  display: 'flex', gap: 10, padding: '12px 16px', cursor: n.link ? 'pointer' : 'default',
                  background: n.read ? '#fff' : '#f0f9ff',
                  borderBottom: '1px solid #f9fafb',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (n.link) (e.currentTarget as HTMLElement).style.background = n.read ? '#f9fafb' : '#e0f2fe' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.read ? '#fff' : '#f0f9ff'}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: n.read ? '#f3f4f6' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {typeIcon[n.type] || '🔔'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: n.read ? 400 : 600, color: '#111' }}>{n.title}</p>
                  {n.body && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
