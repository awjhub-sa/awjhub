-- 012_rls_stage1.sql
--
-- Closing the doors that can be closed today.
--
-- ── Why this is staged rather than one sweep ──────────────────────────────
--
-- Every table in this schema carries USING (true), which lets the public anon
-- key read all of it. The obvious fix — require authentication everywhere — is
-- not available, because 75 of the 76 accounts have no authentication at all:
--
--     admin        1 of 1  has an auth account
--     staff        0 of 1
--     supervisor   0 of 10
--     observer     0 of 64
--
-- Observers and supervisors sign in by typing a national ID, which the browser
-- looks up in `users` with the anon key and then keeps in localStorage. To
-- Postgres they are anonymous. Requiring authentication on the tables they use
-- would lock out the entire field team mid-season, and requiring it on `users`
-- would stop them signing in at all.
--
-- So this migration does the two things that carry no such cost:
--
--   1. Locks the seven tables the field client never touches. Verified against
--      the source, not assumed: nothing under pages/Home, pages/Report,
--      pages/Mealcheck, the readiness screens, pages/Supervisor or the shared
--      libraries references any of them. They are read only by the admin
--      console and the caterer portal, both of which authenticate.
--
--   2. Takes the personal data out of anonymous reach. The only anonymous read
--      of `users` in the whole application is the login lookup, so that lookup
--      moves into a function that returns one row and nothing else, and the
--      table itself stops answering the anon key. That is 76 national ID
--      numbers, 76 phone numbers and 76 names no longer downloadable by anyone
--      holding a key that ships inside the web page.
--
-- What is deliberately NOT done here: reports, readiness, meal evaluations,
-- phases, tasks, menus, centres and org_settings stay open to anon, because
-- the field team writes to them with no identity to check. Closing those needs
-- real accounts for the field team — that is stage two, and it is a project,
-- not a policy.

-- ── 0. the role the portal needs ──────────────────────────────────────────
-- The check constraint predates the caterer portal and would reject its
-- accounts outright.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'staff', 'observer', 'supervisor', 'caterer'));

-- ── 1. tables no anonymous client ever reads ──────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seasons',              -- admin only
    'caterers',             -- admin console + the caterer's own record
    'center_officials',     -- names and numbers of centre officials
    'form_templates',       -- admin authoring
    'form_assignments',     -- admin assigns, caterer fills — both signed in
    'form_events',          -- the audit trail of the above
    'caterer_evaluations'   -- every caterer's standing against the others
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_auth', t);
  END LOOP;
END $$;

-- ── 2. the login lookup, and the end of anonymous reads on users ──────────
--
-- SECURITY DEFINER so it can see the table the caller no longer can. It answers
-- with one row, only for a field role, and only for an exact ID: an admin's row
-- cannot be fished out of it, and neither can a list of anybody.
CREATE OR REPLACE FUNCTION public.login_by_id_number(p_id_number text)
RETURNS TABLE (
  uid uuid,
  id_number text,
  name text,
  name_ar text,
  phone text,
  role text,
  center text,
  assigned_centers text[],
  caterer text,
  caterer_id uuid,
  role_code text,
  bravo_code text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.uid, u.id_number, u.name, u.name_ar, u.phone, u.role, u.center,
         u.assigned_centers, u.caterer, u.caterer_id, u.role_code, u.bravo_code
  FROM public.users u
  WHERE u.id_number = p_id_number
    AND u.role IN ('observer', 'supervisor')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.login_by_id_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_by_id_number(text) TO anon, authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_all ON public.users;
DROP POLICY IF EXISTS users_auth ON public.users;
CREATE POLICY users_auth ON public.users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- No anon policy: with RLS on and nothing granted, the anon key reads nothing.

COMMENT ON FUNCTION public.login_by_id_number(text) IS
  'دخول المراقب/المشرف برقم الهوية. يُرجع صفاً واحداً لدور ميداني فقط — الجدول نفسه مغلق أمام المفتاح العام.';
