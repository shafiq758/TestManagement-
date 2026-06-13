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
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [verifying, setVerifying] = useState(false)
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
        options: { data: { name } }
      })
      if (e) { setError(e.message); setLoading(false); return }
      // Send OTP for email verification
      await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
      setVerifySent(true)
      setLoading(false)
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
    await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setError('')
    setOtp(['', '', '', '', '', ''])
  }

  const verifyOtp = async () => {
    const code = otp.join('')
    if (code.length !== 6) { setError('Please enter the full 6-digit code.'); return }
    setVerifying(true)
    const sb = createClient()
    const { error: e } = await sb.auth.verifyOtp({ email, token: code, type: 'email' })
    if (e) { setError('Invalid or expired code. Please try again.'); setVerifying(false); return }
    router.replace('/dashboard')
  }

  const handleOtpInput = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    // Auto-focus next input
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`)
      next?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`)
      prev?.focus()
    }
  }

  if (verifySent) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#111"/>
                <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
                <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
                <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".5"/>
              </svg>
              <span style={{ fontWeight: 600, fontSize: 16 }}>TestFlow</span>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600 }}>Enter verification code</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
              We sent a 6-digit code to <strong>{email}</strong>
            </p>

            {error && <div style={s.error}>{error}</div>}

            {/* OTP boxes */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                  style={{
                    width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 600,
                    border: `2px solid ${digit ? '#111' : '#e5e7eb'}`,
                    borderRadius: 8, outline: 'none', background: '#fff',
                    color: '#111', transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>

            <button onClick={verifyOtp} disabled={verifying || otp.join('').length !== 6}
              style={{ ...s.btn, opacity: (verifying || otp.join('').length !== 6) ? 0.5 : 1, marginBottom: 14 }}>
              {verifying ? 'Verifying…' : 'Verify email'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <button onClick={resendVerification} style={s.link}>Resend code</button>
              <button onClick={() => { setVerifySent(false); setMode('login'); setOtp(['','','','','','']) }} style={{ ...s.link, color: '#9ca3af' }}>
                Back to sign in
              </button>
            </div>
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
