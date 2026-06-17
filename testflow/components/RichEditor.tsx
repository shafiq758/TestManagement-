'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { useRef, useState, useCallback, useEffect } from 'react'
import { uploadFile } from '@/lib/uploadFile'

interface Member { id: string; email: string; name?: string }

interface RichEditorProps {
  content: any
  onChange: (content: any) => void
  onHighlightComment?: (text: string, from: number, to: number) => void
  editable?: boolean
  canComment?: boolean
  placeholder?: string
  members?: Member[]
}

export default function RichEditor({ content, onChange, onHighlightComment, editable = true, canComment = false, placeholder = 'Start writing…', members = [] }: RichEditorProps) {
  const [uploading, setUploading] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [mentionPopup, setMentionPopup] = useState<{query: string; x: number; y: number} | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const membersRef = useRef<Member[]>([])

  // Keep membersRef always current — direct assignment during render
  membersRef.current = members

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || '',
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      setHasSelection(from !== to && editor.state.doc.textBetween(from, to).trim().length > 0)
    },
  })

  // Detect @mention using editor update event
  useEffect(() => {
    if (!editor || !editable) return
    const check = () => {
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from)
      const match = textBefore.match(/@(\w*)$/)
      // Use window fallback if membersRef is empty (dynamic import timing issue)
      const availableMembers = membersRef.current.length > 0
        ? membersRef.current
        : (typeof window !== 'undefined' ? (window as any).__testflow_members || [] : [])
      if (match && availableMembers.length > 0) {
        membersRef.current = availableMembers // sync ref
        try {
          const coords = editor.view.coordsAtPos(from)
          setMentionPopup({ query: match[1], x: coords.left, y: coords.bottom + 4 })
          setMentionIndex(0)
        } catch { setMentionPopup(null) }
      } else {
        setMentionPopup(null)
      }
    }
    editor.on('update', check)
    return () => { editor.off('update', check) }
  }, [editor, editable])

  const currentMembers = membersRef.current.length > 0
    ? membersRef.current
    : (typeof window !== 'undefined' ? (window as any).__testflow_members || [] : [])

  const filteredMembers = mentionPopup
    ? (currentMembers as Member[]).filter((m: Member) => {
        const q = mentionPopup.query.toLowerCase()
        return !q || (m.name || '').toLowerCase().startsWith(q) || m.email.toLowerCase().startsWith(q)
      }).slice(0, 6)
    : []

  const insertMention = (member: Member) => {
    if (!editor) return
    const { from } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from)
    const match = textBefore.match(/@(\w*)$/)
    if (!match) return
    const deleteFrom = from - match[0].length
    const displayName = member.name || member.email.split('@')[0]
    editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).insertContent(`@${displayName} `).run()
    setMentionPopup(null)
  }

  const addImage = useCallback(async (file: File) => {
    if (!editor) return
    setUploading(true)
    try {
      const result = await uploadFile(file, 'docs')
      editor.chain().focus().setImage({ src: result.url, alt: file.name }).run()
    } catch (e) { console.error('Image upload failed:', e) }
    setUploading(false)
  }, [editor])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await addImage(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) await addImage(file)
  }

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) await addImage(file)
    }
  }, [addImage])

  const handleComment = () => {
    if (!editor || !onHighlightComment) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to).trim()
    if (text) onHighlightComment(text, from, to)
  }

  if (!editor) return null

  const btn = (active: boolean): React.CSSProperties => ({
    background: active ? '#111' : 'none',
    color: active ? '#fff' : '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: 5,
    padding: '4px 8px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    fontFamily: 'inherit',
  })

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff', position: 'relative' }}>
      {/* Toolbar */}
      {editable && (
        <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center', background: '#fafafa' }}>
          <button onClick={() => editor.chain().focus().toggleBold().run()} style={btn(editor.isActive('bold'))}><b>B</b></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} style={btn(editor.isActive('italic'))}><i>I</i></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} style={btn(editor.isActive('underline'))}><u>U</u></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} style={btn(editor.isActive('strike'))}><s>S</s></button>
          <button onClick={() => editor.chain().focus().toggleHighlight().run()} style={btn(editor.isActive('highlight'))}>🖊</button>
          <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />
          {([1,2,3] as const).map(level => (
            <button key={level} onClick={() => editor.chain().focus().toggleHeading({ level }).run()} style={btn(editor.isActive('heading', { level }))}>H{level}</button>
          ))}
          <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={btn(editor.isActive('bulletList'))}>• List</button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btn(editor.isActive('orderedList'))}>1. List</button>
          <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={btn(editor.isActive('codeBlock'))}>{'</>'}</button>
          <button onClick={() => editor.chain().focus().toggleBlockquote().run()} style={btn(editor.isActive('blockquote'))}>❝</button>
          <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} style={btn(editor.isActive({ textAlign: 'left' }))}>←</button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} style={btn(editor.isActive({ textAlign: 'center' }))}>↔</button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} style={btn(editor.isActive({ textAlign: 'right' }))}>→</button>
          <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} style={btn(false)} disabled={uploading}>{uploading ? '⏳' : '🖼 Image'}</button>
          <button onClick={() => editor.chain().focus().setHorizontalRule().run()} style={btn(false)}>─</button>
          {canComment && onHighlightComment && hasSelection && (
            <button onClick={handleComment} style={{ ...btn(false), background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', marginLeft: 8 }}>
              💬 Comment
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} style={{ ...btn(false), opacity: editor.can().undo() ? 1 : 0.4 }}>↩</button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} style={{ ...btn(false), opacity: editor.can().redo() ? 1 : 0.4 }}>↪</button>
          </div>
        </div>
      )}

      {/* Comment bar for read-only users */}
      {!editable && canComment && onHighlightComment && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#eff6ff' }}>
          <span style={{ fontSize: 12, color: '#2563eb' }}>💬 Select text then click Comment to add</span>
          {hasSelection && (
            <button onClick={handleComment} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
              + Comment
            </button>
          )}
        </div>
      )}

      {/* Editor content */}
      <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onPaste={handlePaste} style={{ minHeight: 400, padding: '20px 24px' }}>
        <EditorContent editor={editor} />
      </div>

      {/* @mention popup */}
      {mentionPopup && filteredMembers.length > 0 && (
        <div style={{
          position: 'fixed', left: mentionPopup.x, top: mentionPopup.y,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 9999, minWidth: 200, overflow: 'hidden',
        }}>
          <div style={{ padding: '5px 10px 4px', fontSize: 10, color: '#9ca3af', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>MENTION</div>
          {filteredMembers.map((member, i) => (
            <div key={member.id} onMouseDown={e => { e.preventDefault(); insertMention(member) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: i === mentionIndex ? '#eff6ff' : '#fff' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                {(member.name || member.email)[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 13 }}>{member.name || member.email.split('@')[0]}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .ProseMirror { outline: none; font-size: 14px; line-height: 1.7; color: #111; }
        .ProseMirror h1 { font-size: 24px; font-weight: 700; margin: 20px 0 8px; }
        .ProseMirror h2 { font-size: 20px; font-weight: 600; margin: 16px 0 6px; }
        .ProseMirror h3 { font-size: 16px; font-weight: 600; margin: 12px 0 4px; }
        .ProseMirror p { margin: 0 0 8px; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 24px; margin: 0 0 8px; }
        .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 16px; color: #6b7280; margin: 8px 0; }
        .ProseMirror code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; }
        .ProseMirror pre { background: #1e1e2e; color: #cdd6f4; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
        .ProseMirror pre code { background: none; color: inherit; padding: 0; }
        .ProseMirror img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
        .ProseMirror hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
        .ProseMirror mark { background: #fef9c3; border-radius: 2px; padding: 1px 0; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; float: left; height: 0; }
        .ProseMirror a { color: #2563eb; text-decoration: underline; }
        .ProseMirror ::selection { background: #bfdbfe; }
      `}</style>
    </div>
  )
}
