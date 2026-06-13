export type Priority = 'high' | 'medium' | 'low'
export type CaseType = 'functional' | 'regression' | 'smoke' | 'integration'
export type RunStatus = 'pass' | 'fail' | 'skip' | 'untested'
export type WorkspaceRole = 'admin' | 'editor' | 'tester' | 'viewer'
export type SystemRole = 'super_admin' | 'user'

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  invited_email: string
  is_invited: boolean      // true = came via invite (cannot be promoted to admin)
  status: 'active' | 'pending'
  created_at: string
  user_name?: string
  user_email?: string
}

export interface Project {
  id: string
  name: string
  workspace_id: string
  created_at: string
}

export interface Section {
  id: string
  name: string
  project_id: string
  created_at: string
}

export interface TestCase {
  id: string
  title: string
  description: string
  steps: string
  expected_result: string
  priority: Priority
  type: CaseType
  section_id: string
  project_id: string
  created_at: string
}

export interface TestRun {
  id: string
  name: string
  project_id: string
  case_ids: string[]
  results: Record<string, RunStatus>
  created_at: string
}
