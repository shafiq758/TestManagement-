'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [strength, setStrength] = useState<'weak' | 'fair' | 'strong' | ''>('')
  const sb = createClient()

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/auth'); return }
      setUser(data.session.user)
    })
  }, [])

  const checkStrength = (p: string) => {
    if (!p) { setStrength(''); return }
    const checks = [/[A-Z]/.test(p), /[a-z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p), p.length >= 8]
    const score = checks.filter(Boolean).length
    setStrength(score <= 2 ? 'weak' : score <= 3 ? 'fair' : 'strong')
  }

  const validatePassword = (p: string) => {
    if (p.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(p)) return 'Must contain at least one uppercase letter.'
    if (!/[a-z]/.test(p)) return 'Must contain at least one lowercase letter.'
    if (!/[0-9]/.test(p)) return 'Must contain at least one number.'
    return ''
  }

  const handleChangePassword = async () => {
    setError(''); setSuccess('')
    if (!currentPassword) { setError('Current password is required.'); return }
    const pwErr = validatePassword(newPassword)
    if (pwErr) { setError(pwErr); return }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return }
    if (currentPassword === newPassword) { setError('New password must be different from current password.'); return }

    setLoading(true)

    // Step 1: Verify current password by re-authenticating
    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInErr) {
      setError('Current password is incorrect.')
      setLoading(false)
      return
    }

    // Step 2: Update to new password
    const { error: updateErr } = await sb.auth.updateUser({ password: newPassword })

    if (updateErr) {
      setError(updateErr.message)
      setLoading(false)
      return
    }

    setSuccess('Password changed successfully.')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setStrength('')
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, background: '#fff', overflowY: 'auto' }}>
      <div style={{ padding: '20px 28px 0', borderBottom: '1px solid #e5e7eb', marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 600 }}>Settings</h1>
      </div>

      <div style={{ padding: '0 28px', maxWidth: 480 }}>

        {/* Profile info */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Profile</h3>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                {(user?.user_metadata?.name || user?.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 14 }}>{user?.user_metadata?.name || '—'}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>Change password</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
            You must enter your current password to set a new one.
          </p>

          {error && <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>{error}</div>}
          {success && <div style={{ background: '#f0fdf4', color: '#15803d', fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>{success}</div>}

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Current password">
              <Inp value={currentPassword} onChange={setCurrentPassword} type="password" placeholder="Enter current password" />
            </Field>

            <Field label="New password">
              <Inp value={newPassword} onChange={(v: string) => { setNewPassword(v); checkStrength(v) }} type="password" placeholder="Min. 8 characters" />
              {strength && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {(['weak', 'fair', 'strong'] as const).map((level, i) => (
                      <div key={level} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: strength === 'weak' && i === 0 ? '#ef4444'
                          : strength === 'fair' && i <= 1 ? '#f59e0b'
                          : strength === 'strong' && i <= 2 ? '#16a34a'
                          : '#e5e7eb'
                      }} />
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: strength === 'weak' ? '#ef4444' : strength === 'fair' ? '#d97706' : '#16a34a' }}>
                    {strength === 'weak' ? 'Weak — add uppercase, numbers, symbols' : strength === 'fair' ? 'Fair — getting stronger' : 'Strong ✓'}
                  </p>
                </div>
              )}
            </Field>

            <Field label="Confirm new password">
              <Inp value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Re-enter new password"
                onKeyDown={(e: any) => e.key === 'Enter' && handleChangePassword()} />
              {confirmPassword && newPassword && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: confirmPassword === newPassword ? '#16a34a' : '#ef4444' }}>
                  {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </Field>

            <button onClick={handleChangePassword} disabled={loading}
              style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function Inp({ value, onChange, type, placeholder, onKeyDown }: any) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} type={type}
      placeholder={placeholder} onKeyDown={onKeyDown}
      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
  )
}
