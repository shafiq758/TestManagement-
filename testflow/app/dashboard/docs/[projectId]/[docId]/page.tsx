'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { canEditCases } from '@/lib/roles'
import type { WorkspaceRole } from '@/types'
import dynamic from 'next/dynamic'

// Load editor dynamically to avoid SSR issues
const RichEditor = dynamic(() => import('@/components/RichEditor'), { ssr: false, loading: () => (
  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading editor…</div>
)})

export default function DocEditorPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const docId = params.docId as string

  const [doc, setDoc] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<any>({})
  const [sprints, setSprints] = useState<any[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [selectedSprintId, setSelectedSprintId] = useState('')
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('')
  const [myRole, setMyRole] = useState<WorkspaceRole>('viewer')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [pendingComment, setPendingComment] = useState<{text: string; from: number; to: number} | null>(null)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sb = createClient()

  useEffect(() => { load() }, [docId])

  const load = async () => {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.replace('/auth'); return }

    const [{ data: docData }, { data: sprs }, { data: mils }, { data: member }, { data: comms }] = await Promise.all([
      sb.from('documents').select('*').eq('id', docId).single(),
      sb.from('sprints').select('*').eq('project_id', projectId),
      sb.from('milestones').select('*').eq('project_id', projectId),
      sb.from('workspace_members').select('role').eq('user_id', session.user.id).single(),
      sb.from('document_comments').select('*').eq('document_id', docId).order('created_at'),
    ])

    if (!docData) { router.push(`/dashboard/docs/${projectId}`); return }

    setDoc(docData)
    setTitle(docData.title)
    setContent(docData.content || {})
    setSelectedSprintId(docData.sprint_id || '')
    setSelectedMilestoneId(docData.milestone_id || '')
    setSprints(sprs || [])
    setMilestones(mils || [])
    setMyRole((member?.role || 'viewer') as WorkspaceRole)
    setComments(comms || [])
    setLoading(false)
  }

  const canEdit = canEditCases(myRole)

  // Auto-save with debounce
  const autoSave = useCallback(async (newTitle: string, newContent: any, sprintId: string, milestoneId: string) => {
    if (!canEdit) return
    clearTimeout(saveTimer.current)
    setSaved(false)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const { data: { session } } = await sb.auth.getSession()
      await sb.from('documents').update({
        title: newTitle,
        content: newContent,
        sprint_id: sprintId || null,
        milestone_id: milestoneId || null,
        updated_by: session?.user.id,
        updated_at: new Date().toISOString(),
      }).eq('id', docId)
      setSaving(false)
      setSaved(true)
    }, 1500)
  }, [docId, canEdit])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    autoSave(val, content, selectedSprintId, selectedMilestoneId)
  }

  const handleContentChange = (val: any) => {
    setContent(val)
    autoSave(title, val, selectedSprintId, selectedMilestoneId)
  }

  const handleSprintChange = (val: string) => {
    setSelectedSprintId(val)
    autoSave(title, content, val, selectedMilestoneId)
  }

  const handleMilestoneChange = (val: string) => {
    setSelectedMilestoneId(val)
    autoSave(title, content, selectedSprintId, val)
  }

  // Save version manually
  const saveVersion = async () => {
    const { data: { session } } = await sb.auth.getSession()
    await sb.from('document_versions').insert({
      document_id: docId,
      title,
      content,
      saved_by: session?.user.id,
    })
    loadVersions()
  }

  const loadVersions = async () => {
    const { data } = await sb.from('document_versions').select('*').eq('document_id', docId).order('created_at', { ascending: false })
    setVersions(data || [])
  }

  const restoreVersion = async (version: any) => {
    if (!confirm('Restore this version? Current content will be replaced.')) return
    setTitle(version.title)
    setContent(version.content)
    await sb.from('documents').update({ title: version.title, content: version.content, updated_at: new Date().toISOString() }).eq('id', docId)
    setShowVersions(false)
    setSaved(true)
  }

  // Handle highlight comment
  const handleHighlightComment = (text: string, from: number, to: number) => {
    setPendingComment({ text, from, to })
    setCommentText('')
    setShowCommentModal(true)
  }

  const submitComment = async () => {
    if (!pendingComment || !commentText.trim()) return
    const { data: { session } } = await sb.auth.getSession()
    const { data: newComment } = await sb.from('document_comments').insert({
      document_id: docId,
      comment_text: commentText.trim(),
      highlighted_text: pendingComment.text,
      position_from: pendingComment.from,
      position_to: pendingComment.to,
      created_by: session?.user.id,
    }).select().single()
    if (newComment) setComments(p => [...p, newComment])
    setShowCommentModal(false)
    setPendingComment(null)
  }

  const resolveComment = async (commentId: string) => {
    await sb.from('document_comments').update({ resolved: true }).eq('id', commentId)
    setComments(p => p.map(c => c.id === commentId ? { ...c, resolved: true } : c))
  }

  const openComments = !comments.filter(c => !c.resolved).length === false

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading…</div>
  )

  const selStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 10px', fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.push(`/dashboard/docs/${projectId}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit', padding: 0 }}>
          ← Docs
        </button>
        <span style={{ color: '#e5e7eb' }}>|</span>

        {/* Save status */}
        <span style={{ fontSize: 12, color: saving ? '#d97706' : saved ? '#16a34a' : '#9ca3af' }}>
          {saving ? '⏳ Saving…' : saved ? '✓ Saved' : '• Unsaved'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {canEdit && (
            <button onClick={saveVersion} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 12px', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
              📌 Save version
            </button>
          )}
          <button onClick={() => { setShowVersions(true); loadVersions() }}
            style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 12px', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
            🕐 History
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Main editor area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          {/* Title */}
          {canEdit ? (
            <input value={title} onChange={e => handleTitleChange(e.target.value)}
              placeholder="Document title"
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: 28, fontWeight: 700, marginBottom: 20, fontFamily: 'inherit', background: 'transparent', color: '#111' }} />
          ) : (
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 20, color: '#111' }}>{title}</h1>
          )}

          {/* Metadata row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>🏃 Sprint</span>
              {canEdit ? (
                <select value={selectedSprintId} onChange={e => handleSprintChange(e.target.value)} style={selStyle}>
                  <option value="">None</option>
                  {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: 12, color: '#374151' }}>{sprints.find(s => s.id === selectedSprintId)?.name || '—'}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>🎯 Milestone</span>
              {canEdit ? (
                <select value={selectedMilestoneId} onChange={e => handleMilestoneChange(e.target.value)} style={selStyle}>
                  <option value="">None</option>
                  {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: 12, color: '#374151' }}>{milestones.find(m => m.id === selectedMilestoneId)?.name || '—'}</span>
              )}
            </div>
          </div>

          {/* Editor */}
          <RichEditor
            content={content}
            onChange={handleContentChange}
            onHighlightComment={canEdit ? handleHighlightComment : undefined}
            editable={canEdit}
            placeholder="Start writing your document… Select text to highlight and add a comment."
          />
        </div>

        {/* Comments sidebar */}
        {comments.filter(c => !c.resolved).length > 0 && (
          <div style={{ width: 280, borderLeft: '1px solid #e5e7eb', background: '#fafafa', overflowY: 'auto', padding: 16, flexShrink: 0 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>💬 Comments ({comments.filter(c => !c.resolved).length})</p>
            {comments.filter(c => !c.resolved).map(comment => (
              <div key={comment.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ background: '#fef9c3', borderRadius: 4, padding: '3px 8px', fontSize: 12, color: '#92400e', marginBottom: 8, fontStyle: 'italic' }}>
                  "{comment.highlighted_text}"
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151' }}>{comment.comment_text}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(comment.created_at).toLocaleDateString()}</span>
                  {canEdit && (
                    <button onClick={() => resolveComment(comment.id)}
                      style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 5, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#6b7280' }}>
                      ✓ Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comment modal */}
      {showCommentModal && pendingComment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Add comment</h3>
            <div style={{ background: '#fef9c3', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#92400e', marginBottom: 12, fontStyle: 'italic' }}>
              "{pendingComment.text}"
            </div>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Write your comment…" rows={3} autoFocus
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => { setShowCommentModal(false); setPendingComment(null) }}
                style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitComment} disabled={!commentText.trim()}
                style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: commentText.trim() ? 'pointer' : 'not-allowed', opacity: commentText.trim() ? 1 : 0.5 }}>
                Add comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version history panel */}
      {showVersions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>🕐 Version History</h3>
              <button onClick={() => setShowVersions(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {versions.length === 0 && (
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
                  No saved versions yet. Click "Save version" to create a snapshot.
                </p>
              )}
              {versions.map((v, i) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < versions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500 }}>{v.title}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{new Date(v.created_at).toLocaleString()}</p>
                  </div>
                  {canEdit && (
                    <button onClick={() => restoreVersion(v)}
                      style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
