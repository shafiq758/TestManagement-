import type { WorkspaceRole } from '@/types'

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  tester: 'Tester',
  viewer: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  admin: 'Full access — manage members and all content',
  editor: 'Create and edit projects, sections, and test cases',
  tester: 'Execute test runs — mark pass, fail, skip',
  viewer: 'Read-only access to all content',
}

export const ROLE_COLORS: Record<WorkspaceRole, { bg: string; text: string }> = {
  admin:  { bg: '#fef3c7', text: '#92400e' },
  editor: { bg: '#dbeafe', text: '#1e40af' },
  tester: { bg: '#d1fae5', text: '#065f46' },
  viewer: { bg: '#f3f4f6', text: '#374151' },
}

// Invited members can only be editor / tester / viewer — never admin
export const INVITABLE_ROLES: WorkspaceRole[] = ['editor', 'tester', 'viewer']

// Roles an admin can change an invited member to (cannot promote to admin)
export const CHANGEABLE_ROLES_FOR_INVITED: WorkspaceRole[] = ['editor', 'tester', 'viewer']

export function canManageMembers(role: WorkspaceRole)  { return role === 'admin' }
export function canCreateProjects(role: WorkspaceRole) { return role === 'admin' || role === 'editor' }
export function canEditCases(role: WorkspaceRole)      { return role === 'admin' || role === 'editor' }
export function canExecuteRuns(role: WorkspaceRole)    { return role === 'admin' || role === 'editor' || role === 'tester' }
