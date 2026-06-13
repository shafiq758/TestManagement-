-- ============================================================
-- TestFlow v2 Schema — Workspaces + RBAC
-- Run this in your Supabase SQL editor (fresh run)
-- ============================================================

-- Drop old tables if re-running
drop table if exists test_runs cascade;
drop table if exists test_cases cascade;
drop table if exists sections cascade;
drop table if exists projects cascade;
drop table if exists workspace_members cascade;
drop table if exists workspaces cascade;

-- Workspaces
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);

-- Workspace members
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users,
  role text not null default 'viewer' check (role in ('admin','editor','tester','viewer')),
  invited_email text not null,
  status text not null default 'pending' check (status in ('active','pending')),
  created_at timestamptz default now()
);

-- Projects (now tied to workspace)
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- Sections
create table sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- Test cases
create table test_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  steps text default '',
  expected_result text default '',
  priority text default 'medium',
  type text default 'functional',
  section_id uuid references sections(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- Test runs
create table test_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete cascade not null,
  case_ids text[] default '{}',
  results jsonb default '{}',
  created_at timestamptz default now()
);

-- ── Row Level Security ──────────────────────────────────────

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table projects enable row level security;
alter table sections enable row level security;
alter table test_cases enable row level security;
alter table test_runs enable row level security;

-- Workspaces: members can see their workspace
create policy "Members see workspace" on workspaces for select using (
  exists (select 1 from workspace_members where workspace_id = workspaces.id and user_id = auth.uid() and status = 'active')
);
create policy "Anyone can create workspace" on workspaces for insert with check (owner_id = auth.uid());
create policy "Admins update workspace" on workspaces for update using (owner_id = auth.uid());

-- Workspace members
create policy "Members see their workspace members" on workspace_members for select using (
  user_id = auth.uid() or
  exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
);
create policy "Anyone insert member" on workspace_members for insert with check (true);
create policy "Admins update members" on workspace_members for update using (
  user_id = auth.uid() or
  exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid() and wm.role = 'admin' and wm.status = 'active')
);
create policy "Admins delete members" on workspace_members for delete using (
  exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid() and wm.role = 'admin' and wm.status = 'active')
);

-- Projects
create policy "Workspace members see projects" on projects for all using (
  exists (select 1 from workspace_members where workspace_id = projects.workspace_id and user_id = auth.uid() and status = 'active')
);

-- Sections
create policy "Workspace members see sections" on sections for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = sections.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Test cases
create policy "Workspace members see test_cases" on test_cases for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = test_cases.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Test runs
create policy "Workspace members see test_runs" on test_runs for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = test_runs.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);
