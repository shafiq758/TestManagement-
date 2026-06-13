'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const SUPER_ADMIN_EMAIL = 'muhamad.shafiqurrehman@gmail.com'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/auth'); return }
      if (data.session.user.email === SUPER_ADMIN_EMAIL) {
        router.replace('/superadmin')
      } else {
        router.replace('/dashboard')
      }
    })
  }, [router])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#999', fontSize: 14 }}>Loading…</p>
    </div>
  )
}
