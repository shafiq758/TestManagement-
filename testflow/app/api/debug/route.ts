import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET() {
  return NextResponse.json({
    brevo: process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.slice(0, 8) + '...' : 'NOT SET',
    smtp_user: process.env.SMTP_USER || 'NOT SET',
    resend: process.env.RESEND_API_KEY ? 'SET' : 'NOT SET',
  })
}
