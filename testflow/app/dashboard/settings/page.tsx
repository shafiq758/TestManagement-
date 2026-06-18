'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [displayName, setDisplayName] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [strength, setStrength] = useState<'weak' | 'fair' | 'strong' | ''>('')
  const sb = createClient()

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/auth'); return }
      setUser(data.session.user)
      setDisplayName(data.session.user.user_metadata?.name || '')
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

  const handleUpdateName = async () => {
    setNameError(''); setNameSuccess('')
    if (!displayName.trim()) { setNameError('Name cannot be empty.'); return }
    if (displayName.trim() === (user?.user_metadata?.name || '')) {
      setNameError('This is already your current name.'); return
    }
    setNameLoading(true)
    const { error: e } = await sb.auth.updateUser({
      data: { name: displayName.trim() }
    })
    // Also save to workspace_members so other users can see display name
    if (!e) {
      await sb.from('workspace_members').update({ display_name: displayName.trim() }).eq('user_id', user?.id)
    }
    if (e) { setNameError(e.message); setNameLoading(false); return }
    setUser((p: any) => ({ ...p, user_metadata: { ...p.user_metadata, name: displayName.trim() } }))
    setNameSuccess('Name updated successfully.')
    setNameLoading(false)
  }

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('')
    if (!currentPassword) { setPwError('Current password is required.'); return }
    const pwErr = validatePassword(newPassword)
    if (pwErr) { setPwError(pwErr); return }
    if (newPassword !== confirmPassword) { setPwError('New passwords do not match.'); return }
    if (currentPassword === newPassword) { setPwError('New password must be different from current password.'); return }
    setPwLoading(true)

    // Verify current password
    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: user.email, password: currentPassword,
    })
    if (signInErr) { setPwError('Current password is incorrect.'); setPwLoading(false); return }

    // Update to new password
    const { error: updateErr } = await sb.auth.updateUser({ password: newPassword })
    if (updateErr) { setPwError(updateErr.message); setPwLoading(false); return }

    setPwSuccess('Password changed successfully.')
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setStrength('')
    setPwLoading(false)
  }

  const s = styles

  return (
    <div style={{ flex: 1, background: '#fff', overflowY: 'auto' }}>
      <div style={{ padding: '20px 28px 0', borderBottom: '1px solid #e5e7eb', marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 600 }}>Settings</h1>
      </div>

      <div style={{ padding: '0 28px', maxWidth: 500 }}>

        {/* Profile section */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={s.sectionTitle}>Profile</h3>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '16px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
              {(displayName || user?.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 15 }}>{displayName || '—'}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{user?.email}</p>
            </div>
          </div>

          {/* Display name */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
            {nameError && <div style={s.error}>{nameError}</div>}
            {nameSuccess && <div style={s.success}>{nameSuccess}</div>}
            <Field label="Display name">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name" onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
                  style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none' }} />
                <button onClick={handleUpdateName} disabled={nameLoading}
                  style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: nameLoading ? 'not-allowed' : 'pointer', opacity: nameLoading ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  {nameLoading ? 'Saving…' : 'Save name'}
                </button>
              </div>
            </Field>

            {/* Email — read only */}
            <Field label="Email address">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input value={user?.email || ''} disabled
                  style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', background: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }} />
                <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '4px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>Read only</span>
              </div>
              <p style={{ margin: '5px 0 0', fontSize: 12, color: '#9ca3af' }}>
                To change your email, contact your workspace admin.
              </p>
            </Field>
          </div>
        </div>

        {/* Change password section */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={s.sectionTitle}>Change password</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
            You must enter your current password to set a new one.
          </p>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
            {pwError && <div style={s.error}>{pwError}</div>}
            {pwSuccess && <div style={s.success}>{pwSuccess}</div>}

            <Field label="Current password">
              <Inp value={currentPassword} onChange={setCurrentPassword} type="password" placeholder="Enter current password" />
            </Field>
            <Field label="New password">
              <Inp value={newPassword} onChange={(v: string) => { setNewPassword(v); checkStrength(v) }} type="password" placeholder="Min. 8 characters" />
              {strength && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {(['weak','fair','strong'] as const).map((level, i) => (
                      <div key={level} style={{ flex: 1, height: 3, borderRadius: 2, background: strength === 'weak' && i === 0 ? '#ef4444' : strength === 'fair' && i <= 1 ? '#f59e0b' : strength === 'strong' && i <= 2 ? '#16a34a' : '#e5e7eb' }} />
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

            <button onClick={handleChangePassword} disabled={pwLoading}
              style={{ width: '100%', background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 500, cursor: pwLoading ? 'not-allowed' : 'pointer', opacity: pwLoading ? 0.5 : 1 }}>
              {pwLoading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
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

const styles = {
  sectionTitle: { margin: '0 0 14px', fontSize: 14, fontWeight: 600 } as React.CSSProperties,
  error: { background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 14 } as React.CSSProperties,
  success: { background: '#f0fdf4', color: '#15803d', fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 14 } as React.CSSProperties,
}
