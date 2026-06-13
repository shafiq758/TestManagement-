-- ============================================================
-- TestFlow MASTER Schema
-- Run this on a FRESH Supabase project (drops everything first)
-- This replaces ALL previous SQL files
-- ============================================================

-- ── Drop everything ──────────────────────────────────────────
drop table if exists test_runs cascade;
drop table if exists test_plans cascade;
drop table if exists test_cases cascade;
drop table if exists sections cascade;
drop table if exists projects cascade;
drop table if exists sprints cascade;
drop table if exists milestones cascade;
drop table if exists unlock_requests cascade;
drop table if exists otp_attempts cascade;
drop table if exists trusted_browsers cascade;
drop table if exists workspace_members cascade;
drop table if exists workspaces cascade;
drop function if exists is_workspace_admin(uuid) cascade;
drop function if exists get_my_workspace_ids() cascade;

-- ── Core tables ───────────────────────────────────────────────

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);

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

-- Enforce invited members cannot be admin
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

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete cascade not null,
  created_at timestamptz default now()
);

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

create table milestones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  project_id uuid references projects(id) on delete cascade not null,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  due_date date,
  created_at timestamptz default now()
);

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

create table test_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  sprint_id uuid references sprints(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  case_ids text[] default '{}',
  created_at timestamptz default now()
);

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

-- ── Super admin seed ──────────────────────────────────────────
-- Run this AFTER creating the user in Auth → Users:
--   Email: muhamad.shafiqurrehman@gmail.com
--   Password: Nymcard12#
--   Auto Confirm User: ON

DO $$
DECLARE
  admin_uid uuid;
  ws_id uuid;
BEGIN
  SELECT id INTO admin_uid FROM auth.users
  WHERE email = 'muhamad.shafiqurrehman@gmail.com';

  IF admin_uid IS NULL THEN
    RAISE NOTICE 'Super admin user not found — skipping seed. Create user in Auth first then re-run.';
    RETURN;
  END IF;

  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM workspace_members WHERE invited_email = 'muhamad.shafiqurrehman@gmail.com') THEN
    RAISE NOTICE 'Super admin already seeded — skipping.';
    RETURN;
  END IF;

  INSERT INTO workspaces (name, owner_id) VALUES ('TestFlow HQ', admin_uid) RETURNING id INTO ws_id;
  INSERT INTO workspace_members (workspace_id, user_id, role, invited_email, is_invited, status)
  VALUES (ws_id, admin_uid, 'admin', 'muhamad.shafiqurrehman@gmail.com', false, 'active');

  -- Confirm email
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = admin_uid;

  RAISE NOTICE 'Super admin seeded successfully. Workspace ID: %', ws_id;
END $$;

-- ── Optional: Auto-cleanup unconfirmed users (requires pg_cron) ─
-- Enable pg_cron in Database → Extensions first, then run:
-- select cron.schedule('cleanup-unconfirmed', '*/5 * * * *', $$
--   delete from auth.users where email_confirmed_at is null and created_at < now() - interval '30 minutes';
-- $$);
