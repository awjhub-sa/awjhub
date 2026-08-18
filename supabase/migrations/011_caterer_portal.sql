-- 011_caterer_portal.sql
--
-- The caterer's side of a report.
--
-- Until now a report was written by an observer and closed by the office, and
-- the caterer learned of it by telephone. Their answer — what they did about
-- it — lived in that call and nowhere else, so a season's worth of corrective
-- action left no trace and the same finding could be raised twice with no
-- record that it had already been fixed.
--
-- Kept separate from admin_notes on purpose. That column is the office talking
-- to itself and the caterer must never see it; this one is the caterer talking
-- back. Putting both in one field would guarantee that one day the wrong half
-- is shown to the wrong party.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS caterer_response      text,
  ADD COLUMN IF NOT EXISTS caterer_responded_at  timestamptz;

COMMENT ON COLUMN public.reports.caterer_response IS
  'ردّ المتعهد على البلاغ — يراه المتعهد والإدارة. لا يُخلط مع admin_notes الداخلية.';
COMMENT ON COLUMN public.reports.admin_notes IS
  'ملاحظات داخلية للإدارة — لا تُعرض للمتعهد أبداً.';

-- The same for support requests: a caterer looking at a request raised for
-- their centre should be able to say what they sent.
ALTER TABLE public.logistics_requests
  ADD COLUMN IF NOT EXISTS caterer_response      text,
  ADD COLUMN IF NOT EXISTS caterer_responded_at  timestamptz;

-- ── A note on access ───────────────────────────────────────────────────────
-- The policies on every table in this schema are still USING (true), which was
-- an internal problem and becomes an external one the moment a caterer holds
-- an account: the anon key would let them read every other caterer's scores
-- and every observer's national ID.
--
-- The portal's queries are scoped to the signed-in caterer and ask for named
-- columns rather than *, so the application never requests what it must not
-- show. That is defence in depth, not a substitute: it must be backed by real
-- row-level policies before a single caterer account is issued.
