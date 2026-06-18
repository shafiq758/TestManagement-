import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifyAdmin(req: NextRequest, projectId: string) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = getSupabase()
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return null
  const { data: project } = await sb.from('projects').select('workspace_id').eq('id', projectId).single()
  if (!project) return null
  const { data: member } = await sb.from('workspace_members').select('role').eq('user_id', user.id).eq('workspace_id', project.workspace_id).single()
  if (member?.role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { project_id, user_id, role } = body
    if (!project_id || !user_id || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const user = await verifyAdmin(req, project_id)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const sb = getSupabase()
    const { data, error } = await sb.from('project_members').upsert({ project_id, user_id, role, invited_by: user.id }, { onConflict: 'project_id,user_id' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, project_id } = await req.json()
    const user = await verifyAdmin(req, project_id)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const sb = getSupabase()
    await sb.from('project_members').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, role, project_id } = await req.json()
    const user = await verifyAdmin(req, project_id)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const sb = getSupabase()
    await sb.from('project_members').update({ role }).eq('id', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
