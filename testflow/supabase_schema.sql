-- Run this in your Supabase SQL editor

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  user_id uuid references auth.users not null,
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

create table test_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete cascade not null,
  case_ids text[] default '{}',
  results jsonb default '{}',
  created_at timestamptz default now()
);

-- Row Level Security
alter table projects enable row level security;
alter table sections enable row level security;
alter table test_cases enable row level security;
alter table test_runs enable row level security;

create policy "Users own their projects" on projects for all using (auth.uid() = user_id);
create policy "Project members see sections" on sections for all using (
  exists (select 1 from projects where id = sections.project_id and user_id = auth.uid())
);
create policy "Project members see test_cases" on test_cases for all using (
  exists (select 1 from projects where id = test_cases.project_id and user_id = auth.uid())
);
create policy "Project members see test_runs" on test_runs for all using (
  exists (select 1 from projects where id = test_runs.project_id and user_id = auth.uid())
);
