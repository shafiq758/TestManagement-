-- ============================================================
-- TestFlow v4 Schema — OTP Security + Blocking
-- Run this in Supabase SQL Editor (adds to existing v3 schema)
-- ============================================================

-- OTP attempt tracking
create table if not exists otp_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempts int not null default 0,
  blocked boolean not null default false,
  blocked_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz default now(),
  unique(email)
);

alter table otp_attempts enable row level security;

-- Super admin and workspace admins can see/manage otp_attempts
create policy "Admins manage otp_attempts" on otp_attempts for all using (
  (select email from auth.users where id = auth.uid()) = 'muhamad.shafiqurrehman@gmail.com'
  or
  exists (
    select 1 from workspace_members
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  )
);

-- Allow anonymous read for own email (for blocked check on login)
create policy "Anyone can check own block status" on otp_attempts for select using (true);
create policy "Anyone can upsert attempts" on otp_attempts for insert with check (true);
create policy "Anyone can update attempts" on otp_attempts for update using (true);

-- Admin unlock requests
create table if not exists unlock_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text default '',
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz default now()
);

alter table unlock_requests enable row level security;
create policy "Anyone can insert unlock request" on unlock_requests for insert with check (true);
create policy "Admins manage unlock requests" on unlock_requests for all using (
  (select email from auth.users where id = auth.uid()) = 'muhamad.shafiqurrehman@gmail.com'
  or
  exists (
    select 1 from workspace_members
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  )
);

-- Auto-delete unconfirmed users after 30 minutes
-- This requires pg_cron extension — enable it in Supabase Dashboard:
-- Database → Extensions → search "pg_cron" → enable it
-- Then run this:

select cron.schedule(
  'cleanup-unconfirmed-users',
  '*/5 * * * *', -- runs every 5 minutes
  $$
    delete from auth.users
    where email_confirmed_at is null
    and created_at < now() - interval '30 minutes';
  $$
);
