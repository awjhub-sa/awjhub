-- 002 — Seasons, and the real field sets for caterers and centers.
--
-- Migration 001 modelled a center as a permanent thing keyed by its Arabic
-- label. That is wrong for this business: a Hajj company is granted different
-- centers every year, so two seasons can both contain "مركز 5" and they are not
-- the same center. A center therefore needs its own key, a season, and a code —
-- with the code carrying the legacy string so `center text` on reports,
-- evaluations and readiness rows still resolves.
--
-- The field lists come from the customer's own two sheets (البيانات المركزية،
-- الورقة4 و الورقة5), so an owner can type what they already have on paper.
--
-- centers and center_officials are rebuilt rather than altered: they hold only
-- seeded sample data, and re-keying a table in place is not worth the risk.
-- caterers is altered in place — it is the same entity, just fuller.
--
-- Run in the Supabase SQL editor. Safe to run twice.

/* ── Seasons ──────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.seasons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text UNIQUE NOT NULL,     -- '١٤٤٧هـ'
  hijri_year      int,
  gregorian_year  int,
  is_active       boolean NOT NULL DEFAULT false,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seasons_active_idx ON public.seasons (is_active);

/* Exactly one season may be the active one; the app reads it to decide what a
   fresh screen shows. Enforced here rather than in the UI so a stray update
   cannot leave two seasons active. */
CREATE UNIQUE INDEX IF NOT EXISTS seasons_single_active_idx
  ON public.seasons ((is_active)) WHERE is_active;

/* ── Caterers: the owner/licence fields the sheet asks for ── */
ALTER TABLE public.caterers ADD COLUMN IF NOT EXISTS municipal_license text;  -- رقم الرخصة (بلدي)
ALTER TABLE public.caterers ADD COLUMN IF NOT EXISTS address           text;  -- العنوان الرئيسي
ALTER TABLE public.caterers ADD COLUMN IF NOT EXISTS owner_name        text;  -- الاسم الرباعي (المالك)
ALTER TABLE public.caterers ADD COLUMN IF NOT EXISTS owner_capacity    text;  -- الصفة
ALTER TABLE public.caterers ADD COLUMN IF NOT EXISTS owner_id_number   text;  -- رقم الهوية
ALTER TABLE public.caterers ADD COLUMN IF NOT EXISTS owner_phone       text;  -- رقم التواصل

/* contact_* was a guess made before the sheet arrived. The sheet is specific:
   these are ضابط الاتصال, and the email belongs to the company, not to him. */
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='caterers' AND column_name='contact_name') THEN
    ALTER TABLE public.caterers RENAME COLUMN contact_name  TO liaison_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='caterers' AND column_name='contact_phone') THEN
    ALTER TABLE public.caterers RENAME COLUMN contact_phone TO liaison_phone;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='caterers' AND column_name='contact_email') THEN
    ALTER TABLE public.caterers RENAME COLUMN contact_email TO email;
  END IF;
END $$;

/* ── Centers, re-keyed and season-scoped ──────────────────── */
DROP TABLE IF EXISTS public.center_officials CASCADE;
DROP TABLE IF EXISTS public.centers          CASCADE;

CREATE TABLE public.centers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id               uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  code                    text NOT NULL,   -- رقم المركز — the legacy `center text` value
  caterer_id              uuid REFERENCES public.caterers(id) ON DELETE SET NULL,
  caterer_name            text,            -- denormalised for cheap legacy reads

  facility_name           text,            -- اسم المنشأة
  facility_license        text,            -- رقم الترخيص

  pilgrims_count          int,             -- عدد الحجاج
  pilgrims_nationality    text,            -- جنسية الحجاج
  category                text,            -- الفئة

  shakhis_mina            text,            -- رقم الشاخص (منى)
  shakhis_arafat          text,            -- رقم الشاخص (عرفة)
  murabba_mina            text,            -- رقم المربع (منى)
  kitchen_location_mina   text,            -- موقع المطبخ (منى)
  kitchen_location_arafat text,            -- موقع المطبخ (عرفة)

  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),

  /* Same label in two seasons is two different centers; same label twice in
     one season is a data-entry mistake. */
  UNIQUE (season_id, code)
);
CREATE INDEX centers_season_idx  ON public.centers (season_id);
CREATE INDEX centers_caterer_idx ON public.centers (caterer_id);
CREATE INDEX centers_code_idx    ON public.centers (code);

CREATE TABLE public.center_officials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   uuid REFERENCES public.centers(id) ON DELETE CASCADE,
  name        text NOT NULL,               -- اسم رئيس المركز
  role        text,                        -- رئيس مركز / مشرف نوبة / ضابط اتصال
  phone       text,                        -- رقم التواصل
  email       text,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX center_officials_center_idx ON public.center_officials (center_id);

/* ── RLS, matching every other table in this schema ───────── */
ALTER TABLE public.seasons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_officials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seasons_all          ON public.seasons;
DROP POLICY IF EXISTS centers_all          ON public.centers;
DROP POLICY IF EXISTS center_officials_all ON public.center_officials;

CREATE POLICY seasons_all          ON public.seasons          FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY centers_all          ON public.centers          FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY center_officials_all ON public.center_officials FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['seasons','centers','center_officials'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
