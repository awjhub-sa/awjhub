-- 010_caterer_evaluations.sql
--
-- One evaluation per caterer per season.
--
-- The criteria and their weights live in src/config/catererScoring.js, taken
-- from the workbook the operation already runs on. They are columns here rather
-- than a JSON blob because they are a fixed, agreed list that reports group and
-- average by — a blob would push that work into every reader.
--
-- Every column is nullable, and that is the point: three of these are computed
-- from inspections the system already holds, and are only written here when a
-- person overrides the computed value. NULL means "no one has argued with the
-- number the system worked out", not "zero".

CREATE TABLE IF NOT EXISTS public.caterer_evaluations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  caterer_id  uuid NOT NULL REFERENCES public.caterers(id) ON DELETE CASCADE,

  -- قبل الموسم — 35
  pre_response     numeric(5,2),   -- تجاوب المتعهد    / 5
  mina_ready       numeric(5,2),   -- جاهزية منى       / 15  (يُحسب)
  arafat_ready     numeric(5,2),   -- جاهزية عرفة      / 5   (يُحسب)
  ops_plan         numeric(5,2),   -- الخطة التشغيلية  / 5
  kerosene         numeric(5,2),   -- شهادة الكيروسين  / 5

  -- أثناء الموسم — 50
  meal_score       numeric(5,2),   -- تقييم الوجبات    / 30  (يُحسب)
  during_response  numeric(5,2),   -- تجاوب المتعهد    / 5
  support          numeric(5,2),   -- طلبات الإسناد    / 10
  supervisor       numeric(5,2),   -- تقييم المشرف     / 5

  -- بعد الموسم — 15
  disposal         numeric(5,2),   -- محضر إتلاف       / 5
  final_report     numeric(5,2),   -- تقرير ختامي      / 10

  notes       text,
  updated_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One card per caterer per season. Over COALESCE for the same reason as the
-- menus table: an installation with no season yet must not collect two.
CREATE UNIQUE INDEX IF NOT EXISTS caterer_evaluations_slot
  ON public.caterer_evaluations
     (COALESCE(season_id, '00000000-0000-0000-0000-000000000000'::uuid), caterer_id);

ALTER TABLE public.caterer_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS caterer_evaluations_all ON public.caterer_evaluations;
CREATE POLICY caterer_evaluations_all ON public.caterer_evaluations
  FOR ALL USING (true) WITH CHECK (true);
