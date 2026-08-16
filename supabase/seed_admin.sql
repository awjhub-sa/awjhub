-- First admin bootstrap. Run AFTER schema.sql.
--
-- AdminStaff.jsx can only create staff while an admin is already signed in,
-- so the very first admin has to be seeded by hand:
--
--   1. Supabase Dashboard → Authentication → Users → "Add user"
--      Enter the email + password, and tick "Auto Confirm User".
--   2. Replace the email below with the same one, then run this file
--      in the SQL Editor.
--
-- It links the new auth.users entry to a public.users row with role='admin'.

INSERT INTO public.users (auth_uid, email, name_ar, name, role)
SELECT id, email, 'مسؤول النظام', 'System Admin', 'admin'
FROM auth.users
WHERE email = 'REPLACE_WITH_YOUR_EMAIL'
ON CONFLICT (email) DO UPDATE
  SET auth_uid = EXCLUDED.auth_uid,
      role     = 'admin';

-- Verify:
SELECT uid, email, role, auth_uid FROM public.users WHERE role = 'admin';
