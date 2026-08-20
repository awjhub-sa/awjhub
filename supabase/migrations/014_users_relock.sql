-- 014_users_relock.sql
--
-- Closes `users` again — but only after the build that can live without it
-- is actually serving the field team.
--
-- Run this when, and not before:
--   * the deployed application calls login_by_id_number() (AuthContext does
--     this already; it simply has to be released), and
--   * a real observer has signed in on the deployed build.
--
-- Verify by signing in as an observer with the network tab open: the request
-- should be POST /rest/v1/rpc/login_by_id_number, not GET /rest/v1/users.

DROP POLICY IF EXISTS users_field_login ON public.users;

-- Whatever remains: authenticated only, as 012 intended.
DROP POLICY IF EXISTS users_auth ON public.users;
CREATE POLICY users_auth ON public.users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
