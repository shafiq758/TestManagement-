import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function POST(req: NextRequest) {
  try {
    const { invitedEmail, inviterName, workspaceName, role, appUrl } = await req.json()

    if (!invitedEmail || !workspaceName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const roleDescriptions: Record<string, string> = {
      editor: 'create and edit projects, sections, and test cases',
      tester: 'execute test runs and mark results',
      viewer: 'view all content in read-only mode',
    }

    const roleDesc = roleDescriptions[role] || 'access the workspace'
    const signupUrl = `${appUrl}/auth`

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
            As an ${role}, you'll be able to ${roleDesc}.
          </p>

          <a href="${signupUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 24px;">
            Accept invitation →
          </a>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #374151; margin: 0 0 8px; font-weight: 500;">How to join:</p>
            <ol style="font-size: 13px; color: #6b7280; margin: 0; padding-left: 16px; line-height: 1.8;">
              <li>Click the button above</li>
              <li>Sign up using this email address: <strong>${invitedEmail}</strong></li>
              <li>You'll automatically be added to ${workspaceName}</li>
            </ol>
          </div>

          <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Email send error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
