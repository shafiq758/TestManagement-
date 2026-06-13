-- ============================================================
-- TestFlow — Super Admin Seed (run after schema_v3)
-- ============================================================
-- Step 1: Go to Supabase → Authentication → Users → Add user
--   Email:    muhammad.shafiqurrehman@gmail.com
--   Password: Nymcard12#
--   Toggle "Auto Confirm User" ON
--   Click "Create User"
--
-- Step 2: Run this SQL — it finds the user by email automatically

DO $$
DECLARE
  admin_uid uuid;
  ws_id uuid;
BEGIN
  SELECT id INTO admin_uid FROM auth.users
  WHERE email = 'muhammad.shafiqurrehman@gmail.com';

  IF admin_uid IS NULL THEN
    RAISE EXCEPTION 'User not found. Create them in Auth → Users first.';
  END IF;

  -- Create the master workspace
  INSERT INTO workspaces (name, owner_id)
  VALUES ('TestFlow HQ', admin_uid)
  RETURNING id INTO ws_id;

  -- Add as admin, is_invited = false (self-registered owner)
  INSERT INTO workspace_members (workspace_id, user_id, role, invited_email, is_invited, status)
  VALUES (ws_id, admin_uid, 'admin', 'muhammad.shafiqurrehman@gmail.com', false, 'active');

  RAISE NOTICE 'Super admin seeded. Workspace ID: %', ws_id;
END $$;
