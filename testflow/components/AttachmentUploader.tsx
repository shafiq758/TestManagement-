'use client'
import { useState, useRef, useEffect } from 'react'
import { uploadFile, validateFile } from '@/lib/uploadFile'

export interface Attachment {
  url: string
  name: string
  type: 'image' | 'video'
}

export default function AttachmentUploader({
  attachments,
  onChange,
  folder = 'bugs',
  maxFiles = 10,
}: {
  attachments: Attachment[]
  onChange: (attachments: Attachment[]) => void
  folder?: string
  maxFiles?: number
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Paste support
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imageItems = items.filter(i => i.type.startsWith('image/'))
      if (imageItems.length === 0) return
      e.preventDefault()
      const files = imageItems.map(i => i.getAsFile()).filter(Boolean) as File[]
      await handleFiles(files)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [attachments])

  const handleFiles = async (files: File[]) => {
    setError('')
    if (attachments.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`); return
    }
    for (const f of files) {
      const err = validateFile(f)
      if (err) { setError(err); return }
    }
    setUploading(true)
    try {
      const results = await Promise.all(files.map(f => uploadFile(f, folder)))
      onChange([...attachments, ...results])
    } catch (e: any) {
      setError(e.message)
    }
    setUploading(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    await handleFiles(files)
  }

  const removeAttachment = (index: number) => {
    onChange(attachments.filter((_, i) => i !== index))
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#111' : '#d1d5db'}`,
          borderRadius: 8, padding: '20px 16px', textAlign: 'center',
          cursor: 'pointer', background: dragOver ? '#f9fafb' : '#fff',
          transition: 'all 0.15s', marginBottom: 10,
        }}
      >
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={e => handleFiles(Array.from(e.target.files || []))} />
        {uploading ? (
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Uploading…</p>
        ) : (
          <>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#374151', fontWeight: 500 }}>
              📎 Drop files, click to browse, or paste (Ctrl+V)
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
              Images (JPG, PNG, GIF, WebP) · Videos (MP4, WebM, MOV) · Max 25MB each
            </p>
          </>
        )}
      </div>

      {error && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#dc2626' }}>{error}</p>
      )}

      {/* Preview grid */}
      {attachments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {attachments.map((att, i) => (
            <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#f9fafb' }}>
              {att.type === 'image' ? (
                <img src={att.url} alt={att.name}
                  style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 24 }}>🎬</span>
                  <span style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{att.name}</span>
                </div>
              )}
              <button onClick={(e) => { e.stopPropagation(); removeAttachment(i) }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
