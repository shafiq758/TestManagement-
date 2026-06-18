import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { project_id, user_id, role, invited_by } = await req.json()

    if (!project_id || !user_id || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Verify the requester is an admin
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if requester is workspace admin for this project
    const { data: project } = await supabase.from('projects').select('workspace_id').eq('id', project_id).single()
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { data: member } = await supabase.from('workspace_members')
      .select('role').eq('user_id', user.id).eq('workspace_id', project.workspace_id).single()

    if (member?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can add project members' }, { status: 403 })
    }

    // Insert project member using service role (bypasses RLS)
    const { data, error } = await supabase.from('project_members').upsert({
      project_id, user_id, role, invited_by: user.id
    }, { onConflict: 'project_id,user_id' }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data }, { status: 200 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, project_id } = await req.json()

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project } = await supabase.from('projects').select('workspace_id').eq('id', project_id).single()
    const { data: member } = await supabase.from('workspace_members')
      .select('role').eq('user_id', user.id).eq('workspace_id', project?.workspace_id).single()

    if (member?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await supabase.from('project_members').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, role, project_id } = await req.json()

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project } = await supabase.from('projects').select('workspace_id').eq('id', project_id).single()
    const { data: member } = await supabase.from('workspace_members')
      .select('role').eq('user_id', user.id).eq('workspace_id', project?.workspace_id).single()

    if (member?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await supabase.from('project_members').update({ role }).eq('id', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
