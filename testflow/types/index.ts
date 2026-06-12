export type Priority = 'high' | 'medium' | 'low'
export type CaseType = 'functional' | 'regression' | 'smoke' | 'integration'
export type RunStatus = 'pass' | 'fail' | 'skip' | 'untested'

export interface Project {
  id: string
  name: string
  user_id: string
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
