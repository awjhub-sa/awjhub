-- 004 — Standard forms cannot be deleted.
--
-- The forms every Hajj company already uses ship with the system as a library.
-- A customer adapts one by copying it, never by editing or removing the
-- original — otherwise a later update has nothing to refresh, and a colleague
-- who deletes one takes it away from everyone.
--
-- Enforced by a trigger rather than by the UI alone: RLS on this project is
-- wide open, so any client holding the publishable key could otherwise delete
-- the library outright. A promise the database does not keep is not a promise.
--
-- UPDATE stays allowed so scripts/seedForms.mjs can refresh the library when
-- new standard forms are added. Editing is blocked in the admin screen, which
-- offers the copy path instead.

CREATE OR REPLACE FUNCTION public.protect_standard_forms()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_standard THEN
    RAISE EXCEPTION 'النماذج الجاهزة لا تُحذف — انسخها ثم عدّل النسخة';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_standard_forms_del ON public.form_templates;
CREATE TRIGGER protect_standard_forms_del
  BEFORE DELETE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.protect_standard_forms();
