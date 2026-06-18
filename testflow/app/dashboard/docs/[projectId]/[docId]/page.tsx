'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { canEditCases } from '@/lib/roles'
import type { WorkspaceRole } from '@/types'
import dynamic from 'next/dynamic'
import MentionInput from '@/components/MentionInput'

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
  const [docType, setDocType] = useState<'plain' | 'prd'>('plain')
  const [prdMeta, setPrdMeta] = useState({ category: '', status: 'Draft', authorName: '', createdAt: '', updatedAt: '' })
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
  const [previewVersion, setPreviewVersion] = useState<any | null>(null)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [visibility, setVisibility] = useState<'private' | 'team'>('private')
  const [commentAccess, setCommentAccess] = useState<'all' | 'editors' | 'none'>('all')
  const [published, setPublished] = useState(false)
  const [isAuthor, setIsAuthor] = useState(false)
  const [userId, setUserId] = useState('')
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [pendingComment, setPendingComment] = useState<{text: string; from: number; to: number} | null>(null)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [replies, setReplies] = useState<Record<string, any[]>>({})
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [showReplyInput, setShowReplyInput] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sb = createClient()

  useEffect(() => { load() }, [docId])

  const load = async () => {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.replace('/auth'); return }

    const [{ data: docData }, { data: sprs }, { data: mils }, { data: projData }, { data: comms }, { data: membersData }] = await Promise.all([
      sb.from('documents').select('*').eq('id', docId).single(),
      sb.from('sprints').select('*').eq('project_id', projectId),
      sb.from('milestones').select('*').eq('project_id', projectId),
      sb.from('projects').select('workspace_id').eq('id', projectId).single(),
      sb.from('document_comments').select('*').eq('document_id', docId).order('created_at'),
      sb.from('workspace_members').select('user_id, role, invited_email, display_name').eq('workspace_id', (await sb.from('projects').select('workspace_id').eq('id', projectId).single()).data?.workspace_id || ''),
    ])

    if (!docData) { router.push(`/dashboard/docs/${projectId}`); return }

    const uid = session.user.id
    setUserId(uid)
    setDoc(docData)
    setDocType(docData.doc_type || 'plain')
    // Get author display name
    let authorName = docData.prd_author || ''
    if (!authorName) {
      if (docData.created_by === session.user.id) {
        // Current user is author - use their metadata
        authorName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Unknown'
        // Save it for future viewers
        await sb.from('documents').update({ prd_author: authorName }).eq('id', docData.id)
      } else {
        // Look up author from members list using display_name
        const authorMember = (membersData || []).find((m: any) => m.user_id === docData.created_by)
        authorName = authorMember?.display_name || authorMember?.invited_email || 'Unknown'
      }
    }
    setPrdMeta({
      category: docData.prd_category || '',
      status: docData.prd_status || 'Draft',
      authorName,
      createdAt: docData.created_at ? new Date(docData.created_at).toLocaleString() : '',
      updatedAt: docData.updated_at ? new Date(docData.updated_at).toLocaleString() : '',
    })
    setTitle(docData.title)
    setContent(docData.content || {})
    setSelectedSprintId(docData.sprint_id || '')
    setSelectedMilestoneId(docData.milestone_id || '')
    setVisibility(docData.visibility || 'private')
    setCommentAccess(docData.comment_access || 'all')
    setPublished(docData.published || false)
    setIsAuthor(docData.created_by === uid)
    setSprints(sprs || [])
    setMilestones(mils || [])
    // Get correct role for this workspace
    const workspaceId = projData?.workspace_id
    let memberRole: WorkspaceRole = 'viewer'
    if (workspaceId) {
      const { data: memberData } = await sb.from('workspace_members')
        .select('role').eq('user_id', session.user.id).eq('workspace_id', workspaceId).single()
      memberRole = (memberData?.role || 'viewer') as WorkspaceRole
    }
    setMyRole(memberRole)
    const mappedMembers = (membersData || []).map((m: any) => ({ id: m.user_id, email: m.invited_email, name: m.invited_email?.split('@')[0] }))
    setMembers(mappedMembers)
    // Store in window so dynamic RichEditor can always access latest members
    if (typeof window !== 'undefined') {
      (window as any).__testflow_members = mappedMembers
    }
    const commsData = comms || []
    setComments(commsData)
    // Load replies for all comments
    if (commsData.length > 0) {
      const { data: repliesData } = await sb.from('document_comment_replies')
        .select('*').in('comment_id', commsData.map((c: any) => c.id)).order('created_at')
      const repliesMap: Record<string, any[]> = {}
      ;(repliesData || []).forEach((r: any) => {
        if (!repliesMap[r.comment_id]) repliesMap[r.comment_id] = []
        repliesMap[r.comment_id].push(r)
      })
      setReplies(repliesMap)
    }
    setLoading(false)
    // Debug — remove after fixing
    console.log('DOC DEBUG:', {
      published: docData.published,
      visibility: docData.visibility,
      comment_access: docData.comment_access,
      created_by: docData.created_by,
      uid: session.user.id,
      isAuthor: docData.created_by === session.user.id,
      memberRole,
      workspaceId: projData?.workspace_id,
    })
  }

  const canEdit = isAuthor // only author can edit content
  const canDelete = isAuthor || myRole === 'admin' // author or admin can delete
  const canComment = (() => {
    if (isAuthor) return true // author always can comment
    if (!published) return false // non-authors can't comment on unpublished docs
    if (commentAccess === 'none') return false
    if (commentAccess === 'editors') return myRole === 'admin' || myRole === 'editor'
    return myRole !== 'viewer' // 'all' — editors and testers can comment, viewers cannot
  })()

  // Auto-save with debounce
  const autoSavePrdMeta = useCallback(async (meta: typeof prdMeta) => {
    await sb.from('documents').update({
      prd_category: meta.category,
      prd_status: meta.status,
      updated_at: new Date().toISOString(),
    }).eq('id', docId)
  }, [docId])

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
  const publishDoc = async (vis: string, ca: string, pub: boolean) => {
    const { data: { session } } = await sb.auth.getSession()
    // Save author display name at publish time so others can see it
    const authorDisplayName = session?.user.user_metadata?.name || session?.user.email?.split('@')[0] || 'Unknown'
    await sb.from('documents').update({
      visibility: vis,
      comment_access: ca,
      published: pub,
      prd_author: authorDisplayName,
      updated_at: new Date().toISOString(),
    }).eq('id', docId)
    setPrdMeta(p => ({ ...p, authorName: authorDisplayName }))
    setVisibility(vis as any)
    setCommentAccess(ca as any)
    setPublished(pub)
    setShowPublishModal(false)
  }

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
    setPendingComment({ text: text || '(General comment)', from, to })
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

  const submitReply = async (commentId: string) => {
    const text = replyText[commentId]?.trim()
    if (!text) return
    const { data: { session } } = await sb.auth.getSession()
    const { data: newReply } = await sb.from('document_comment_replies').insert({
      comment_id: commentId,
      reply_text: text,
      created_by: session?.user.id,
    }).select().single()
    if (newReply) {
      setReplies(p => ({ ...p, [commentId]: [...(p[commentId] || []), newReply] }))
      setReplyText(p => ({ ...p, [commentId]: '' }))
      setShowReplyInput(p => ({ ...p, [commentId]: false }))
    }
  }

  const resolveComment = async (commentId: string) => {
    await sb.from('document_comments').update({ resolved: true }).eq('id', commentId)
    setComments(p => p.map(c => c.id === commentId ? { ...c, resolved: true } : c))
  }

  const openComments = !comments.filter(c => !c.resolved).length === false

  // Access control - redirect if unpublished and not author
  if (!loading && doc && !doc.published && !isAuthor) {
    router.push(`/dashboard/docs/${projectId}`)
    return null
  }

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
        {docType === 'prd' && (
          <span style={{ fontSize: 11, background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>📋 PRD</span>
        )}
        <span style={{ color: '#e5e7eb' }}>|</span>

        {/* Save status */}
        <span style={{ fontSize: 12, color: saving ? '#d97706' : saved ? '#16a34a' : '#9ca3af' }}>
          {saving ? '⏳ Saving…' : saved ? '✓ Saved' : '• Unsaved'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {isAuthor && (
            <>
              <button onClick={saveVersion} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 12px', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
                📌 Save version
              </button>
              <button onClick={() => setShowPublishModal(true)}
                style={{ border: `1px solid ${published ? '#16a34a' : '#d1d5db'}`, borderRadius: 7, padding: '6px 12px', fontSize: 12, background: published ? '#f0fdf4' : '#fff', color: published ? '#16a34a' : '#374151', cursor: 'pointer', fontWeight: published ? 600 : 400 }}>
                {published ? '✓ Published' : '🌐 Publish'}
              </button>
            </>
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

          {/* PRD Metadata Table */}
          {docType === 'prd' && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {[
                    { label: 'Created by', value: prdMeta.authorName || 'Unknown', editable: false, icon: '👤' },
                    { label: 'Created time', value: prdMeta.createdAt, editable: false, icon: '🕐' },
                    { label: 'Category', value: prdMeta.category, editable: true, field: 'category', icon: '📂' },
                    { label: 'Last updated', value: prdMeta.updatedAt, editable: false, icon: '✏️' },
                    { label: 'Status', value: prdMeta.status, editable: true, field: 'status', icon: '🔄', isStatus: true },
                  ].map((row, i) => (
                    <tr key={row.label} style={{ borderBottom: i < 4 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '8px 14px', background: '#fafafa', color: '#6b7280', fontSize: 12, width: 140, borderRight: '1px solid #e5e7eb' }}>
                        <span style={{ marginRight: 6 }}>{row.icon}</span>{row.label}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        {row.isStatus && canEdit ? (
                          <select value={prdMeta.status} onChange={e => { setPrdMeta(p => ({ ...p, status: e.target.value })); autoSavePrdMeta({ ...prdMeta, status: e.target.value }) }}
                            style={{ border: 'none', outline: 'none', fontSize: 13, cursor: 'pointer', background: 'transparent', fontFamily: 'inherit' }}>
                            {['Draft', 'In Progress', 'Review', 'Approved', 'Deprecated'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : row.isStatus ? (
                          <span style={{ background: prdMeta.status === 'Approved' ? '#dcfce7' : prdMeta.status === 'In Progress' ? '#eff6ff' : prdMeta.status === 'Review' ? '#fef9c3' : '#f3f4f6', color: prdMeta.status === 'Approved' ? '#15803d' : prdMeta.status === 'In Progress' ? '#2563eb' : prdMeta.status === 'Review' ? '#ca8a04' : '#374151', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>{prdMeta.status}</span>
                        ) : row.editable && canEdit ? (
                          <input value={prdMeta[row.field as keyof typeof prdMeta]} onChange={e => { setPrdMeta(p => ({ ...p, [row.field!]: e.target.value })); autoSavePrdMeta({ ...prdMeta, [row.field!]: e.target.value }) }}
                            placeholder={`Add ${row.label.toLowerCase()}…`}
                            style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', fontFamily: 'inherit', background: 'transparent' }} />
                        ) : (
                          <span style={{ color: row.value ? '#111' : '#9ca3af' }}>{row.value || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sprint/Milestone Metadata row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
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
            {/* Comment access indicator */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {canComment ? (
                <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                  💬 Comments enabled (role: {myRole})
                </span>
              ) : (
                <span style={{ fontSize: 11, background: '#f3f4f6', color: '#9ca3af', padding: '2px 8px', borderRadius: 4 }}>
                  {!published && !isAuthor ? '🔒 Not published' : commentAccess === 'none' ? '💬 Comments off' : '👁 View only'}
                </span>
              )}
            </div>
          </div>

          {/* Comment bar for non-editors who can comment */}
          {canComment && !canEdit && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#2563eb' }}>💬 You can comment on this document</span>
              <button onClick={() => {
                setPendingComment({ text: '(General comment)', from: 0, to: 0 })
                setCommentText('')
                setShowCommentModal(true)
              }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                + Add comment
              </button>
            </div>
          )}

          {/* Editor */}
          <RichEditor
            key={`editor-${canComment}-${canEdit}`}
            content={content}
            onChange={handleContentChange}
            onHighlightComment={canComment ? handleHighlightComment : undefined}
            editable={canEdit}
            canComment={canComment}
            placeholder="Start writing your document…"
          />
        </div>

        {/* Comments sidebar */}
        {comments.filter(c => !c.resolved).length > 0 && (
          <div style={{ width: 280, borderLeft: '1px solid #e5e7eb', background: '#fafafa', overflowY: 'auto', padding: 16, flexShrink: 0 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>💬 Comments ({comments.filter(c => !c.resolved).length})</p>
            {comments.filter(c => !c.resolved).map(comment => (
              <div key={comment.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                {comment.highlighted_text && comment.highlighted_text !== '(General comment)' && (
                  <div style={{ background: '#fef9c3', borderRadius: 4, padding: '3px 8px', fontSize: 12, color: '#92400e', marginBottom: 8, fontStyle: 'italic' }}>
                    "{comment.highlighted_text}"
                  </div>
                )}
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151' }}>{comment.comment_text}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(comment.created_at).toLocaleDateString()}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {canComment && (
                      <button onClick={() => setShowReplyInput(p => ({ ...p, [comment.id]: !p[comment.id] }))}
                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 5, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#6b7280' }}>
                        ↩ Reply
                      </button>
                    )}
                    {isAuthor && (
                      <button onClick={() => resolveComment(comment.id)}
                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 5, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#6b7280' }}>
                        ✓ Resolve
                      </button>
                    )}
                  </div>
                </div>
                {/* Replies */}
                {(replies[comment.id] || []).map((reply: any) => (
                  <div key={reply.id} style={{ marginLeft: 12, paddingLeft: 10, borderLeft: '2px solid #e5e7eb', marginBottom: 6 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: '#374151' }}>{reply.reply_text}</p>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(reply.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
                {/* Reply input */}
                {showReplyInput[comment.id] && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <MentionInput
                        value={replyText[comment.id] || ''}
                        onChange={val => setReplyText(p => ({ ...p, [comment.id]: val }))}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitReply(comment.id)}
                        members={members}
                        placeholder="Reply… @ to mention"
                        rows={1}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setShowReplyInput(p => ({ ...p, [comment.id]: false })); setReplyText(p => ({ ...p, [comment.id]: '' })) }}
                        style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#6b7280' }}>
                        Cancel
                      </button>
                      <button onClick={() => submitReply(comment.id)}
                        style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
                        Send
                      </button>
                    </div>
                  </div>
                )}
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
            <MentionInput
              value={commentText}
              onChange={setCommentText}
              members={members}
              placeholder="Write your comment… type @ to mention someone"
              rows={3}
              style={{ resize: 'vertical' }}
            />
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

      {/* Publish modal */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>🌐 Publish document</h3>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500, color: '#374151' }}>Who can see this document?</p>
              {[
                { value: 'private', label: 'Private', desc: 'Only you can see it', icon: '🔒' },
                { value: 'team', label: 'Team', desc: 'All workspace members can view', icon: '👥' },
              ].map(opt => (
                <div key={opt.value} onClick={() => setVisibility(opt.value as any)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${visibility === opt.value ? '#2563eb' : '#e5e7eb'}`, background: visibility === opt.value ? '#eff6ff' : '#fff', cursor: 'pointer', marginBottom: 8 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${visibility === opt.value ? '#2563eb' : '#d1d5db'}`, background: visibility === opt.value ? '#2563eb' : '#fff', flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500 }}>{opt.icon} {opt.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500, color: '#374151' }}>Who can comment?</p>
              {[
                { value: 'all', label: 'All members', desc: 'Anyone with access can comment' },
                { value: 'editors', label: 'Editors only', desc: 'Only admins and editors' },
                { value: 'none', label: 'No comments', desc: 'Disable comments on this doc' },
              ].map(opt => (
                <div key={opt.value} onClick={() => setCommentAccess(opt.value as any)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderRadius: 8, border: `1px solid ${commentAccess === opt.value ? '#2563eb' : '#e5e7eb'}`, background: commentAccess === opt.value ? '#eff6ff' : '#fff', cursor: 'pointer', marginBottom: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${commentAccess === opt.value ? '#2563eb' : '#d1d5db'}`, background: commentAccess === opt.value ? '#2563eb' : '#fff', flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 500 }}>{opt.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{opt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPublishModal(false)} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => publishDoc(visibility, commentAccess, true)}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                ✓ Publish
              </button>
              {published && (
                <button onClick={() => publishDoc('private', commentAccess, false)}
                  style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Unpublish
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version preview modal */}
      {previewVersion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600 }}>{previewVersion.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>Saved {new Date(previewVersion.created_at).toLocaleString()}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAuthor && (
                  <button onClick={() => { restoreVersion(previewVersion); setPreviewVersion(null) }}
                    style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
                    Restore this version
                  </button>
                )}
                <button onClick={() => setPreviewVersion(null)} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>{previewVersion.title}</h1>
              {/* Render content using read-only editor */}
              <VersionPreview content={previewVersion.content} />
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
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPreviewVersion(v)}
                      style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
                      Preview
                    </button>
                    {isAuthor && (
                      <button onClick={() => restoreVersion(v)}
                        style={{ border: '1px solid #111', borderRadius: 6, padding: '5px 12px', fontSize: 12, background: '#fff', cursor: 'pointer' }}>
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Version Preview Component ─────────────────────────────────────────────
function VersionPreview({ content }: { content: any }) {
  if (!content || Object.keys(content).length === 0) {
    return <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Empty document</p>
  }

  const renderNode = (node: any): React.ReactNode => {
    if (!node) return null

    const children = node.content?.map((child: any, i: number) => (
      <span key={i}>{renderNode(child)}</span>
    ))

    const marks = node.marks || []
    let text: React.ReactNode = node.text || children

    marks.forEach((mark: any) => {
      if (mark.type === 'bold') text = <strong>{text}</strong>
      if (mark.type === 'italic') text = <em>{text}</em>
      if (mark.type === 'underline') text = <u>{text}</u>
      if (mark.type === 'strike') text = <s>{text}</s>
      if (mark.type === 'highlight') text = <mark style={{ background: '#fef9c3', padding: '1px 0' }}>{text}</mark>
      if (mark.type === 'code') text = <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: 13 }}>{text}</code>
    })

    switch (node.type) {
      case 'doc': return <div>{children}</div>
      case 'paragraph': return <p style={{ margin: '0 0 8px', textAlign: node.attrs?.textAlign || 'left' }}>{children || <br />}</p>
      case 'heading': {
        const level = node.attrs?.level || 1
        const sizes: Record<number, string> = { 1: '24px', 2: '20px', 3: '16px' }
        const weights: Record<number, number> = { 1: 700, 2: 600, 3: 600 }
        return <div style={{ fontSize: sizes[level] || '16px', fontWeight: weights[level] || 600, margin: '16px 0 6px' }}>{children}</div>
      }
      case 'bulletList': return <ul style={{ paddingLeft: 24, margin: '0 0 8px' }}>{children}</ul>
      case 'orderedList': return <ol style={{ paddingLeft: 24, margin: '0 0 8px' }}>{children}</ol>
      case 'listItem': return <li style={{ marginBottom: 2 }}>{children}</li>
      case 'blockquote': return <blockquote style={{ borderLeft: '3px solid #e5e7eb', paddingLeft: 16, color: '#6b7280', margin: '8px 0' }}>{children}</blockquote>
      case 'codeBlock': return <pre style={{ background: '#1e1e2e', color: '#cdd6f4', padding: 16, borderRadius: 8, overflow: 'auto', margin: '8px 0', fontSize: 13 }}><code>{children}</code></pre>
      case 'hardBreak': return <br />
      case 'horizontalRule': return <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
      case 'image': return <img src={node.attrs?.src} alt={node.attrs?.alt || ''} style={{ maxWidth: '100%', borderRadius: 8, margin: '8px 0' }} />
      case 'text': return text
      default: return <span>{children}</span>
    }
  }

  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: '#111' }}>
      {renderNode(content)}
    </div>
  )
}
