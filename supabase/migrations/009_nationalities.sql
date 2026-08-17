-- 009_nationalities.sql
--
-- Nationalities move out of the source and into the database.
--
-- They were nine entries in config/nationalities.js, each carrying a hard-coded
-- list of centre numbers: indonesia owned 60–90, iraq owned 40–51. That is one
-- customer's roster written into the program. A company that buys the system
-- brings its own pilgrims and its own centre numbering, and cannot ship a
-- release to say so.
--
-- Two facts from the existing data shaped this schema, and neither is an edge
-- case invented here:
--
--   * Centre 26 serves Afghan pilgrims AND pilgrims from the Comoros. A single
--     nationality column on centers would have to throw one of them away, so
--     the link is a join table.
--
--   * Bangladesh appears twice — centres 7–8 and centres 101–102 — because the
--     two groups eat different menus. So the menu hangs off the nationality
--     ROW, not off a nationality NAME: two rows may share a name and still own
--     separate menus. What tells them apart on screen is their centres.

CREATE TABLE IF NOT EXISTS public.nationalities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid REFERENCES public.seasons(id) ON DELETE CASCADE,

  name        text NOT NULL,          -- 'بنغلاديش' — may repeat within a season
  flag        text,                   -- emoji, shown on the chip
  color       text,                   -- '#B84A5E', for the chip and the charts

  -- Ties a row back to a menu compiled into config/menus.js ('indonesia').
  -- Null for anything a customer adds: it simply starts with no menu, which is
  -- the truth, rather than borrowing another operator's dishes.
  legacy_key  text,

  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nationalities_season_idx
  ON public.nationalities (season_id, sort_order);

-- Which centres feed which pilgrims. Many-to-many, because centre 26 is.
CREATE TABLE IF NOT EXISTS public.center_nationalities (
  center_id      uuid NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  nationality_id uuid NOT NULL REFERENCES public.nationalities(id) ON DELETE CASCADE,
  PRIMARY KEY (center_id, nationality_id)
);

CREATE INDEX IF NOT EXISTS center_nationalities_nat_idx
  ON public.center_nationalities (nationality_id);

-- ── menus now hang off a nationality row ──────────────────────────────────
--
-- 008 keyed a menu by a nationality *string* plus a season. With nationalities
-- as rows, the row already carries its season, and pointing at it is what makes
-- two Bangladesh groups able to own different menus. The table is empty at this
-- point, so this is a correction, not a migration of data.
ALTER TABLE public.menus DROP CONSTRAINT IF EXISTS menus_season_id_fkey;
DROP INDEX IF EXISTS public.menus_slot_key;
DROP INDEX IF EXISTS public.menus_season_nat_idx;

ALTER TABLE public.menus DROP COLUMN IF EXISTS nationality;
ALTER TABLE public.menus DROP COLUMN IF EXISTS season_id;
ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS nationality_id uuid
  REFERENCES public.nationalities(id) ON DELETE CASCADE;

-- One menu per group per day per meal. No COALESCE dance is needed now: a menu
-- without a nationality is meaningless, so the column is simply required.
ALTER TABLE public.menus ALTER COLUMN nationality_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menus_slot_key
  ON public.menus (nationality_id, day, meal);

-- ── policies, matching the rest of the schema ─────────────────────────────
ALTER TABLE public.nationalities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_nationalities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nationalities_all ON public.nationalities;
CREATE POLICY nationalities_all ON public.nationalities
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS center_nationalities_all ON public.center_nationalities;
CREATE POLICY center_nationalities_all ON public.center_nationalities
  FOR ALL USING (true) WITH CHECK (true);
