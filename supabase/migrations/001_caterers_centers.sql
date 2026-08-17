-- 001 — Caterers, centers and center officials.
--
-- Until now a caterer was only ever a text value copied into every table, and
-- the centers lived in src/config/centers.js. Nothing could hang off either of
-- them: no contract, no cumulative score, no named official, no colour band.
-- This migration promotes both to real rows.
--
-- Additive only: no existing table is dropped or altered. The `caterer text`
-- columns already in reports/logistics/evaluations keep working untouched,
-- because caterers.name is a natural key carrying exactly those same strings.
--
-- Run in the Supabase SQL editor. Safe to run twice.

CREATE TABLE IF NOT EXISTS public.caterers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text UNIQUE NOT NULL,          -- matches the legacy caterer text
  name_short     text,
  cr_number      text,                          -- رقم السجل التجاري
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','suspended','archived')),
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS caterers_name_idx   ON public.caterers (name);
CREATE INDEX IF NOT EXISTS caterers_status_idx ON public.caterers (status);

-- The center id stays the Arabic label ('مركز 5') so every existing row that
-- stores `center text` joins to this table without a data migration.
CREATE TABLE IF NOT EXISTS public.centers (
  id            text PRIMARY KEY,
  caterer_id    uuid REFERENCES public.caterers(id) ON DELETE SET NULL,
  caterer_name  text,                           -- denormalised; keeps legacy reads cheap
  shakhis       text,                           -- الشاخص
  location_url  text,
  zone          text,
  capacity      int,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS centers_caterer_idx ON public.centers (caterer_id);
CREATE INDEX IF NOT EXISTS centers_active_idx  ON public.centers (active);

CREATE TABLE IF NOT EXISTS public.center_officials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   text REFERENCES public.centers(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text,                             -- مدير مركز / مشرف نوبة / ضابط اتصال
  phone       text,
  email       text,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS center_officials_center_idx ON public.center_officials (center_id);

ALTER TABLE public.caterers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_officials ENABLE ROW LEVEL SECURITY;

-- Matches the policy every existing table already carries. The app authenticates
-- observers by national id rather than through Supabase auth, so a stricter
-- policy would lock the field out. This is the same open door flagged in
-- docs/ROADMAP.md and must be closed for all tables together, not one at a time.
DROP POLICY IF EXISTS caterers_all         ON public.caterers;
DROP POLICY IF EXISTS centers_all          ON public.centers;
DROP POLICY IF EXISTS center_officials_all ON public.center_officials;

CREATE POLICY caterers_all         ON public.caterers         FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY centers_all          ON public.centers          FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY center_officials_all ON public.center_officials FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ALTER PUBLICATION fails if the table is already a member, so guard each one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'caterers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.caterers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'centers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.centers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'center_officials') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.center_officials;
  END IF;
END $$;
