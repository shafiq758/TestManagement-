-- ============================================================
-- TestFlow v3 Schema — Super Admin + Role Rules
-- Run this in your Supabase SQL editor (replaces v2)
-- ============================================================

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
  is_invited boolean not null default false,  -- false = self-registered admin, true = invited
  status text not null default 'pending' check (status in ('active','pending')),
  created_at timestamptz default now(),
  -- One email per workspace (no duplicate roles in same workspace)
  unique (workspace_id, invited_email)
);

-- Enforce: invited members cannot be admin (DB-level constraint)
create or replace function check_invited_not_admin()
returns trigger language plpgsql as $$
begin
  if NEW.is_invited = true and NEW.role = 'admin' then
    raise exception 'Invited members cannot be assigned the admin role.';
  end if;
  return NEW;
end;
$$;

create trigger enforce_invited_role
before insert or update on workspace_members
for each row execute function check_invited_not_admin();

-- Projects
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

-- Workspaces: active members can see; super admin can delete all
create policy "Members see workspace" on workspaces for select using (
  exists (select 1 from workspace_members where workspace_id = workspaces.id and user_id = auth.uid() and status = 'active')
);
create policy "Owner creates workspace" on workspaces for insert with check (owner_id = auth.uid());
create policy "Owner updates workspace" on workspaces for update using (owner_id = auth.uid());
-- Super admin delete (by email check via auth.users)
create policy "Super admin deletes workspace" on workspaces for delete using (
  owner_id = auth.uid() or
  (select email from auth.users where id = auth.uid()) = 'muhammad.shafiqurrehman@gmail.com'
);

-- Workspace members
create policy "Members see workspace_members" on workspace_members for select using (
  user_id = auth.uid() or
  exists (select 1 from workspace_members wm where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid() and wm.status = 'active')
);
create policy "Anyone insert member" on workspace_members for insert with check (true);
create policy "Admins update invited members only" on workspace_members for update using (
  -- Can only update own record (claim invite) or admin updating invited members
  user_id = auth.uid() or
  (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
      and wm.status = 'active'
    )
    and workspace_members.is_invited = true  -- can only update invited, not other admins
  )
);
create policy "Admins remove invited members" on workspace_members for delete using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
    and wm.user_id = auth.uid()
    and wm.role = 'admin'
    and wm.status = 'active'
  )
  and workspace_members.is_invited = true
);

-- Projects, sections, test_cases, test_runs — workspace members only
create policy "Workspace members access projects" on projects for all using (
  exists (select 1 from workspace_members where workspace_id = projects.workspace_id and user_id = auth.uid() and status = 'active')
);
create policy "Workspace members access sections" on sections for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = sections.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);
create policy "Workspace members access test_cases" on test_cases for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = test_cases.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);
create policy "Workspace members access test_runs" on test_runs for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = test_runs.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);
