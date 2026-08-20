-- 008_menus.sql
--
-- The menu moves out of the source and into the database.
--
-- It was compiled in: one company's dishes, edited by editing a file. The
-- system is sold to more than one company now, and each brings its own
-- nationalities, its own days and its own dishes — none of which anyone can
-- ship a release for.
--
-- One row is one meal: this nationality, this day of Dhul-Hijjah, this sitting.
-- Categories stay exactly as the field forms already know them — main, side,
-- drinks, snacks — so a saved menu drops into the screens that read it without
-- a translation step.

CREATE TABLE IF NOT EXISTS public.menus (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id      uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  nationality    text NOT NULL,        -- key from config/nationalities.js
  day            text NOT NULL,        -- '7'..'13' — day of Dhul-Hijjah
  meal           text NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner')),

  location       text,                 -- منى / عرفات / مزدلفة
  time           text,                 -- free text, e.g. '07:30 ص — 09:30 ص'

  main           text[] NOT NULL DEFAULT '{}',
  side           text[] NOT NULL DEFAULT '{}',
  drinks         text[] NOT NULL DEFAULT '{}',
  snacks         text[] NOT NULL DEFAULT '{}',

  -- Where it came from, so an imported menu can be told from a typed one when
  -- someone asks why a dish is spelled oddly. source_file holds the name of the
  -- uploaded sheet, not the sheet itself.
  source         text DEFAULT 'manual' CHECK (source IN ('manual', 'excel', 'image')),
  source_file    text,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- One menu per nationality per day per meal per season.
--
-- Written over COALESCE rather than over season_id directly: a plain UNIQUE
-- treats NULLs as distinct, so an installation that has not created a season
-- yet — every installation, on its first day — could quietly collect two rows
-- for the same meal.
CREATE UNIQUE INDEX IF NOT EXISTS menus_slot_key
  ON public.menus (COALESCE(season_id, '00000000-0000-0000-0000-000000000000'::uuid),
                   nationality, day, meal);

CREATE INDEX IF NOT EXISTS menus_season_nat_idx ON public.menus (season_id, nationality);

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

-- Matches the policy every other table in this schema currently carries.
-- See the open item in docs/ROADMAP.md: these all need tightening to
-- authenticated roles before the system ships to a customer.
DROP POLICY IF EXISTS menus_all ON public.menus;
CREATE POLICY menus_all ON public.menus FOR ALL USING (true) WITH CHECK (true);
