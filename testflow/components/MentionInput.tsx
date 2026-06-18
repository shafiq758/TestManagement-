'use client'
import { useState, useRef, useEffect } from 'react'

interface Member {
  id: string
  email: string
  name?: string
}

interface MentionInputProps {
  value: string
  onChange: (val: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  members: Member[]
  placeholder?: string
  rows?: number
  style?: React.CSSProperties
}

export default function MentionInput({ value, onChange, onKeyDown, members, placeholder, rows = 3, style }: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filteredMembers = members.filter(m => {
    if (!m || !m.email) return false
    const q = mentionQuery.toLowerCase()
    return (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
  }).slice(0, 6)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart

    // Check for @ trigger
    const textBeforeCursor = val.slice(0, cursor)
    const lastAt = textBeforeCursor.lastIndexOf('@')

    if (lastAt !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAt + 1)
      // Only show if no space after @
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionQuery(textAfterAt)
        setMentionStart(lastAt)
        setShowDropdown(true)
        setSelectedIndex(0)
      } else {
        setShowDropdown(false)
        setMentionStart(-1)
      }
    } else {
      setShowDropdown(false)
      setMentionStart(-1)
    }

    onChange(val)
  }

  const insertMention = (member: Member) => {
    if (mentionStart === -1) return
    const displayName = member.name || member.email.split('@')[0]
    const before = value.slice(0, mentionStart)
    const after = value.slice(textareaRef.current?.selectionStart || mentionStart + mentionQuery.length + 1)
    const newVal = `${before}@${displayName} ${after}`
    onChange(newVal)
    setShowDropdown(false)
    setMentionStart(-1)
    // Focus and set cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + displayName.length + 2
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filteredMembers.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[selectedIndex]); return }
      if (e.key === 'Escape') { setShowDropdown(false); return }
    }
    onKeyDown?.(e)
  }

  // Render highlighted text with mentions
  const renderHighlighted = () => {
    return value.replace(/@[\w.]+/g, match => `<mark>${match}</mark>`)
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          border: '1px solid #d1d5db',
          borderRadius: 7,
          padding: '8px 11px',
          fontSize: 13,
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          boxSizing: 'border-box' as const,
          ...style,
        }}
      />

      {/* Mention dropdown */}
      {showDropdown && filteredMembers.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
          zIndex: 1000,
          overflow: 'hidden',
          marginBottom: 4,
        }}>
          <div style={{ padding: '6px 10px 4px', fontSize: 11, color: '#9ca3af', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
            MENTION A MEMBER
          </div>
          {filteredMembers.map((member, i) => (
            <div key={member.id}
              onMouseDown={() => insertMention(member)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
                background: i === selectedIndex ? '#eff6ff' : '#fff',
              }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                {(member.name || member.email)[0].toUpperCase()}
              </div>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 500 }}>{member.name || member.email.split('@')[0]}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{member.email}</p>
              </div>
            </div>
          ))}
          {filteredMembers.length === 0 && mentionQuery && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af' }}>No members found</div>
          )}
        </div>
      )}
    </div>
  )
}
