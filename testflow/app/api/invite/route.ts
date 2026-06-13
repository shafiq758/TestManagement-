import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '@#$!'
  // Ensure at least one of each required type
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
  // Shuffle
  return pwd.sort(() => Math.random() - 0.5).join('')
}

export async function POST(req: NextRequest) {
  try {
    const { invitedEmail, inviterName, workspaceName, workspaceId, role, appUrl } = await req.json()

    // Admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (!invitedEmail || !workspaceName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const tempPassword = generateTempPassword()

    // Check if user already exists in Supabase Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === invitedEmail.toLowerCase())

    let userId: string

    if (existingUser) {
      // User exists — just update their workspace_members record
      userId = existingUser.id
      // Update the pending invite with their user_id
      await supabaseAdmin.from('workspace_members')
        .update({ user_id: userId, status: 'active' })
        .eq('workspace_id', workspaceId)
        .eq('invited_email', invitedEmail.toLowerCase())
    } else {
      // Create new user with temp password (pre-confirmed)
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: invitedEmail.toLowerCase(),
        password: tempPassword,
        email_confirm: true, // auto-confirm so they can login directly
        user_metadata: {
          temp_password: true, // flag to force password change on first login
          invited: true,
        },
      })

      if (createErr || !newUser.user) {
        return NextResponse.json({ error: createErr?.message || 'Failed to create user' }, { status: 500 })
      }

      userId = newUser.user.id

      // Link user to their pending workspace_members record
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

    // Send invite email with temp password
    await transporter.sendMail({
      from: `"TestFlow" <${process.env.SMTP_USER}>`,
      to: invitedEmail,
      subject: `You've been invited to join ${workspaceName} on TestFlow`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="margin-bottom: 24px;">
            <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 4px; color: #111;">TestFlow</h1>
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">Modern Test Case Management</p>
          </div>

          <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 12px; color: #111;">
            You've been invited to ${workspaceName}
          </h2>

          <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 8px;">
            ${inviterName ? `<strong>${inviterName}</strong> has` : 'You have been'} invited you to join <strong>${workspaceName}</strong> on TestFlow as an <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong>.
          </p>
          <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px;">
            As a ${role}, you'll be able to ${roleDesc}.
          </p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="font-size: 13px; font-weight: 600; color: #374151; margin: 0 0 12px;">Your login credentials:</p>
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 6px;">Email: <strong style="color: #111;">${invitedEmail}</strong></p>
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px;">Temporary password: <strong style="font-family: monospace; font-size: 16px; color: #111; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #e5e7eb;">${existingUser ? 'Use your existing password' : tempPassword}</strong></p>
            ${!existingUser ? '<p style="font-size: 12px; color: #ef4444; margin: 0;">⚠️ You will be required to change this password on first login.</p>' : ''}
          </div>

          <a href="${appUrl}/auth" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 24px;">
            Sign in to TestFlow →
          </a>

          <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            If you didn't expect this invitation, please ignore this email and contact your administrator.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
