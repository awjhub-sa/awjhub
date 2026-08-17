-- 003 — The forms module: templates, assignments, and their event log.
--
-- Three layers, deliberately separate:
--   form_templates    what a form is        (definition, authored once)
--   form_assignments  who owes it and when  (one row per caterer per form)
--   form_events       what happened         (assigned → opened → submitted …)
--
-- Everything the customer asked to measure — did they deliver, on time, how
-- fast did they respond — is a property of an assignment, never of a template.
-- And responsiveness cannot be derived from a status column alone: it needs the
-- interval between two events, which is why form_events exists.
--
-- Run in the Supabase SQL editor. Safe to run twice.

CREATE SEQUENCE IF NOT EXISTS public.form_number_seq START 1;

/* ── Templates ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.form_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 text UNIQUE,        -- slug; set for the standard forms shipped with the system
  title               text NOT NULL,
  description         text,
  category            text,

  /* { blocks: [...], fields: {...} } — blocks lay the document out, fields
     type each blank. See docs/FORMS_MODULE.md. */
  definition          jsonb NOT NULL DEFAULT '{"blocks":[],"fields":{}}'::jsonb,

  requires_signature  boolean NOT NULL DEFAULT true,
  requires_attachment boolean NOT NULL DEFAULT false,
  is_standard         boolean NOT NULL DEFAULT false,  -- seeded, offered as a starting point
  active              boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS form_templates_active_idx   ON public.form_templates (active);
CREATE INDEX IF NOT EXISTS form_templates_category_idx ON public.form_templates (category);

/* ── Assignments ──────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.form_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     uuid REFERENCES public.seasons(id)        ON DELETE CASCADE,
  template_id   uuid REFERENCES public.form_templates(id) ON DELETE RESTRICT,
  caterer_id    uuid REFERENCES public.caterers(id)       ON DELETE CASCADE,
  /* Set when the form is about one specific center rather than the company as
     a whole — a kitchen handover is per center, a liaison appointment is not. */
  center_id     uuid REFERENCES public.centers(id)        ON DELETE SET NULL,

  form_number   text UNIQUE
                  DEFAULT ('FRM-' || LPAD(nextval('form_number_seq'::regclass)::text, 4, '0')),

  due_at        timestamptz,
  assigned_by   uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  assigned_at   timestamptz NOT NULL DEFAULT now(),

  /* Overdue is NOT a status. "submitted but not yet accepted" and "past its due
     date" are independent facts; folding them into one column loses one of
     them. Overdue is computed from due_at and submitted_at. */
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','draft','submitted','accepted','returned')),

  submitted_at  timestamptz,
  reviewed_by   uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  review_note   text,

  data          jsonb  NOT NULL DEFAULT '{}'::jsonb,
  attachments   text[] NOT NULL DEFAULT '{}',
  signature_url text,
  pdf_url       text,

  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS form_assign_season_idx   ON public.form_assignments (season_id);
CREATE INDEX IF NOT EXISTS form_assign_caterer_idx  ON public.form_assignments (caterer_id);
CREATE INDEX IF NOT EXISTS form_assign_template_idx ON public.form_assignments (template_id);
CREATE INDEX IF NOT EXISTS form_assign_status_idx   ON public.form_assignments (status);
CREATE INDEX IF NOT EXISTS form_assign_due_idx      ON public.form_assignments (due_at);

/* No uniqueness is enforced on (season, template, caterer). A form may
   legitimately be required more than once in a season, so the guard against
   double-assignment belongs in the bulk-assign screen — it skips caterers who
   already hold an open copy and reports how many it skipped. A constraint here
   would block the legitimate case to prevent the accidental one. */

/* ── Event log ────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.form_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES public.form_assignments(id) ON DELETE CASCADE,
  event         text NOT NULL
                  CHECK (event IN ('assigned','opened','saved','submitted','returned','accepted','reminded')),
  actor_uid     uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS form_events_assignment_idx ON public.form_events (assignment_id);
CREATE INDEX IF NOT EXISTS form_events_created_idx    ON public.form_events (created_at DESC);

/* ── Caterer login, wired later ───────────────────────────── */
/* One account per caterer company, signing in with email + password. The
   column is added now so the portal is a screen to build, not a migration to
   re-run. */
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS caterer_id uuid
  REFERENCES public.caterers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS users_caterer_idx ON public.users (caterer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND pg_get_constraintdef(oid) LIKE '%caterer%'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE public.users ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin','staff','observer','supervisor','caterer'));
  END IF;
END $$;

/* ── Storage ──────────────────────────────────────────────── */
INSERT INTO storage.buckets (id, name, public)
VALUES ('forms', 'forms', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "forms_read"   ON storage.objects;
DROP POLICY IF EXISTS "forms_upload" ON storage.objects;
CREATE POLICY "forms_read"   ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'forms');
CREATE POLICY "forms_upload" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'forms');

/* ── RLS, matching every other table in this schema ───────── */
ALTER TABLE public.form_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_events      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS form_templates_all   ON public.form_templates;
DROP POLICY IF EXISTS form_assignments_all ON public.form_assignments;
DROP POLICY IF EXISTS form_events_all      ON public.form_events;

CREATE POLICY form_templates_all   ON public.form_templates   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY form_assignments_all ON public.form_assignments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY form_events_all      ON public.form_events      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['form_templates','form_assignments','form_events'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
