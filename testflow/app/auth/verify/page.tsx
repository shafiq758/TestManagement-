'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function VerifyPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const sb = createClient()
    // Supabase handles the token exchange automatically via the URL hash
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('success')
        setMessage('Email verified! Redirecting…')
        setTimeout(() => router.replace('/dashboard'), 2000)
      } else if (event === 'USER_UPDATED' && session) {
        setStatus('success')
        setMessage('Email verified! Redirecting…')
        setTimeout(() => router.replace('/dashboard'), 2000)
      }
    })

    // Also check current session in case already verified
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email_confirmed_at) {
        setStatus('success')
        setMessage('Email verified! Redirecting…')
        setTimeout(() => router.replace('/dashboard'), 2000)
      } else if (status === 'loading') {
        // Give it a moment for the hash to be processed
        setTimeout(() => {
          if (status === 'loading') {
            setStatus('error')
            setMessage('Verification link may have expired. Please try signing up again.')
          }
        }, 3000)
      }
    })
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '40px 32px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          {status === 'loading' ? '⏳' : status === 'success' ? '✅' : '❌'}
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>
          {status === 'loading' ? 'Verifying your email…' : status === 'success' ? 'Email verified!' : 'Verification failed'}
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
          {status === 'loading' ? 'Please wait a moment.' : message}
        </p>
        {status === 'error' && (
          <button onClick={() => router.replace('/auth')}
            style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer' }}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
