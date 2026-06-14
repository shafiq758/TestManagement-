-- ============================================================
-- TestFlow MASTER Schema — All versions combined
-- Run this on a FRESH Supabase project (drops everything first)
-- ============================================================

-- ── Drop everything ──────────────────────────────────────────
drop table if exists bugs cascade;
drop table if exists test_runs cascade;
drop table if exists test_plans cascade;
drop table if exists test_cases cascade;
drop table if exists sections cascade;
drop table if exists sprints cascade;
drop table if exists milestones cascade;
drop table if exists projects cascade;
drop table if exists unlock_requests cascade;
drop table if exists otp_attempts cascade;
drop table if exists trusted_browsers cascade;
drop table if exists workspace_members cascade;
drop table if exists workspaces cascade;
drop function if exists is_workspace_admin(uuid) cascade;
drop function if exists get_my_workspace_ids() cascade;
drop function if exists check_invited_not_admin() cascade;

-- ── Workspaces ────────────────────────────────────────────────
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,  -- unique workspace names
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);

-- ── Workspace members ─────────────────────────────────────────
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users,
  role text not null default 'viewer' check (role in ('admin','editor','tester','viewer')),
  invited_email text not null,
  is_invited boolean not null default false,
  status text not null default 'pending' check (status in ('active','pending')),
  created_at timestamptz default now(),
  unique (workspace_id, invited_email)
);

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

-- ── Projects ──────────────────────────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- ── Sections ──────────────────────────────────────────────────
create table sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- ── Test cases ────────────────────────────────────────────────
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

-- ── Milestones ────────────────────────────────────────────────
create table milestones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  project_id uuid references projects(id) on delete cascade not null,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  due_date date,
  created_at timestamptz default now()
);

-- ── Sprints ───────────────────────────────────────────────────
create table sprints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text default '',
  project_id uuid references projects(id) on delete cascade not null,
  milestone_id uuid references milestones(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','active','completed')),
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- ── Test plans ────────────────────────────────────────────────
create table test_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  sprint_id uuid references sprints(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  case_ids text[] default '{}',
  created_at timestamptz default now()
);

-- ── Test runs ─────────────────────────────────────────────────
create table test_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete cascade not null,
  sprint_id uuid references sprints(id) on delete set null,
  plan_id uuid references test_plans(id) on delete set null,
  case_ids text[] default '{}',
  results jsonb default '{}',
  created_at timestamptz default now()
);

-- ── Bugs ──────────────────────────────────────────────────────
create table bugs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  steps text default '',
  expected_result text default '',
  actual_result text default '',
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed','wont_fix')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  project_id uuid references projects(id) on delete cascade not null,
  sprint_id uuid references sprints(id) on delete set null,
  test_run_id uuid references test_runs(id) on delete set null,
  test_case_id uuid references test_cases(id) on delete set null,
  attachments text[] default '{}',
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- ── Security tables ───────────────────────────────────────────
create table otp_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempts int not null default 0,
  blocked boolean not null default false,
  blocked_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz default now(),
  unique(email)
);

create table unlock_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text default '',
  status text not null default 'pending' check (status in ('pending','resolved')),
  created_at timestamptz default now()
);

create table trusted_browsers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null unique,
  token text not null,
  created_at timestamptz default now()
);

-- ── RLS helper functions ──────────────────────────────────────
create or replace function is_workspace_admin(ws_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
    and user_id = auth.uid()
    and role = 'admin'
    and status = 'active'
  );
$$;

create or replace function get_my_workspace_ids()
returns setof uuid language sql security definer stable
set search_path = public as $$
  select workspace_id from workspace_members
  where user_id = auth.uid() and status = 'active';
$$;

grant execute on function is_workspace_admin(uuid) to authenticated, anon;
grant execute on function get_my_workspace_ids() to authenticated, anon;

-- ── Enable RLS ────────────────────────────────────────────────
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table projects enable row level security;
alter table sections enable row level security;
alter table test_cases enable row level security;
alter table milestones enable row level security;
alter table sprints enable row level security;
alter table test_plans enable row level security;
alter table test_runs enable row level security;
alter table bugs enable row level security;
alter table otp_attempts enable row level security;
alter table unlock_requests enable row level security;
alter table trusted_browsers enable row level security;

-- ── RLS Policies ─────────────────────────────────────────────

-- Workspaces
create policy "Create workspace" on workspaces for insert with check (auth.uid() = owner_id);
create policy "See workspace" on workspaces for select using (id in (select get_my_workspace_ids()) or owner_id = auth.uid());
create policy "Update workspace" on workspaces for update using (owner_id = auth.uid());
create policy "Delete workspace" on workspaces for delete using (owner_id = auth.uid());

