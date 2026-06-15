const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', 'dashboard', '[projectId]', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

let changes = 0;

// FIX 1: Add commentModal state to RunsTab if missing
if (!content.includes("commentModal, setCommentModal")) {
  content = content.replace(
    "  const [creating, setCreating] = useState(false)\n  const [activeRun, setActiveRun] = useState<string | null>(null)\n  const sb = createClient()",
    "  const [creating, setCreating] = useState(false)\n  const [activeRun, setActiveRun] = useState<string | null>(null)\n  const [commentModal, setCommentModal] = useState<{runId: string; caseId: string; status: any} | null>(null)\n  const [commentText, setCommentText] = useState('')\n  const sb = createClient()"
  );
  changes++;
  console.log('Fix 1: Added commentModal state');
}

// FIX 2: Update updateResult to save to execution_history
if (!content.includes("execution_history")) {
  content = content.replace(
    `  const updateResult = async (runId: string, caseId: string, status: RunStatus) => {
    const run = runs.find(r => r.id === runId)
    if (!run) return
    const results = { ...run.results, [caseId]: status }
    await sb.from('test_runs').update({ results }).eq('id', runId)
    onRefresh()
  }`,
    `  const updateResult = async (runId: string, caseId: string, status: RunStatus, comment: string = '') => {
    const run = runs.find(r => r.id === runId)
    if (!run) return
    const results = { ...run.results, [caseId]: status }
    await sb.from('test_runs').update({ results }).eq('id', runId)
    const { data: { session } } = await sb.auth.getSession()
    await sb.from('execution_history').insert({
      test_run_id: runId, test_case_id: caseId,
      status, comment: comment.trim(),
      executed_by: session?.user?.id,
    })
    onRefresh()
  }`
  );
  changes++;
  console.log('Fix 2: Updated updateResult with exec history');
}

// FIX 3: Add onShowComment prop to RunExecution call
if (!content.includes("onShowComment={(runId")) {
  content = content.replace(
    "onUpdateResult={updateResult} onBulkUpdate={bulkUpdateResults}\n                onViewCase={(tc) => onViewRunCase(tc, results, run.id, bugs)} />",
    "onUpdateResult={updateResult} onBulkUpdate={bulkUpdateResults}\n                onViewCase={(tc) => onViewRunCase(tc, results, run.id, bugs)}\n                onShowComment={(runId, caseId, status) => { setCommentModal({runId, caseId, status}); setCommentText('') }} />"
  );
  changes++;
  console.log('Fix 3: Added onShowComment to RunExecution call');
}

// FIX 4: Add comment modal JSX to RunsTab
if (!content.includes("Comment modal — at RunsTab")) {
  content = content.replace(
    "      {creating && (\n        <CreateRunModal",
    `      {commentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', width: '100%', maxWidth: 420, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Mark as {commentModal.status === 'pass' ? '✓ Pass' : commentModal.status === 'fail' ? '✗ Fail' : '— Skip'}</span>
              {(() => { const sc = ({pass:{bg:'#dcfce7',color:'#15803d'},fail:{bg:'#fee2e2',color:'#dc2626'},skip:{bg:'#fef9c3',color:'#ca8a04'}} as any)[commentModal.status]; return <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{commentModal.status}</span> })()}
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>Comment <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="e.g. Failed on Chrome only, passed on Firefox"
              rows={3} autoFocus
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setCommentModal(null)} style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '7px 14px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              {(() => { const sc = ({pass:{bg:'#dcfce7',color:'#15803d'},fail:{bg:'#fee2e2',color:'#dc2626'},skip:{bg:'#fef9c3',color:'#ca8a04'}} as any)[commentModal.status]; return <button onClick={() => { updateResult(commentModal.runId, commentModal.caseId, commentModal.status, commentText); setCommentModal(null) }} style={{ background: sc.bg, color: sc.color, border: '1px solid '+sc.color, borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Confirm {commentModal.status}</button> })()}
            </div>
          </div>
        </div>
      )}

      {/* Comment modal — at RunsTab */}
      {creating && (
        <CreateRunModal`
  );
  changes++;
  console.log('Fix 4: Added comment modal JSX');
}

// FIX 5: Update status buttons to use onShowComment
if (content.includes("onClick={() => updateResult(run.id, tc.id, s)}")) {
  content = content.replace(
    /onClick=\{.*?updateResult\(run\.id, tc\.id, s\)\}/g,
    "onClick={() => onShowComment(run.id, tc.id, s)}"
  );
  changes++;
  console.log('Fix 5: Status buttons now use onShowComment');
}

// FIX 6: Add execHistory and onShowComment to RunExecution props
if (!content.includes("onShowComment: (runId")) {
  content = content.replace(
    "  onUpdateResult: (runId: string, caseId: string, status: RunStatus) => void\n  onBulkUpdate: (runId: string, caseIds: string[], status: RunStatus) => void\n  onViewCase: (tc: any) => void\n})",
    "  onUpdateResult: (runId: string, caseId: string, status: RunStatus, comment?: string) => void\n  onBulkUpdate: (runId: string, caseIds: string[], status: RunStatus) => void\n  onViewCase: (tc: any) => void\n  onShowComment: (runId: string, caseId: string, status: RunStatus) => void\n})"
  );
  changes++;
  console.log('Fix 6: Added onShowComment to RunExecution type');
}

// FIX 7: Add execution history display after status buttons
if (!content.includes("Execution History")) {
  content = content.replace(
    "              </div>\n            </div>\n          </div>\n        )\n      })}\n    </div>",
    `              </div>
            </div>
          </div>
          {execHistory.filter((h) => h.test_case_id === tc.id).length > 0 && (
            <div style={{ padding: '5px 16px 8px 58px', background: '#fafafa', borderTop: '1px solid #f9fafb' }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Execution History</p>
              {execHistory.filter((h) => h.test_case_id === tc.id).slice(0,5).map((h) => {
                const hc = ({pass:{bg:'#dcfce7',color:'#15803d'},fail:{bg:'#fee2e2',color:'#dc2626'},skip:{bg:'#fef9c3',color:'#ca8a04'}} as any)[h.status] || {bg:'#f3f4f6',color:'#6b7280'};
                return (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ background: hc.bg, color: hc.color, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, minWidth: 34, textAlign: 'center' }}>{h.status}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(h.executed_at).toLocaleString()}</span>
                    {h.comment && <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>"{h.comment}"</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )
      })}
    </div>`
  );
  changes++;
  console.log('Fix 7: Added execution history display');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone! Applied ${changes} fixes.`);
console.log('Line count:', content.split('\n').length);
