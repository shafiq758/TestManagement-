'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import MentionInput from './MentionInput'

interface InlineCommentsProps {
  entityId: string
  entityType: 'test_case' | 'bug'
  mentionMembers?: any[]
}

export default function InlineComments({ entityId, entityType, mentionMembers = [] }: InlineCommentsProps) {
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const sb = createClient()

  // Use window fallback for members if prop is empty
  const members = mentionMembers.length > 0
    ? mentionMembers
    : (typeof window !== 'undefined' ? (window as any).__testflow_members || [] : [])

  const table = entityType === 'test_case' ? 'test_case_comments' : 'bug_comments'
  const fkCol = entityType === 'test_case' ? 'test_case_id' : 'bug_id'

  useEffect(() => {
    if (!entityId) return
    loadComments()
  }, [entityId])

  const loadComments = async () => {
    setLoading(true)
    const { data } = await sb.from(table).select('*').eq(fkCol, entityId).order('created_at')
    setComments(data || [])
    setLoading(false)
  }

  const submitComment = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    const { data: { session } } = await sb.auth.getSession()
    const { data: comment } = await sb.from(table).insert({
      [fkCol]: entityId,
      comment: newComment.trim(),
      created_by: session?.user.id,
    }).select().single()
    if (comment) setComments(p => [...p, comment])
    setNewComment('')
    setSubmitting(false)
  }

  const deleteComment = async (id: string, createdBy: string) => {
    const { data: { session } } = await sb.auth.getSession()
    if (session?.user.id !== createdBy) return
    await sb.from(table).delete().eq('id', id)
    setComments(p => p.filter(c => c.id !== id))
  }

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Comments ({comments.length})
      </p>

      {/* Existing comments */}
      {loading ? (
        <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', border: '1px solid #f3f4f6' }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{c.comment}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(c.created_at).toLocaleString()}</span>
                <button onClick={() => deleteComment(c.id, c.created_by)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#d1d5db', padding: 0 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#d1d5db'}>
                  ✕
                </button>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No comments yet.</p>
          )}
        </div>
      )}

      {/* New comment input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <MentionInput
          value={newComment}
          onChange={setNewComment}
          members={members}
          placeholder="Add a comment… type @ to mention"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submitComment()
            }
          }}
        />
        <button onClick={submitComment} disabled={!newComment.trim() || submitting}
          style={{ alignSelf: 'flex-end', background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: newComment.trim() ? 'pointer' : 'not-allowed', opacity: newComment.trim() ? 1 : 0.5 }}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
}
