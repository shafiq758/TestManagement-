'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'

const COLUMNS = [
  { key: 'section', label: 'Section', required: true },
  { key: 'title', label: 'Title', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'steps', label: 'Steps to Reproduce', required: false },
  { key: 'expected_result', label: 'Expected Result', required: false },
  { key: 'priority', label: 'Priority (high/medium/low)', required: false },
  { key: 'type', label: 'Type (functional/regression/smoke/integration)', required: false },
]

const SAMPLE_ROW = {
  Section: 'Authentication',
  Title: 'User can login with valid credentials',
  Description: 'Verify login functionality works correctly',
  'Steps to Reproduce': '1. Go to login page\n2. Enter valid email and password\n3. Click Sign In',
  'Expected Result': 'User is redirected to dashboard',
  'Priority (high/medium/low)': 'high',
  'Type (functional/regression/smoke/integration)': 'functional',
}

interface Props {
  projectId: string
  sections: any[]
  cases: any[]
  onRefresh: () => void
  onClose: () => void
}

export default function ImportExportModal({ projectId, sections, cases, onRefresh, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{created: number; errors: string[]} | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const sb = createClient()

  // ── EXPORT ─────────────────────────────────────────────────
  const handleExport = () => {
    const rows = cases.map(c => {
      const section = sections.find(s => s.id === c.section_id)
      return {
        Section: section?.name || '',
        Title: c.title,
        Description: c.description || '',
        'Steps to Reproduce': c.steps || '',
        'Expected Result': c.expected_result || '',
        'Priority (high/medium/low)': c.priority || 'medium',
        'Type (functional/regression/smoke/integration)': c.type || 'functional',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Test Cases')

    // Auto column width
    const colWidths = Object.keys(SAMPLE_ROW).map(k => ({ wch: Math.max(k.length, 20) }))
    ws['!cols'] = colWidths

    if (format === 'csv') {
      XLSX.writeFile(wb, 'test_cases.csv', { bookType: 'csv' })
    } else {
      XLSX.writeFile(wb, 'test_cases.xlsx')
    }
  }

  // ── DOWNLOAD SAMPLE ─────────────────────────────────────────
  const handleDownloadSample = () => {
    const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Test Cases')
    const colWidths = Object.keys(SAMPLE_ROW).map(k => ({ wch: Math.max(k.length, 20) }))
    ws['!cols'] = colWidths
    if (format === 'csv') {
      XLSX.writeFile(wb, 'sample_test_cases.csv', { bookType: 'csv' })
    } else {
      XLSX.writeFile(wb, 'sample_test_cases.xlsx')
    }
  }

  // ── PARSE FILE ──────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws) as any[]
    setPreview(rows.slice(0, 5))
    setImportResult(null)
  }

  // ── IMPORT ──────────────────────────────────────────────────
  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)

    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws) as any[]

    let created = 0
    const errors: string[] = []

    // Build section map
    const sectionMap: Record<string, string> = {}
    sections.forEach(s => { sectionMap[s.name.toLowerCase()] = s.id })

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // +2 for header row and 1-indexing

      const sectionName = (row['Section'] || '').trim()
      const title = (row['Title'] || '').trim()

      if (!title) { errors.push(`Row ${rowNum}: Title is required.`); continue }
      if (!sectionName) { errors.push(`Row ${rowNum}: Section is required.`); continue }

      // Auto-create section if not exists
      let sectionId = sectionMap[sectionName.toLowerCase()]
      if (!sectionId) {
        const { data: newSec, error: secErr } = await sb.from('sections')
          .insert({ name: sectionName, project_id: projectId })
          .select().single()
        if (secErr || !newSec) { errors.push(`Row ${rowNum}: Failed to create section "${sectionName}".`); continue }
        sectionId = newSec.id
        sectionMap[sectionName.toLowerCase()] = sectionId
      }

      // Validate priority and type
      const priority = ['high','medium','low'].includes((row['Priority (high/medium/low)'] || '').toLowerCase())
        ? (row['Priority (high/medium/low)'] || 'medium').toLowerCase()
        : 'medium'
      const type = ['functional','regression','smoke','integration'].includes((row['Type (functional/regression/smoke/integration)'] || '').toLowerCase())
        ? (row['Type (functional/regression/smoke/integration)'] || 'functional').toLowerCase()
        : 'functional'

      const { error: tcErr } = await sb.from('test_cases').insert({
        title,
        description: row['Description'] || '',
        steps: row['Steps to Reproduce'] || '',
        expected_result: row['Expected Result'] || '',
        priority,
        type,
        section_id: sectionId,
        project_id: projectId,
      })

      if (tcErr) { errors.push(`Row ${rowNum}: ${tcErr.message}`); continue }
      created++
    }

    setImportResult({ created, errors })
    setImporting(false)
    if (created > 0) onRefresh()
    // Reset file input
    if (fileRef.current) fileRef.current.value = ''
    setPreview([])
  }

  const tabStyle = (t: string): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: activeTab === t ? 600 : 400,
    color: activeTab === t ? '#111' : '#6b7280',
    padding: '8px 16px', borderBottom: activeTab === t ? '2px solid #111' : '2px solid transparent',
    marginBottom: -1,
  })

  const formatBtn = (f: 'xlsx' | 'csv'): React.CSSProperties => ({
    border: `1px solid ${format === f ? '#111' : '#d1d5db'}`,
    borderRadius: 7, padding: '7px 16px', fontSize: 13, cursor: 'pointer',
    background: format === f ? '#111' : '#fff',
    color: format === f ? '#fff' : '#374151',
    fontWeight: format === f ? 500 : 400,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Import / Export Test Cases</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 20px' }}>
          <button style={tabStyle('export')} onClick={() => setActiveTab('export')}>Export</button>
          <button style={tabStyle('import')} onClick={() => setActiveTab('import')}>Import</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Format selector */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>File format</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={formatBtn('xlsx')} onClick={() => setFormat('xlsx')}>📊 Excel (.xlsx)</button>
              <button style={formatBtn('csv')} onClick={() => setFormat('csv')}>📄 CSV (.csv)</button>
            </div>
          </div>

          {/* EXPORT TAB */}
          {activeTab === 'export' && (
            <div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500 }}>Export summary</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                  {cases.length} test case{cases.length !== 1 ? 's' : ''} across {sections.length} section{sections.length !== 1 ? 's' : ''} will be exported.
                </p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Columns included</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {COLUMNS.map(c => (
                    <span key={c.key} style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 4 }}>
                      {c.label}{c.required ? ' *' : ''}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={handleExport} disabled={cases.length === 0}
                style={{ width: '100%', background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 500, cursor: cases.length === 0 ? 'not-allowed' : 'pointer', opacity: cases.length === 0 ? 0.5 : 1 }}>
                ⬇ Export {cases.length} test case{cases.length !== 1 ? 's' : ''} as {format.toUpperCase()}
              </button>
              {cases.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>No test cases to export.</p>}
            </div>
          )}

          {/* IMPORT TAB */}
          {activeTab === 'import' && (
            <div>
              {/* Sample download */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: '#1e40af' }}>First time importing?</p>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#3b82f6' }}>
                  Download a sample file to see the exact format required.
                </p>
                <button onClick={handleDownloadSample}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  ⬇ Download sample {format.toUpperCase()}
                </button>
              </div>

              {/* Required columns */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Required columns</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {COLUMNS.filter(c => c.required).map(c => (
                    <span key={c.key} style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>{c.label} *</span>
                  ))}
                  {COLUMNS.filter(c => !c.required).map(c => (
                    <span key={c.key} style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 4 }}>{c.label}</span>
                  ))}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  * New sections will be created automatically if they don't exist.
                </p>
              </div>

              {/* File picker */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Select file</p>
                <input ref={fileRef} type="file"
                  accept={format === 'csv' ? '.csv' : '.xlsx,.xls'}
                  onChange={handleFileChange}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, cursor: 'pointer' }} />
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Preview (first {preview.length} rows)</p>
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 7 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          {Object.keys(preview[0]).map(k => (
                            <th key={k} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', color: '#6b7280', fontWeight: 500 }}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                            {Object.values(row).map((v: any, j) => (
                              <td key={j} style={{ padding: '6px 10px', color: '#374151', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div style={{ marginBottom: 16 }}>
                  {importResult.created > 0 && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '10px 14px', marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#15803d', fontWeight: 500 }}>
                        ✓ Successfully imported {importResult.created} test case{importResult.created !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '10px 14px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
                        {importResult.errors.length} error{importResult.errors.length !== 1 ? 's' : ''}:
                      </p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} style={{ margin: '0 0 2px', fontSize: 12, color: '#dc2626' }}>{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleImport} disabled={importing || !fileRef.current?.files?.length}
                style={{ width: '100%', background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 500, cursor: (importing || !preview.length) ? 'not-allowed' : 'pointer', opacity: (importing || !preview.length) ? 0.5 : 1 }}>
                {importing ? 'Importing…' : `⬆ Import from ${format.toUpperCase()}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
