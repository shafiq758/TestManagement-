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
import { createPortal } from 'react-dom'
import { uploadFile } from '@/lib/uploadFile'

interface RichEditorProps {
  content: any
  onChange: (content: any) => void
  onHighlightComment?: (text: string, from: number, to: number) => void
  editable?: boolean
  canComment?: boolean
  placeholder?: string
}

export default function RichEditor({ content, onChange, onHighlightComment, editable = true, canComment = false, placeholder = 'Start writing your document…' }: RichEditorProps) {
  const [uploading, setUploading] = useState(false)
  const [selectionPopup, setSelectionPopup] = useState<{x: number; y: number; text: string; from: number; to: number} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  })

  const addImage = useCallback(async (file: File) => {
    if (!editor) return
    setUploading(true)
    try {
      const result = await uploadFile(file, 'docs')
      editor.chain().focus().setImage({ src: result.url, alt: file.name }).run()
    } catch (e) {
      console.error('Image upload failed:', e)
    }
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

  // Show popup on text selection
  useEffect(() => {
    if (!editor) return
    const handleMouseUp = () => {
      if (!onHighlightComment) return // only track selection if comment is possible
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) { setSelectionPopup(null); return }
      const text = selection.toString().trim()
      if (!text) { setSelectionPopup(null); return }
      const { from, to } = editor.state.selection
      if (from === to) { setSelectionPopup(null); return }
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectionPopup({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        text, from, to
      })
    }
    const handleMouseDown = () => setSelectionPopup(null)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [editor])

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
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      {/* Toolbar */}
      {editable && (
        <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center', background: '#fafafa' }}>
          {/* Text style */}
          <button onClick={() => editor.chain().focus().toggleBold().run()} style={btn(editor.isActive('bold'))}><b>B</b></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} style={btn(editor.isActive('italic'))}><i>I</i></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} style={btn(editor.isActive('underline'))}><u>U</u></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} style={btn(editor.isActive('strike'))}><s>S</s></button>
          <button onClick={() => editor.chain().focus().toggleHighlight().run()} style={btn(editor.isActive('highlight'))}>🖊</button>

          <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />

          {/* Headings */}
          {([1,2,3] as const).map(level => (
            <button key={level} onClick={() => editor.chain().focus().toggleHeading({ level }).run()} style={btn(editor.isActive('heading', { level }))}>H{level}</button>
          ))}

          <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />

          {/* Lists */}
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={btn(editor.isActive('bulletList'))}>• List</button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btn(editor.isActive('orderedList'))}>1. List</button>
          <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={btn(editor.isActive('codeBlock'))}>{'</>'}</button>
          <button onClick={() => editor.chain().focus().toggleBlockquote().run()} style={btn(editor.isActive('blockquote'))}>❝</button>

          <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />

          {/* Alignment */}
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} style={btn(editor.isActive({ textAlign: 'left' }))}>←</button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} style={btn(editor.isActive({ textAlign: 'center' }))}>↔</button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} style={btn(editor.isActive({ textAlign: 'right' }))}>→</button>

          <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 4px' }} />

          {/* Image */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current?.click()} style={btn(false)} disabled={uploading}>
            {uploading ? '⏳' : '🖼 Image'}
          </button>

          {/* Horizontal rule */}
          <button onClick={() => editor.chain().focus().setHorizontalRule().run()} style={btn(false)}>─</button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} style={{ ...btn(false), opacity: editor.can().undo() ? 1 : 0.4 }}>↩</button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} style={{ ...btn(false), opacity: editor.can().redo() ? 1 : 0.4 }}>↪</button>
          </div>
        </div>
      )}



      {/* Editor content */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onPaste={handlePaste}
        style={{ minHeight: 400, padding: '20px 24px' }}
      >
        <EditorContent editor={editor} />
      </div>

      {selectionPopup && (editable || canComment) && typeof window !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          left: selectionPopup.x,
          top: selectionPopup.y,
          transform: 'translateX(-50%) translateY(-100%)',
          background: '#111',
          borderRadius: 8,
          padding: '4px 6px',
          display: 'flex',
          gap: 4,
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, padding: '2px 8px' }}>B</button>
          <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, padding: '2px 8px', fontStyle: 'italic' }}>I</button>
          <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight().run() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, padding: '2px 8px' }}>🖊</button>
          {onHighlightComment && (
            <button onMouseDown={e => {
              e.preventDefault()
              const { text, from, to } = selectionPopup
              setSelectionPopup(null)
              onHighlightComment(text, from, to)
            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 12, padding: '2px 8px', whiteSpace: 'nowrap', borderLeft: '1px solid #374151' }}>
              💬 Comment
            </button>
          )}
        </div>,
        document.body
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
      `}</style>
    </div>
  )
}

// fix-comment-v2