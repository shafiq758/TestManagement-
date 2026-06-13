'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Mode = 'login' | 'signup' | 'forgot' | 'verify_signup' | 'verify_reset' | 'new_password'

const SUPER_ADMIN_EMAIL = 'muhamad.shafiqurrehman@gmail.com'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'strong' | ''>('')

  const sb = createClient()

  const checkStrength = (p: string) => {
    if (!p) { setPasswordStrength(''); return }
    const checks = [/[A-Z]/.test(p), /[a-z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p), p.length >= 8]
    const score = checks.filter(Boolean).length
    setPasswordStrength(score <= 2 ? 'weak' : score <= 3 ? 'fair' : 'strong')
  }

  const validatePassword = (p: string) => {
    if (p.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(p)) return 'Must contain at least one uppercase letter.'
    if (!/[a-z]/.test(p)) return 'Must contain at least one lowercase letter.'
    if (!/[0-9]/.test(p)) return 'Must contain at least one number.'
    return ''
  }

  const resetOtp = () => setOtp(['', '', '', '', '', ''])

  const handleOtpInput = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  // ── SIGNUP ──────────────────────────────────────────────────
  const handleSignup = async () => {
    setError('')
    if (!name.trim()) { setError('Name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    const pwErr = validatePassword(password)
    if (pwErr) { setError(pwErr); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)

    // Sign up — Supabase creates unconfirmed user
    const { data, error: e } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name: name.trim() } }
    })
    if (e) { setError(e.message); setLoading(false); return }

    // Send OTP via signInWithOtp (uses email template with {{ .Token }})
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false }
    })

    setLoading(false)
    resetOtp()
    setMode('verify_signup')
  }

  // ── VERIFY SIGNUP OTP ────────────────────────────────────────
  const handleVerifySignup = async () => {
    setError('')
    const code = otp.join('')
    if (code.length !== 6) { setError('Please enter the full 6-digit code.'); return }
    setLoading(true)

    const { error: e } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email'
    })

    if (e) {
      // OTP expired — delete the unconfirmed user so they must re-register
      await sb.auth.admin?.deleteUser // not available client-side, handled by expiry
      setError('Code is invalid or has expired (30 min limit). Please sign up again.')
      setLoading(false)
      // Clear their partial signup
      await sb.auth.signOut()
      return
    }

    router.replace('/dashboard')
  }

  const resendSignupOtp = async () => {
    setError(''); setInfo('')
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false }
    })
    setInfo('A new code has been sent to your email.')
    resetOtp()
  }

  // ── LOGIN ────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    setLoading(true)

    const { data, error: e } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (e) { setError('Invalid email or password.'); setLoading(false); return }

    if (data.user?.email === SUPER_ADMIN_EMAIL) { router.replace('/superadmin'); return }

    if (!data.user?.email_confirmed_at) {
      setError('Please verify your email first. Check your inbox for the code.')
      await sb.auth.signOut()
      setLoading(false)
      return
    }

    router.replace('/dashboard')
  }

  // ── FORGOT PASSWORD ──────────────────────────────────────────
  const handleForgot = async () => {
    setError(''); setInfo('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true)

    // Always show same message regardless of whether email exists
    // Silently send OTP only if user exists
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false }
    })

    setLoading(false)
    setInfo('If this email is registered, you will receive a 6-digit reset code. Please check your inbox.')
    resetOtp()
    setMode('verify_reset')
  }

  // ── VERIFY RESET OTP ─────────────────────────────────────────
  const handleVerifyReset = async () => {
    setError('')
    const code = otp.join('')
    if (code.length !== 6) { setError('Please enter the full 6-digit code.'); return }
    setLoading(true)

    const { error: e } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email'
    })

    if (e) {
      setError('Code is invalid or has expired (30 min limit). Please request a new one.')
      setLoading(false)
      return
    }

    setLoading(false)
    setMode('new_password')
  }

  const resendResetOtp = async () => {
    setError(''); setInfo('')
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false }
    })
    setInfo('A new code has been sent.')
    resetOtp()
  }

  // ── SET NEW PASSWORD ─────────────────────────────────────────
  const handleNewPassword = async () => {
    setError('')
    const pwErr = validatePassword(newPassword)
    if (pwErr) { setError(pwErr); return }
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return }
    setLoading(true)

    const { error: e } = await sb.auth.updateUser({ password: newPassword })
    if (e) { setError(e.message); setLoading(false); return }

    await sb.auth.signOut()
    setLoading(false)
    setMode('login')
    setPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setInfo('Password updated successfully. Please sign in.')
  }

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#111"/>
            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".5"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: 16 }}>TestFlow</span>
        </div>

        {error && <div style={s.error}>{error}</div>}
        {info && <div style={s.info}>{info}</div>}

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <>
            <h2 style={s.title}>Sign in</h2>
            <Field label="Email"><Inp value={email} onChange={setEmail} placeholder="you@example.com" type="email" /></Field>
            <Field label="Password"><Inp value={password} onChange={setPassword} placeholder="Your password" type="password" onKeyDown={(e: any) => e.key === 'Enter' && handleLogin()} /></Field>
            <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 14 }}>
              <button onClick={() => { setMode('forgot'); setError(''); setInfo('') }} style={s.link}>Forgot password?</button>
            </div>
            <Btn label={loading ? 'Signing in…' : 'Sign in'} onClick={handleLogin} disabled={loading} />
            <p style={s.toggle}>No account? <button onClick={() => { setMode('signup'); setError(''); setInfo('') }} style={s.link}>Sign up</button></p>
          </>
        )}

        {/* ── SIGNUP ── */}
        {mode === 'signup' && (
          <>
            <h2 style={s.title}>Create account</h2>
            <Field label="Name"><Inp value={name} onChange={setName} placeholder="Your full name" autoFocus /></Field>
            <Field label="Email"><Inp value={email} onChange={setEmail} placeholder="you@example.com" type="email" /></Field>
            <Field label="Password">
              <Inp value={password} onChange={(v: string) => { setPassword(v); checkStrength(v) }} placeholder="Min. 8 characters" type="password" />
              {passwordStrength && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {(['weak', 'fair', 'strong'] as const).map((level, i) => (
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
            <Field label="Confirm password"><Inp value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" type="password" onKeyDown={(e: any) => e.key === 'Enter' && handleSignup()} /></Field>
            <Btn label={loading ? 'Creating account…' : 'Create account'} onClick={handleSignup} disabled={loading} />
            <p style={s.toggle}>Already have one? <button onClick={() => { setMode('login'); setError(''); setInfo('') }} style={s.link}>Sign in</button></p>
          </>
        )}

        {/* ── VERIFY SIGNUP OTP ── */}
        {mode === 'verify_signup' && (
          <>
            <h2 style={s.title}>Verify your email</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 6px' }}>We sent a 6-digit code to</p>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>{email}</p>
            <p style={{ fontSize: 11, color: '#ef4444', margin: '0 0 20px' }}>⏱ Code expires in 30 minutes</p>
            <OtpInput otp={otp} onInput={handleOtpInput} onKeyDown={handleOtpKeyDown} />
            <Btn label={loading ? 'Verifying…' : 'Verify email'} onClick={handleVerifySignup} disabled={loading || otp.join('').length !== 6} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
              <button onClick={resendSignupOtp} style={s.link}>Resend code</button>
              <button onClick={() => { setMode('signup'); setError(''); setInfo(''); resetOtp() }} style={{ ...s.link, color: '#9ca3af' }}>Back</button>
            </div>
          </>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot' && (
          <>
            <h2 style={s.title}>Reset password</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>Enter your registered email and we'll send you a reset code.</p>
            <Field label="Email"><Inp value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoFocus onKeyDown={(e: any) => e.key === 'Enter' && handleForgot()} /></Field>
            <Btn label={loading ? 'Sending…' : 'Send reset code'} onClick={handleForgot} disabled={loading} />
            <p style={s.toggle}><button onClick={() => { setMode('login'); setError(''); setInfo('') }} style={s.link}>Back to sign in</button></p>
          </>
        )}

        {/* ── VERIFY RESET OTP ── */}
        {mode === 'verify_reset' && (
          <>
            <h2 style={s.title}>Enter reset code</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 6px' }}>If your email is registered, a 6-digit code was sent to</p>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>{email}</p>
            <p style={{ fontSize: 11, color: '#ef4444', margin: '0 0 20px' }}>⏱ Code expires in 30 minutes</p>
            <OtpInput otp={otp} onInput={handleOtpInput} onKeyDown={handleOtpKeyDown} />
            <Btn label={loading ? 'Verifying…' : 'Verify code'} onClick={handleVerifyReset} disabled={loading || otp.join('').length !== 6} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
              <button onClick={resendResetOtp} style={s.link}>Resend code</button>
              <button onClick={() => { setMode('forgot'); setError(''); setInfo(''); resetOtp() }} style={{ ...s.link, color: '#9ca3af' }}>Back</button>
            </div>
          </>
        )}

        {/* ── NEW PASSWORD ── */}
        {mode === 'new_password' && (
          <>
            <h2 style={s.title}>Set new password</h2>
            <Field label="New password">
              <Inp value={newPassword} onChange={(v: string) => { setNewPassword(v); checkStrength(v) }} placeholder="Min. 8 characters" type="password" autoFocus />
              {passwordStrength && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {(['weak', 'fair', 'strong'] as const).map((level, i) => (
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
                    {passwordStrength === 'weak' ? 'Weak' : passwordStrength === 'fair' ? 'Fair' : 'Strong ✓'}
                  </p>
                </div>
              )}
            </Field>
            <Field label="Confirm new password">
              <Inp value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Re-enter new password" type="password" onKeyDown={(e: any) => e.key === 'Enter' && handleNewPassword()} />
            </Field>
            <Btn label={loading ? 'Updating…' : 'Update password'} onClick={handleNewPassword} disabled={loading} />
          </>
        )}

      </div>
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function Inp({ value, onChange, placeholder, type = 'text', onKeyDown, autoFocus }: any) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      type={type} onKeyDown={onKeyDown} autoFocus={autoFocus}
      style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
  )
}

function Btn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ width: '100%', background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {label}
    </button>
  )
}

function OtpInput({ otp, onInput, onKeyDown }: { otp: string[]; onInput: (i: number, v: string) => void; onKeyDown: (i: number, e: React.KeyboardEvent) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
      {otp.map((digit, i) => (
        <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={1}
          value={digit} onChange={e => onInput(i, e.target.value)}
          onKeyDown={e => onKeyDown(i, e)} autoFocus={i === 0}
          style={{
            width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 600,
            border: `2px solid ${digit ? '#111' : '#e5e7eb'}`, borderRadius: 8,
            outline: 'none', background: '#fff', color: '#111',
          }} />
      ))}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 16 },
  card: { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '32px 30px', width: '100%', maxWidth: 390 },
  title: { margin: '0 0 20px', fontSize: 18, fontWeight: 600 },
  error: { background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 14 },
  info: { background: '#f0fdf4', color: '#15803d', fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 14 },
  toggle: { fontSize: 13, textAlign: 'center', marginTop: 14, color: '#6b7280' },
  link: { background: 'none', border: 'none', cursor: 'pointer', color: '#111', fontWeight: 500, fontSize: 13, padding: 0, textDecoration: 'underline' },
}
