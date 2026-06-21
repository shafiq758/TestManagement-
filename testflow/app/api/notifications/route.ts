import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Create notifications for @mentions in text
export async function POST(req: NextRequest) {
  try {
    const { text, projectId, docId, commentId, type, link, createdBy, workspaceId } = await req.json()
    const sb = getSupabase()

    // Find @mentions in text
    const mentionMatches = text.match(/@(\w+)/g) || []
    if (mentionMatches.length === 0) return NextResponse.json({ success: true, count: 0 })

    const mentionNames = mentionMatches.map((m: string) => m.slice(1).toLowerCase())

    // Find workspace members matching the mentioned names
    const { data: members } = await sb.from('workspace_members')
      .select('user_id, invited_email, display_name')
      .eq('workspace_id', workspaceId)

    const notifications = []
    for (const member of (members || [])) {
      const name = (member.display_name || member.invited_email?.split('@')[0] || '').toLowerCase()
      if (mentionNames.includes(name) && member.user_id !== createdBy) {
        notifications.push({
          user_id: member.user_id,
          type: type || 'mention',
          title: 'You were mentioned',
          body: text.slice(0, 100),
          link,
          project_id: projectId,
          doc_id: docId || null,
          comment_id: commentId || null,
          created_by: createdBy,
        })
      }
    }

    if (notifications.length > 0) {
      await sb.from('notifications').insert(notifications)
    }

    return NextResponse.json({ success: true, count: notifications.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Mark notifications as read
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
