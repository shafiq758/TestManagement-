'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { generateToken, getLocalToken, setLocalToken } from '@/lib/browserTrust'

type Mode = 'login' | 'signup' | 'forgot' | 'verify_signup' | 'verify_login' | 'verify_reset' | 'new_password' | 'blocked' | 'contact_admin'

const SUPER_ADMIN_EMAIL = 'muhamad.shafiqurrehman@gmail.com'
const MAX_ATTEMPTS = 3

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
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [contactMessage, setContactMessage] = useState('')
  const [contactSent, setContactSent] = useState(false)

  const sb = createClient()

  const checkStrength = (p: string) => {
    if (!p) { setPasswordStrength(''); return }
    const checks = [/[A-Z]/.test(p), /[a-z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p), p.length >= 8]
    setPasswordStrength(checks.filter(Boolean).length <= 2 ? 'weak' : checks.filter(Boolean).length <= 3 ? 'fair' : 'strong')
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

  // ── OTP attempt tracking ─────────────────────────────────────
  const checkBlocked = async (emailAddr: string): Promise<boolean> => {
    const { data } = await sb.from('otp_attempts').select('*').eq('email', emailAddr).single()
    if (data?.blocked) return true
    return false
  }

  const recordFailedAttempt = async (emailAddr: string): Promise<number> => {
    const { data: existing } = await sb.from('otp_attempts').select('*').eq('email', emailAddr).single()
    const currentAttempts = existing?.attempts || 0
    const newAttempts = currentAttempts + 1
    const blocked = newAttempts >= MAX_ATTEMPTS

    await sb.from('otp_attempts').upsert({
      email: emailAddr,
      attempts: newAttempts,
      blocked,
      blocked_at: blocked ? new Date().toISOString() : null,
      last_attempt_at: new Date().toISOString(),
    }, { onConflict: 'email' })

    return MAX_ATTEMPTS - newAttempts
  }

  const clearAttempts = async (emailAddr: string) => {
    await sb.from('otp_attempts').upsert({
      email: emailAddr, attempts: 0, blocked: false, blocked_at: null,
      last_attempt_at: new Date().toISOString(),
    }, { onConflict: 'email' })
  }

  // ── SIGNUP ───────────────────────────────────────────────────
  const handleSignup = async () => {
    setError('')
    if (!name.trim()) { setError('Name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    const pwErr = validatePassword(password)
    if (pwErr) { setError(pwErr); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)

    // Check if blocked
    const blocked = await checkBlocked(email.trim().toLowerCase())
    if (blocked) { setMode('blocked'); setLoading(false); return }

    const { data, error: e } = await sb.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { name: name.trim() } }
    })
    if (e) { setError(e.message); setLoading(false); return }

    // Send OTP
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: undefined }
    })

    setLoading(false)
    resetOtp()
    setAttemptsLeft(MAX_ATTEMPTS)
    setMode('verify_signup')
  }

  // ── VERIFY SIGNUP OTP ────────────────────────────────────────
  const handleVerifySignup = async () => {
    setError('')
    const code = otp.join('')
    if (code.length !== 6) { setError('Please enter the full 6-digit code.'); return }
    setLoading(true)

    const { error: e } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(), token: code, type: 'email'
    })

    if (e) {
      const left = await recordFailedAttempt(email.trim().toLowerCase())
      if (left <= 0) {
        await sb.auth.signOut()
        setMode('blocked')
      } else {
        setAttemptsLeft(left)
        setError(`Invalid or expired code. ${left} attempt${left !== 1 ? 's' : ''} remaining.`)
        resetOtp()
      }
      setLoading(false)
      return
    }

    await clearAttempts(email.trim().toLowerCase())
    // Save trusted browser token
    const token = generateToken()
    setLocalToken(token)
    const { data: { session } } = await sb.auth.getSession()
    if (session?.user) {
      await sb.from('trusted_browsers').upsert(
        { user_id: session.user.id, token },
        { onConflict: 'user_id' }
      )
    }
    router.replace('/dashboard')
  }

  const resendSignupOtp = async () => {
    setError(''); setInfo('')
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: undefined }
    })
    resetOtp()
    setAttemptsLeft(MAX_ATTEMPTS)
    setInfo('A new 6-digit code has been sent.')
  }

  // ── LOGIN ────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }

    // Check if blocked
    const blocked = await checkBlocked(email.trim().toLowerCase())
    if (blocked) { setMode('blocked'); return }

    setLoading(true)
    const { data, error: e } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (e) { setError('Invalid email or password.'); setLoading(false); return }

    if (data.user?.email === SUPER_ADMIN_EMAIL) { router.replace('/superadmin'); return }

    if (!data.user?.email_confirmed_at) {
      setError('Please verify your email first.')
      await sb.auth.signOut()
      setLoading(false)
      return
    }

    // Check trusted browser
    const localToken = getLocalToken()
    if (localToken) {
      const { data: trust } = await sb.from('trusted_browsers')
        .select('token').eq('user_id', data.user.id).single()
      if (trust?.token === localToken) {
        // Trusted browser — skip OTP
        router.replace('/dashboard')
        return
      }
    }

    // Untrusted browser — require OTP verification
    await sb.auth.signOut()
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: undefined }
    })
    setLoading(false)
    resetOtp()
    setAttemptsLeft(MAX_ATTEMPTS)
    setMode('verify_login')
  }

  // ── FORGOT PASSWORD ──────────────────────────────────────────
  const handleForgot = async () => {
    setError(''); setInfo('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true)

    // Check if blocked
    const blocked = await checkBlocked(email.trim().toLowerCase())
    if (blocked) { setMode('blocked'); setLoading(false); return }

    // Always send same message — silently send OTP only if user exists
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: undefined }
    })

    setLoading(false)
    resetOtp()
    setAttemptsLeft(MAX_ATTEMPTS)
    setMode('verify_reset')
    setInfo('If this email is registered, a 6-digit code was sent. Please check your inbox.')
  }

  // ── VERIFY RESET OTP ─────────────────────────────────────────
  const handleVerifyReset = async () => {
    setError('')
    const code = otp.join('')
    if (code.length !== 6) { setError('Please enter the full 6-digit code.'); return }
    setLoading(true)

    const { error: e } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(), token: code, type: 'email'
    })

    if (e) {
      const left = await recordFailedAttempt(email.trim().toLowerCase())
      if (left <= 0) {
        setMode('blocked')
      } else {
        setAttemptsLeft(left)
        setError(`Invalid or expired code. ${left} attempt${left !== 1 ? 's' : ''} remaining.`)
        resetOtp()
      }
      setLoading(false)
      return
    }

    await clearAttempts(email.trim().toLowerCase())
    // Save trusted browser token
    const token = generateToken()
    setLocalToken(token)
    const { data: { session } } = await sb.auth.getSession()
    if (session?.user) {
      await sb.from('trusted_browsers').upsert(
        { user_id: session.user.id, token },
        { onConflict: 'user_id' }
      )
    }
    setLoading(false)
    setMode('new_password')
  }

  const resendResetOtp = async () => {
    setError(''); setInfo('')
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: undefined }
    })
    resetOtp()
    setAttemptsLeft(MAX_ATTEMPTS)
    setInfo('A new code has been sent.')
  }

  // ── VERIFY LOGIN OTP (new browser) ──────────────────────────
  const handleVerifyLogin = async () => {
    setError('')
    const code = otp.join('')
    if (code.length !== 6) { setError('Please enter the full 6-digit code.'); return }
    setLoading(true)

    // Re-sign in first to get session back
    const { data: signInData, error: signInErr } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password
    })
    if (signInErr) { setError('Session expired. Please sign in again.'); setMode('login'); setLoading(false); return }

    const { error: e } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(), token: code, type: 'email'
    })

    if (e) {
      const left = await recordFailedAttempt(email.trim().toLowerCase())
      if (left <= 0) {
        await sb.auth.signOut()
        setMode('blocked')
      } else {
        setAttemptsLeft(left)
        setError(`Invalid or expired code. ${left} attempt${left !== 1 ? 's' : ''} remaining.`)
        resetOtp()
      }
      setLoading(false)
      return
    }

    await clearAttempts(email.trim().toLowerCase())
    // Trust this browser — replaces any previous trusted browser
    const token = generateToken()
    setLocalToken(token)
    if (signInData.user) {
      await sb.from('trusted_browsers').upsert(
        { user_id: signInData.user.id, token },
        { onConflict: 'user_id' }
      )
    }
    router.replace('/dashboard')
  }

  const resendLoginOtp = async () => {
    setError(''); setInfo('')
    await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: undefined }
    })
    resetOtp()
    setAttemptsLeft(MAX_ATTEMPTS)
    setInfo('A new code has been sent.')
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
    setEmail(''); setPassword(''); setNewPassword(''); setConfirmNewPassword('')
    setMode('login')
    setInfo('Password updated successfully. Please sign in.')
  }

  // ── CONTACT ADMIN ────────────────────────────────────────────
  const handleContactAdmin = async () => {
    setError('')
    if (!contactMessage.trim()) { setError('Please enter a message.'); return }
    setLoading(true)

    await sb.from('unlock_requests').insert({
      email: email.trim().toLowerCase(),
      message: contactMessage.trim(),
      status: 'pending',
    })

    setLoading(false)
    setContactSent(true)
  }

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.card}>
        <Logo />
        {error && <div style={s.error}>{error}</div>}
        {info && <div style={s.info}>{info}</div>}

        {/* LOGIN */}
        {mode === 'login' && <>
          <h2 style={s.title}>Sign in</h2>
          <Field label="Email"><Inp value={email} onChange={setEmail} placeholder="you@example.com" type="email" /></Field>
          <Field label="Password"><Inp value={password} onChange={setPassword} placeholder="Your password" type="password" onKeyDown={(e: any) => e.key === 'Enter' && handleLogin()} /></Field>
          <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 14 }}>
            <button onClick={() => { setMode('forgot'); setError(''); setInfo('') }} style={s.link}>Forgot password?</button>
          </div>
          <Btn label={loading ? 'Signing in…' : 'Sign in'} onClick={handleLogin} disabled={loading} />
          <p style={s.toggle}>No account? <button onClick={() => { setMode('signup'); setError(''); setInfo('') }} style={s.link}>Sign up</button></p>
        </>}

        {/* SIGNUP */}
        {mode === 'signup' && <>
          <h2 style={s.title}>Create account</h2>
          <Field label="Name"><Inp value={name} onChange={setName} placeholder="Your full name" autoFocus /></Field>
          <Field label="Email"><Inp value={email} onChange={setEmail} placeholder="you@example.com" type="email" /></Field>
          <Field label="Password">
            <Inp value={password} onChange={(v: string) => { setPassword(v); checkStrength(v) }} placeholder="Min. 8 characters" type="password" />
            <StrengthBar strength={passwordStrength} />
          </Field>
          <Field label="Confirm password"><Inp value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" type="password" onKeyDown={(e: any) => e.key === 'Enter' && handleSignup()} /></Field>
          <Btn label={loading ? 'Creating…' : 'Create account'} onClick={handleSignup} disabled={loading} />
          <p style={s.toggle}>Already have one? <button onClick={() => { setMode('login'); setError(''); setInfo('') }} style={s.link}>Sign in</button></p>
        </>}

        {/* VERIFY SIGNUP */}
        {mode === 'verify_signup' && <>
          <h2 style={s.title}>Verify your email</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>We sent a 6-digit code to</p>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>{email}</p>
          <div style={{ display: 'flex', gap: 12, margin: '4px 0 20px' }}>
            <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>⏱ Expires in 5 minutes</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>• {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</p>
          </div>
          <OtpInput otp={otp} onInput={handleOtpInput} onKeyDown={handleOtpKeyDown} />
          <Btn label={loading ? 'Verifying…' : 'Verify email'} onClick={handleVerifySignup} disabled={loading || otp.join('').length !== 6} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
            <button onClick={resendSignupOtp} style={s.link}>Resend code</button>
            <button onClick={() => { setMode('signup'); setError(''); setInfo(''); resetOtp() }} style={{ ...s.link, color: '#9ca3af' }}>Back</button>
          </div>
        </>}

        {/* VERIFY LOGIN - new browser */}
        {mode === 'verify_login' && <>
          <h2 style={s.title}>Verify new browser</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>This browser isn't recognized. A 6-digit code was sent to</p>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>{email}</p>
          <div style={{ display: 'flex', gap: 12, margin: '4px 0 20px' }}>
            <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>⏱ Expires in 5 minutes</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>• {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</p>
          </div>
          <OtpInput otp={otp} onInput={handleOtpInput} onKeyDown={handleOtpKeyDown} />
          <Btn label={loading ? 'Verifying…' : 'Verify browser'} onClick={handleVerifyLogin} disabled={loading || otp.join('').length !== 6} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
            <button onClick={resendLoginOtp} style={s.link}>Resend code</button>
            <button onClick={() => { setMode('login'); setError(''); setInfo(''); resetOtp() }} style={{ ...s.link, color: '#9ca3af' }}>Back</button>
          </div>
          <div style={{ marginTop: 16, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
              🔒 Verifying will trust this browser. Your previous trusted browser will be removed.
            </p>
          </div>
        </>}

        {/* FORGOT */}
        {mode === 'forgot' && <>
          <h2 style={s.title}>Reset password</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>Enter your registered email and we'll send a reset code.</p>
          <Field label="Email"><Inp value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoFocus onKeyDown={(e: any) => e.key === 'Enter' && handleForgot()} /></Field>
          <Btn label={loading ? 'Sending…' : 'Send reset code'} onClick={handleForgot} disabled={loading} />
          <p style={s.toggle}><button onClick={() => { setMode('login'); setError(''); setInfo('') }} style={s.link}>Back to sign in</button></p>
        </>}

        {/* VERIFY RESET */}
        {mode === 'verify_reset' && <>
          <h2 style={s.title}>Enter reset code</h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>If registered, a 6-digit code was sent to</p>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>{email}</p>
          <div style={{ display: 'flex', gap: 12, margin: '4px 0 20px' }}>
            <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>⏱ Expires in 5 minutes</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>• {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</p>
          </div>
          <OtpInput otp={otp} onInput={handleOtpInput} onKeyDown={handleOtpKeyDown} />
          <Btn label={loading ? 'Verifying…' : 'Verify code'} onClick={handleVerifyReset} disabled={loading || otp.join('').length !== 6} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
            <button onClick={resendResetOtp} style={s.link}>Resend code</button>
            <button onClick={() => { setMode('forgot'); setError(''); setInfo(''); resetOtp() }} style={{ ...s.link, color: '#9ca3af' }}>Back</button>
          </div>
        </>}

        {/* NEW PASSWORD */}
        {mode === 'new_password' && <>
          <h2 style={s.title}>Set new password</h2>
          <Field label="New password">
            <Inp value={newPassword} onChange={(v: string) => { setNewPassword(v); checkStrength(v) }} placeholder="Min. 8 characters" type="password" autoFocus />
            <StrengthBar strength={passwordStrength} />
          </Field>
          <Field label="Confirm new password">
            <Inp value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Re-enter new password" type="password" onKeyDown={(e: any) => e.key === 'Enter' && handleNewPassword()} />
          </Field>
          <Btn label={loading ? 'Updating…' : 'Update password'} onClick={handleNewPassword} disabled={loading} />
        </>}

        {/* BLOCKED */}
        {mode === 'blocked' && <>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h2 style={{ ...s.title, textAlign: 'center' }}>Account locked</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
              Too many failed attempts. Your account has been locked for security. Please contact an admin to unlock it.
            </p>
            <Btn label="Contact admin" onClick={() => { setMode('contact_admin'); setError('') }} disabled={false} />
            <p style={{ marginTop: 12 }}>
              <button onClick={() => { setMode('login'); setError('') }} style={{ ...s.link, color: '#9ca3af', fontSize: 12 }}>Back to sign in</button>
            </p>
          </div>
        </>}

        {/* CONTACT ADMIN */}
        {mode === 'contact_admin' && <>
          <h2 style={s.title}>Contact admin</h2>
          {contactSent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 13, color: '#15803d', fontWeight: 500, margin: '0 0 8px' }}>Request sent!</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
                An admin will review your request and unlock your account. Please check your email.
              </p>
              <button onClick={() => { setMode('login'); setContactSent(false) }} style={s.link}>Back to sign in</button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
                Describe your issue and an admin will unlock your account.
              </p>
              <Field label="Your email">
                <Inp value={email} onChange={setEmail} placeholder="your@email.com" type="email" />
              </Field>
              <Field label="Message">
                <textarea value={contactMessage} onChange={e => setContactMessage(e.target.value)}
                  placeholder="Explain why your account should be unlocked..."
                  rows={4}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </Field>
              <Btn label={loading ? 'Sending…' : 'Send request'} onClick={handleContactAdmin} disabled={loading} />
              <p style={s.toggle}><button onClick={() => { setMode('blocked'); setError('') }} style={{ ...s.link, color: '#9ca3af' }}>Back</button></p>
            </>
          )}
        </>}

      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#111"/>
        <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
        <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".3"/>
        <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#111" opacity=".5"/>
      </svg>
      <span style={{ fontWeight: 600, fontSize: 16 }}>TestFlow</span>
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
          style={{ width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 600, border: `2px solid ${digit ? '#111' : '#e5e7eb'}`, borderRadius: 8, outline: 'none', background: '#fff', color: '#111' }} />
      ))}
    </div>
  )
}

function StrengthBar({ strength }: { strength: string }) {
  if (!strength) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {(['weak', 'fair', 'strong'] as const).map((level, i) => (
          <div key={level} style={{ flex: 1, height: 3, borderRadius: 2, background: strength === 'weak' && i === 0 ? '#ef4444' : strength === 'fair' && i <= 1 ? '#f59e0b' : strength === 'strong' && i <= 2 ? '#16a34a' : '#e5e7eb' }} />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: strength === 'weak' ? '#ef4444' : strength === 'fair' ? '#d97706' : '#16a34a' }}>
        {strength === 'weak' ? 'Weak — add uppercase, numbers, symbols' : strength === 'fair' ? 'Fair — getting stronger' : 'Strong password ✓'}
      </p>
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
