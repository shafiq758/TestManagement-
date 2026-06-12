export default function DashboardHome() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <p style={{ fontWeight: 500, margin: '0 0 6px' }}>Select a project</p>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Choose a project from the sidebar, or create a new one.</p>
      </div>
    </div>
  )
}