-- Workspace members
create policy "See members" on workspace_members for select using (
  user_id = auth.uid() or workspace_id in (select get_my_workspace_ids())
);
create policy "Insert member" on workspace_members for insert with check (true);
create policy "Update member" on workspace_members for update using (
  user_id = auth.uid()
  or invited_email = (select email from auth.users where id = auth.uid())
  or (is_workspace_admin(workspace_id) and is_invited = true)
);
create policy "Delete member" on workspace_members for delete using (
  is_workspace_admin(workspace_id) and is_invited = true
);

-- Projects
create policy "Access projects" on projects for all using (
  exists (select 1 from workspace_members where workspace_id = projects.workspace_id and user_id = auth.uid() and status = 'active')
);

-- Sections
create policy "Access sections" on sections for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = sections.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Test cases
create policy "Access test_cases" on test_cases for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = test_cases.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Milestones
create policy "Access milestones" on milestones for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = milestones.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Sprints
create policy "Access sprints" on sprints for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = sprints.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Test plans
create policy "Access test_plans" on test_plans for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = test_plans.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Test runs
create policy "Access test_runs" on test_runs for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = test_runs.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Bugs
create policy "Access bugs" on bugs for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id where p.id = bugs.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- OTP attempts
create policy "See otp_attempts" on otp_attempts for select using (true);
create policy "Insert otp_attempts" on otp_attempts for insert with check (true);
create policy "Update otp_attempts" on otp_attempts for update using (true);

-- Unlock requests
create policy "Insert unlock_request" on unlock_requests for insert with check (true);
create policy "Admins see unlock_requests" on unlock_requests for all using (
  exists (select 1 from workspace_members where user_id = auth.uid() and role = 'admin' and status = 'active')
);

-- Trusted browsers
create policy "Manage own trusted browser" on trusted_browsers for all using (user_id = auth.uid());
create policy "Insert trusted browser" on trusted_browsers for insert with check (true);

-- ── Storage bucket for attachments ────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments', 'attachments', true, 26214400,
  array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','video/quicktime']
) on conflict (id) do nothing;

create policy "Upload attachments" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
create policy "Read attachments" on storage.objects for select to public using (bucket_id = 'attachments');
create policy "Delete own attachments" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and owner = auth.uid());

-- ── Super admin seed ──────────────────────────────────────────
-- First create the user in Auth → Users:
--   Email: muhamad.shafiqurrehman@gmail.com
--   Password: Nymcard12#
--   Auto Confirm User: ON
-- Then run this:

do $$
declare
  admin_uid uuid;
  ws_id uuid;
begin
  select id into admin_uid from auth.users where email = 'muhamad.shafiqurrehman@gmail.com';
  if admin_uid is null then
    raise notice 'Super admin user not found — skipping seed.';
    return;
  end if;
  if exists (select 1 from workspace_members where invited_email = 'muhamad.shafiqurrehman@gmail.com') then
    raise notice 'Super admin already seeded — skipping.';
    return;
  end if;
  insert into workspaces (name, owner_id) values ('TestFlow HQ', admin_uid) returning id into ws_id;
  insert into workspace_members (workspace_id, user_id, role, invited_email, is_invited, status)
  values (ws_id, admin_uid, 'admin', 'muhamad.shafiqurrehman@gmail.com', false, 'active');
  update auth.users set email_confirmed_at = now() where id = admin_uid;
  raise notice 'Super admin seeded. Workspace ID: %', ws_id;
end $$;

-- ── Optional: Auto-cleanup unconfirmed users (requires pg_cron) ──
-- Enable pg_cron in Database → Extensions first, then run:
-- select cron.schedule('cleanup-unconfirmed', '*/5 * * * *', $$
--   delete from auth.users where email_confirmed_at is null
--   and created_at < now() - interval '30 minutes';
-- $$);

-- ── Test case attachments (Batch 2b) ─────────────────────────
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT '{}';

-- ── Execution history (Batch 2b) ─────────────────────────────
CREATE TABLE IF NOT EXISTS execution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid REFERENCES test_runs(id) ON DELETE CASCADE NOT NULL,
  test_case_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass','fail','skip')),
  comment text DEFAULT '',
  executed_by uuid REFERENCES auth.users,
  executed_at timestamptz DEFAULT now()
);
ALTER TABLE execution_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members access execution_history" ON execution_history FOR ALL USING (
  EXISTS (
    SELECT 1 FROM test_runs tr
    JOIN projects p ON p.id = tr.project_id
    JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE tr.id = execution_history.test_run_id
    AND wm.user_id = auth.uid() AND wm.status = 'active'
  )
);

-- ── Unique project name per workspace ─────────────────────────
ALTER TABLE projects ADD CONSTRAINT IF NOT EXISTS projects_name_workspace_unique UNIQUE (workspace_id, name);
