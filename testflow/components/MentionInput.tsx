'use client'
import { useState, useRef, useEffect } from 'react'

interface Member { id: string; email: string; name?: string }

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  members?: Member[]
  placeholder?: string
  rows?: number
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export default function MentionInput({ value, onChange, members = [], placeholder, rows = 3, onKeyDown }: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 300 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Use window fallback if members prop is empty
  const allMembers = members.length > 0
    ? members
    : (typeof window !== 'undefined' ? (window as any).__testflow_members || [] : [])

  // Filter by display name first, then email
  const filteredMembers = allMembers.filter((m: Member) => {
    if (!m || (!m.name && !m.email)) return false
    const q = mentionQuery.toLowerCase()
    if (!q) return true
    const displayName = (m.name || '').toLowerCase()
    const emailPrefix = (m.email || '').split('@')[0].toLowerCase()
    return displayName.startsWith(q) || displayName.includes(q) || emailPrefix.startsWith(q)
  }).slice(0, 6)

  const getAtPosition = (text: string, cursorPos: number) => {
    const textBefore = text.slice(0, cursorPos)
    const match = textBefore.match(/@(\w*)$/)
    return match ? { query: match[1], atIndex: textBefore.lastIndexOf('@') } : null
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    const cursor = e.target.selectionStart || 0
    onChange(newVal)
    const atPos = getAtPosition(newVal, cursor)
    if (atPos) {
      setMentionQuery(atPos.query)
      setMentionIndex(0)
      // Calculate dropdown position
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect()
        setDropdownPos({ top: rect.top - 4, left: rect.left, width: rect.width })
      }
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
    }
  }

  const insertMention = (member: Member) => {
    if (!textareaRef.current) return
    const cursor = textareaRef.current.selectionStart || 0
    const atPos = getAtPosition(value, cursor)
    if (!atPos) return
    const displayName = member.name || member.email.split('@')[0]
    const before = value.slice(0, atPos.atIndex)
    const after = value.slice(cursor)
    const newVal = `${before}@${displayName} ${after}`
    onChange(newVal)
    setShowDropdown(false)
    // Restore focus
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = atPos.atIndex + displayName.length + 2
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursor, newCursor)
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMembers.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIndex]); return }
      if (e.key === 'Escape') { setShowDropdown(false); return }
    }
    onKeyDown?.(e)
  }

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', width: '100%', resize: 'vertical', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />

      {showDropdown && filteredMembers.length > 0 && (
        <div ref={dropdownRef} style={{
          position: 'fixed',
          left: dropdownPos.left,
          top: dropdownPos.top,
          transform: 'translateY(-100%)',
          width: dropdownPos.width,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '5px 10px 4px', fontSize: 10, color: '#9ca3af', fontWeight: 600, borderBottom: '1px solid #f3f4f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mention</div>
          {filteredMembers.map((member: Member, i: number) => (
            <div key={member.id} onMouseDown={e => { e.preventDefault(); insertMention(member) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: i === mentionIndex ? '#eff6ff' : '#fff' }}
              onMouseEnter={() => setMentionIndex(i)}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                {(member.name || member.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{member.name || member.email.split('@')[0]}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{member.email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
