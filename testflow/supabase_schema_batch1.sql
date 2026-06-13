-- ============================================================
-- TestFlow Batch 1 — Milestones, Sprints, Test Plans
-- Run in Supabase SQL Editor
-- ============================================================

-- Milestones
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  project_id uuid references projects(id) on delete cascade not null,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  due_date date,
  created_at timestamptz default now()
);
alter table milestones enable row level security;
create policy "Workspace members access milestones" on milestones for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = milestones.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Sprints
create table if not exists sprints (
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
alter table sprints enable row level security;
create policy "Workspace members access sprints" on sprints for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = sprints.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Test Plans
create table if not exists test_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  sprint_id uuid references sprints(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  case_ids text[] default '{}',
  created_at timestamptz default now()
);
alter table test_plans enable row level security;
create policy "Workspace members access test_plans" on test_plans for all using (
  exists (select 1 from projects p join workspace_members wm on wm.workspace_id = p.workspace_id
    where p.id = test_plans.project_id and wm.user_id = auth.uid() and wm.status = 'active')
);

-- Link test_runs to sprints and test_plans
alter table test_runs add column if not exists sprint_id uuid references sprints(id) on delete set null;
alter table test_runs add column if not exists plan_id uuid references test_plans(id) on delete set null;
