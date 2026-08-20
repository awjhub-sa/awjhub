-- 005 — Tenant identity moves out of the source and into the database.
--
-- brand.js and the --c-* variables in index.css are build-time constants, so
-- every customer needed their own build and their own deploy, and only a
-- developer could change a logo. That does not scale to selling the product.
--
-- After this migration the identity is a row: name, logos, colours. The app
-- reads it at startup and writes the colours onto :root as CSS variables, so
-- every screen, badge and generated document follows without a single
-- component knowing which company it is serving.
--
-- brand.js stays as the fallback for a fresh install and for the first paint
-- before the row arrives.
--
-- Run in the Supabase SQL editor. Safe to run twice.

CREATE TABLE IF NOT EXISTS public.org_settings (
  id               int PRIMARY KEY DEFAULT 1,

  /* Identity */
  name_ar          text NOT NULL DEFAULT 'أوج',
  name_en          text NOT NULL DEFAULT 'AWJ',
  full_name_ar     text,
  full_name_en     text,
  tagline          text,

  /* Logos — public URLs in the `brand` bucket */
  logo_full        text,   -- horizontal lockup, dark text  → light surfaces
  logo_on_dark     text,   -- horizontal lockup, white text → navy surfaces
  logo_square      text,   -- square lockup, tight slots
  logo_mark        text,   -- letters only, favicon sizes

  /* Palette, hex. Split into channels by the client before they are written
     onto :root, because Tailwind's opacity modifiers need "R G B" triplets. */
  color_primary     text NOT NULL DEFAULT '#1B2A4A',
  color_primary_400 text NOT NULL DEFAULT '#3D5A8A',
  color_primary_700 text NOT NULL DEFAULT '#101B31',
  color_accent      text NOT NULL DEFAULT '#30D9CB',
  color_accent_600  text NOT NULL DEFAULT '#0D9488',
  color_ink         text NOT NULL DEFAULT '#16233D',

  /* Printed on every generated document */
  cr_number        text,
  vat_number       text,
  address          text,
  phone            text,
  email            text,
  website          text,

  updated_at       timestamptz NOT NULL DEFAULT now(),

  /* One row, always. A settings table that can hold two rows eventually holds
     two rows, and then nobody knows which one is live. */
  CONSTRAINT org_settings_single_row CHECK (id = 1)
);

INSERT INTO public.org_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('brand', 'brand', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "brand_read"   ON storage.objects;
DROP POLICY IF EXISTS "brand_upload" ON storage.objects;
CREATE POLICY "brand_read"   ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'brand');
CREATE POLICY "brand_upload" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'brand');

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_settings_all ON public.org_settings;
CREATE POLICY org_settings_all ON public.org_settings FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='org_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_settings;
  END IF;
END $$;
