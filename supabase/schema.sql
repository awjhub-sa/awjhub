-- MoraqebWeb schema. Run in Supabase SQL Editor.

DROP TABLE IF EXISTS public.task_completions      CASCADE;
DROP TABLE IF EXISTS public.assigned_tasks        CASCADE;
DROP TABLE IF EXISTS public.meal_phases           CASCADE;
DROP TABLE IF EXISTS public.meal_evaluations      CASCADE;
DROP TABLE IF EXISTS public.mina_readiness        CASCADE;
DROP TABLE IF EXISTS public.arafat_readiness      CASCADE;
DROP TABLE IF EXISTS public.logistics_requests    CASCADE;
DROP TABLE IF EXISTS public.reports               CASCADE;
DROP TABLE IF EXISTS public.users                 CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.reports_number_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS public.logistics_number_seq START 1;

CREATE TABLE public.users (
  uid                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_number          text UNIQUE,
  email              text UNIQUE,
  auth_uid           uuid UNIQUE,
  name               text,
  name_ar            text NOT NULL,
  role               text NOT NULL CHECK (role IN ('admin','staff','observer','supervisor')),
  center             text,
  assigned_centers   text[] DEFAULT '{}',
  caterer            text,
  role_code          text,
  bravo_code         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_role_idx          ON public.users (role);
CREATE INDEX users_center_idx        ON public.users (center);
CREATE INDEX users_id_number_idx     ON public.users (id_number);
CREATE INDEX users_auth_uid_idx      ON public.users (auth_uid);

CREATE TABLE public.reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  observer           text,
  center             text,
  caterer            text,
  meal_type          text,
  report_type        text,
  severity           text,
  description        text,
  report_number      text UNIQUE
                       DEFAULT ('BLG-' || LPAD(nextval('reports_number_seq'::regclass)::text, 4, '0')),
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','in_progress','resolved')),
  status_since       timestamptz NOT NULL DEFAULT now(),
  durations          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  closed_at          timestamptz,
  images             text[]       NOT NULL DEFAULT '{}',
  video_url          text,
  admin_notes        text,
  role               text,
  holy_site          text CHECK (holy_site IN ('mina','arafat')),
  timestamp          timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX reports_status_idx      ON public.reports (status);
CREATE INDEX reports_center_idx      ON public.reports (center);
CREATE INDEX reports_timestamp_idx   ON public.reports ("timestamp" DESC);
CREATE INDEX reports_report_num_idx  ON public.reports (report_number);

CREATE TABLE public.logistics_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  observer           text,
  center             text,
  caterer            text,
  category           text,
  support_type       text NOT NULL CHECK (support_type IN ('internal','external','both')),
  qty_internal       int,
  qty_external       int,
  notes              text,
  request_number     text UNIQUE
                       DEFAULT ('ISN-' || LPAD(nextval('logistics_number_seq'::regclass)::text, 4, '0')),
  report_id          uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  report_number      text,
  report_type        text,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','delivered','rejected')),
  status_since       timestamptz NOT NULL DEFAULT now(),
  durations          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  closed_at          timestamptz,
  admin_notes        text,
  role               text,
  holy_site          text CHECK (holy_site IN ('mina','arafat')),
  timestamp          timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX logistics_status_idx     ON public.logistics_requests (status);
CREATE INDEX logistics_center_idx     ON public.logistics_requests (center);
CREATE INDEX logistics_timestamp_idx  ON public.logistics_requests ("timestamp" DESC);
CREATE INDEX logistics_request_num_idx ON public.logistics_requests (request_number);
CREATE INDEX logistics_report_id_idx  ON public.logistics_requests (report_id);

CREATE TABLE public.meal_evaluations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  observer           text,
  center             text,
  caterer            text,
  meal_type          text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner')),
  meal_category      text CHECK (meal_category IN ('cooked','dry','sterilized')),
  answers            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  total_score        numeric,
  max_score          numeric,
  score_out_of10     numeric,
  percentage         numeric,
  scheduled_date     text,
  timestamp          timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX meal_eval_center_idx        ON public.meal_evaluations (center);
CREATE INDEX meal_eval_meal_type_idx     ON public.meal_evaluations (meal_type);
CREATE INDEX meal_eval_scheduled_idx     ON public.meal_evaluations (scheduled_date);
CREATE INDEX meal_eval_timestamp_idx     ON public.meal_evaluations ("timestamp" DESC);

CREATE TABLE public.mina_readiness (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  observer           text,
  center             text,
  caterer            text,
  role               text,
  answers            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  total_score        numeric,
  max_score          numeric,
  score_out_of10     numeric,
  percentage         numeric,
  scheduled_date     text,
  timestamp          timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX mina_readiness_center_idx     ON public.mina_readiness (center);
CREATE INDEX mina_readiness_timestamp_idx  ON public.mina_readiness ("timestamp" DESC);

CREATE TABLE public.arafat_readiness (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  observer           text,
  center             text,
  caterer            text,
  role               text,
  answers            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  total_score        numeric,
  max_score          numeric,
  score_out_of10     numeric,
  percentage         numeric,
  scheduled_date     text,
  timestamp          timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX arafat_readiness_center_idx     ON public.arafat_readiness (center);
CREATE INDEX arafat_readiness_timestamp_idx  ON public.arafat_readiness ("timestamp" DESC);

-- One row per (center, day, meal). PK preserves the legacy docID pattern.
CREATE TABLE public.meal_phases (
  id                 text PRIMARY KEY,
  center             text NOT NULL,
  day                text NOT NULL,
  meal_id            text NOT NULL CHECK (meal_id IN ('breakfast','lunch','dinner')),
  phase1             timestamptz,
  phase2             timestamptz,
  phase3             timestamptz,
  phase1_photo       text,
  phase2_photo       text,
  phase3_photo       text,
  phase1_uid         uuid,
  phase2_uid         uuid,
  phase3_uid         uuid,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meal_phases_center_idx     ON public.meal_phases (center);
CREATE INDEX meal_phases_day_idx        ON public.meal_phases (day);

CREATE TABLE public.assigned_tasks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_types            text[] NOT NULL DEFAULT '{}',
  meal_types            text[] DEFAULT '{}',
  meal_categories       text[] DEFAULT '{}',
  target_nationalities  text[] DEFAULT '{}',
  target_centers        text[] NOT NULL DEFAULT '{}',
  scheduled_date        text   NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assigned_tasks_centers_gin   ON public.assigned_tasks USING GIN (target_centers);
CREATE INDEX assigned_tasks_types_gin     ON public.assigned_tasks USING GIN (task_types);
CREATE INDEX assigned_tasks_created_idx   ON public.assigned_tasks (created_at DESC);

CREATE TABLE public.task_completions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            uuid REFERENCES public.assigned_tasks(id) ON DELETE SET NULL,
  uid                uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  observer_name      text,
  center             text,
  task_type          text,
  meal_type          text,
  meal_category      text,
  scheduled_date     text,
  timestamp          timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX task_completions_center_idx    ON public.task_completions (center);
CREATE INDEX task_completions_task_id_idx   ON public.task_completions (task_id);
CREATE INDEX task_completions_uid_idx       ON public.task_completions (uid);
CREATE INDEX task_completions_timestamp_idx ON public.task_completions ("timestamp" DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('phases', 'phases', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_evaluations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mina_readiness      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arafat_readiness    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_phases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions    ENABLE ROW LEVEL SECURITY;

-- Dev policies: open access. Tighten before production.
DROP POLICY IF EXISTS users_all              ON public.users;
DROP POLICY IF EXISTS reports_all            ON public.reports;
DROP POLICY IF EXISTS logistics_requests_all ON public.logistics_requests;
DROP POLICY IF EXISTS meal_evaluations_all   ON public.meal_evaluations;
DROP POLICY IF EXISTS mina_readiness_all     ON public.mina_readiness;
DROP POLICY IF EXISTS arafat_readiness_all   ON public.arafat_readiness;
DROP POLICY IF EXISTS meal_phases_all        ON public.meal_phases;
DROP POLICY IF EXISTS assigned_tasks_all     ON public.assigned_tasks;
DROP POLICY IF EXISTS task_completions_all   ON public.task_completions;

CREATE POLICY users_all              ON public.users              FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY reports_all            ON public.reports            FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY logistics_requests_all ON public.logistics_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY meal_evaluations_all   ON public.meal_evaluations   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY mina_readiness_all     ON public.mina_readiness     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY arafat_readiness_all   ON public.arafat_readiness   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY meal_phases_all        ON public.meal_phases        FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY assigned_tasks_all     ON public.assigned_tasks     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY task_completions_all   ON public.task_completions   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reports_read"   ON storage.objects;
DROP POLICY IF EXISTS "reports_upload" ON storage.objects;
DROP POLICY IF EXISTS "phases_read"    ON storage.objects;
DROP POLICY IF EXISTS "phases_upload"  ON storage.objects;

CREATE POLICY "reports_read"   ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'reports');
CREATE POLICY "reports_upload" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'reports');
CREATE POLICY "phases_read"    ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'phases');
CREATE POLICY "phases_upload"  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'phases');

ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mina_readiness;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arafat_readiness;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_phases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assigned_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
