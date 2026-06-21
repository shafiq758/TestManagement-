import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { text, projectId, docId, commentId, type, link, createdBy, workspaceId } = await req.json()
    const sb = getSupabase()

    // Find @mentions - match word chars and dots/plus (email-style names)
    const mentionMatches = text.match(/@([\w.+]+)/g) || []
    if (mentionMatches.length === 0) return NextResponse.json({ success: true, count: 0 })

    const mentionNames = mentionMatches.map((m: string) => m.slice(1).toLowerCase())

    // Find workspace members
    const { data: members } = await sb.from('workspace_members')
      .select('user_id, invited_email, display_name')
      .eq('workspace_id', workspaceId)

    const notifications: any[] = []
    for (const member of (members || [])) {
      const displayName = (member.display_name || '').toLowerCase().replace(/\s+/g, '')
      const emailPrefix = (member.invited_email?.split('@')[0] || '').toLowerCase()
      
      // Match against display name (no spaces) or email prefix
      const isMatch = (mentionNames as string[]).some((n: string) => 
        n === displayName || n === emailPrefix || 
        displayName.startsWith(n) || emailPrefix.startsWith(n)
      )
      
      if (isMatch && member.user_id !== createdBy) {
        notifications.push({
          user_id: member.user_id,
          type: type || 'mention',
          title: 'You were mentioned',
          body: text.slice(0, 120),
          link: link || null,
          project_id: projectId || null,
          doc_id: docId || null,
          comment_id: commentId || null,
          created_by: createdBy || null,
        })
      }
    }

    if (notifications.length > 0) {
      const { error } = await sb.from('notifications').insert(notifications)
      if (error) {
        console.error('Notification insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, count: notifications.length })
  } catch (e: any) {
    console.error('Notification error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { ids, all, userId } = await req.json()
    const sb = getSupabase()

    if (all && userId) {
      await sb.from('notifications').update({ read: true }).eq('user_id', userId)
    } else if (ids?.length > 0) {
      await sb.from('notifications').update({ read: true }).in('id', ids)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
