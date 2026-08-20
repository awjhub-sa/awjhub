-- 013_users_read_unblock.sql
--
-- Lets the field team back in.
--
-- 012 closed `users` to the anon key and moved the sign-in lookup into
-- login_by_id_number(). The application code was written to try the function
-- first and fall back to the table, so that either order of deployment would
-- work — but that code was never deployed. The build the field team is running
-- still reads the table directly, so the migration locked seventy-four
-- observers and supervisors out mid-season.
--
-- This restores the read they need, and no more than that: only rows whose
-- role is a field role. An admin's or an office account's row stays out of
-- anonymous reach, which 012 was right about and this does not undo.
--
-- It is a stopgap. The order that should have been followed is:
--
--   1. run this now, so the team can work
--   2. deploy the build that calls login_by_id_number()
--   3. run 014_users_relock.sql, below, to close the table again
--
-- Nothing here needs to be undone by hand: step 3 is a file of its own.

DROP POLICY IF EXISTS users_field_login ON public.users;
CREATE POLICY users_field_login ON public.users
  FOR SELECT TO anon
  USING (role IN ('observer', 'supervisor'));

COMMENT ON POLICY users_field_login ON public.users IS
  'مؤقتة — لدخول المراقبين والمشرفين حتى تُنشر النسخة التي تستعمل login_by_id_number(). تُحذف بالترحيل ٠١٤.';
