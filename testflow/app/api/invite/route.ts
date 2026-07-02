import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '@#$!'
  const pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
    lower[Math.floor(Math.random() * lower.length)],
  ]
  return pwd.sort(() => Math.random() - 0.5).join('')
}

export async function POST(req: NextRequest) {
  try {
    const { invitedEmail, inviterName, workspaceName, workspaceId, role, appUrl } = await req.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (!invitedEmail || !workspaceName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const tempPassword = generateTempPassword()

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === invitedEmail.toLowerCase())

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      await supabaseAdmin.from('workspace_members')
        .update({ user_id: userId, status: 'active' })
        .eq('workspace_id', workspaceId)
        .eq('invited_email', invitedEmail.toLowerCase())
    } else {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: invitedEmail.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: { temp_password: true, invited: true },
      })
      if (createErr || !newUser.user) {
        return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })
      }
      userId = newUser.user.id
      await supabaseAdmin.from('workspace_members')
        .update({ user_id: userId, status: 'active' })
        .eq('workspace_id', workspaceId)
        .eq('invited_email', invitedEmail.toLowerCase())
    }

    const roleDescriptions: Record<string, string> = {
      editor: 'create and edit projects, sections, and test cases',
      tester: 'execute test runs and mark results',
      viewer: 'view all content in read-only mode',
    }
    const roleDesc = roleDescriptions[role] || 'access the workspace'

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 4px; color: #111;">TestFlow</h1>
        <p style="font-size: 12px; color: #9ca3af; margin: 0 0 24px;">Modern Test Case Management</p>
        <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 12px; color: #111;">You've been invited to ${workspaceName}</h2>
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 8px;">
          ${inviterName ? `<strong>${inviterName}</strong> has invited you` : 'You have been invited'} to join <strong>${workspaceName}</strong> on TestFlow as an <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong>.
        </p>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px;">As a ${role}, you'll be able to ${roleDesc}.</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="font-size: 13px; font-weight: 600; color: #374151; margin: 0 0 12px;">Your login credentials:</p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 6px;">Email: <strong style="color: #111;">${invitedEmail}</strong></p>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px;">Password: <strong style="font-family: monospace; font-size: 16px; color: #111; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #e5e7eb;">${existingUser ? 'Use your existing password' : tempPassword}</strong></p>
          ${!existingUser ? '<p style="font-size: 12px; color: #ef4444; margin: 0;">⚠️ Please change this password after first login.</p>' : ''}
        </div>
        <a href="${appUrl}/auth" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 24px;">Sign in to TestFlow →</a>
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">If you didn't expect this invitation, please ignore this email.</p>
      </div>
    `

    // Try Brevo first, then SendGrid, then Resend, then Gmail
    const brevoKey = process.env.BREVO_API_KEY
    const sendgridKey = process.env.SENDGRID_API_KEY
    const resendKey = process.env.RESEND_API_KEY

    console.log('Email keys:', { brevo: !!brevoKey, sendgrid: !!sendgridKey, resend: !!resendKey })

    if (brevoKey) {
      // Brevo (free 300/day, no domain needed)
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'TestFlow', email: process.env.SMTP_USER || 'admintestflow@gmail.com' },
          to: [{ email: invitedEmail }],
          subject: `You've been invited to join ${workspaceName} on TestFlow`,
          htmlContent: htmlBody,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Brevo error: ${err}`)
      }
    } else if (sendgridKey) {
      // SendGrid
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: invitedEmail }] }],
          from: { email: process.env.SMTP_USER || 'admintestflow@gmail.com', name: 'TestFlow' },
          subject: `You've been invited to join ${workspaceName} on TestFlow`,
          content: [{ type: 'text/html', value: htmlBody }],
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`SendGrid error: ${err}`)
      }
    } else if (resendKey) {
      // Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'TestFlow <onboarding@resend.dev>',
          to: invitedEmail,
          subject: `You've been invited to join ${workspaceName} on TestFlow`,
          html: htmlBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Resend failed')
    } else {
      // Gmail fallback
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
      await transporter.sendMail({
        from: `"TestFlow" <${process.env.SMTP_USER}>`,
        to: invitedEmail,
        subject: `You've been invited to join ${workspaceName} on TestFlow`,
        html: htmlBody,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Invite error:', error)
    return NextResponse.json({ 
      error: error.message,
      brevo: !!process.env.BREVO_API_KEY,
      resend: !!process.env.RESEND_API_KEY,
      sendgrid: !!process.env.SENDGRID_API_KEY,
    }, { status: 500 })
  }
}
