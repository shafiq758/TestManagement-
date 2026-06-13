'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verifySent, setVerifySent] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<'weak'|'fair'|'strong'|''>('')

  const checkStrength = (p: string) => {
    if (!p) { setPasswordStrength(''); return }
    const hasUpper = /[A-Z]/.test(p)
    const hasLower = /[a-z]/.test(p)
    const hasNumber = /[0-9]/.test(p)
    const hasSpecial = /[^A-Za-z0-9]/.test(p)
    const score = [hasUpper, hasLower, hasNumber, hasSpecial, p.length >= 8].filter(Boolean).length
    setPasswordStrength(score <= 2 ? 'weak' : score <= 3 ? 'fair' : 'strong')
  }

  const validatePassword = (p: string): string => {
    if (p.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(p)) return 'Password must contain at least one uppercase letter.'
    if (!/[a-z]/.test(p)) return 'Password must contain at least one lowercase letter.'
    if (!/[0-9]/.test(p)) return 'Password must contain at least one number.'
    return ''
  }

  const handle = async () => {
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    if (mode === 'signup' && !name) { setError('Name is required.'); return }
    if (mode === 'signup') {
      const pwError = validatePassword(password)
      if (pwError) { setError(pwError); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    }
    setLoading(true)
    const sb = createClient()

    if (mode === 'signup') {
      const { data, error: e } = await sb.auth.signUp({
        email, password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/verify`,
        }
      })
      if (e) { setError(e.message); setLoading(false); return }
      // If email confirmation is required
      if (data.user && !data.session) {
        setVerifySent(true)
        setLoading(false)
        return
      }
      router.replace('/dashboard')
    } else {
      const { data, error: e } = await sb.auth.signInWithPassword({ email, password })
      if (e) { setError(e.message); setLoading(false); return }
      // Redirect super admin
      if (data.user?.email === 'muhamad.shafiqurrehman@gmail.com') {
        router.replace('/superadmin'); return
      }
      // Check if email is confirmed
      if (data.user && !data.user.email_confirmed_at) {
        setError('Please verify your email before signing in. Check your inbox.')
        await sb.auth.signOut()
        setLoading(false)
        return
      }
      router.replace('/dashboard')
    }
  }

  const resendVerification = async () => {
    const sb = createClient()
    await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/auth/verify` } })
    setError('')
    setVerifySent(true)
  }

  if (verifySent) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>Check your email</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
              We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>
              Didn't receive it?{' '}
              <button onClick={resendVerification} style={s.link}>Resend email</button>
            </p>
            <button onClick={() => { setVerifySent(false); setMode('login') }} style={s.link}>
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.logo}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#111"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".5"/>
            </svg>
            <span style={s.logoText}>TestFlow</span>
          </div>
          <p style={s.sub}>{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</p>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {mode === 'signup' && (
          <Field label="Name">
            <Input value={name} onChange={setName} placeholder="Your name" />
          </Field>
        )}
        <Field label="Email">
          <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
        </Field>
        <Field label="Password">
          <Input value={password} onChange={(v: string) => { setPassword(v); if (mode === 'signup') checkStrength(v) }}
            placeholder="Min. 8 characters" type="password"
            onKeyDown={(e: any) => e.key === 'Enter' && handle()} />
          {mode === 'signup' && passwordStrength && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {(['weak','fair','strong'] as const).map((level, i) => (
                  <div key={level} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: passwordStrength === 'weak' && i === 0 ? '#ef4444'
                      : passwordStrength === 'fair' && i <= 1 ? '#f59e0b'
                      : passwordStrength === 'strong' && i <= 2 ? '#16a34a'
                      : '#e5e7eb'
                  }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 11, color: passwordStrength === 'weak' ? '#ef4444' : passwordStrength === 'fair' ? '#d97706' : '#16a34a' }}>
                {passwordStrength === 'weak' ? 'Weak — add uppercase, numbers, symbols'
                  : passwordStrength === 'fair' ? 'Fair — getting stronger'
                  : 'Strong password ✓'}
              </p>
            </div>
          )}
        </Field>
        {mode === 'signup' && (
          <Field label="Confirm password">
            <Input value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" type="password"
              onKeyDown={(e: any) => e.key === 'Enter' && handle()} />
          </Field>
        )}

        <button style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} onClick={handle} disabled={loading}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <p style={s.toggle}>
          {mode === 'login' ? 'No account? ' : 'Already have one? '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setConfirmPassword(''); setPasswordStrength('') }} style={s.link}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', onKeyDown }: any) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      type={type} onKeyDown={onKeyDown}
      style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', background: '#fff' }} />
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 16 },
  card: { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '36px 32px', width: '100%', maxWidth: 380 },
  header: { marginBottom: 24 },
  logo: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  logoText: { fontWeight: 600, fontSize: 16 },
  sub: { fontSize: 13, color: '#6b7280', margin: 0 },
  error: { background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 14 },
  btn: { width: '100%', background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4 },
  toggle: { fontSize: 13, textAlign: 'center', marginTop: 14, color: '#6b7280' },
  link: { background: 'none', border: 'none', cursor: 'pointer', color: '#111', fontWeight: 500, fontSize: 13, padding: 0, textDecoration: 'underline' },
}
