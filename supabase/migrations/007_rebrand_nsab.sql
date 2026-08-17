-- 007_rebrand_nsab.sql
--
-- The product is now نصاب | لحلول الإعاشة — NSAB. Identity lives in
-- org_settings at runtime, so renaming the constants in the code is not
-- enough: the stored row is what BrandContext applies to every screen, and it
-- still said أوج.
--
-- Both brand colours come from the wordmark — the navy of نصاب and the gold of
-- NSAB — replacing the old navy-and-teal pair.

ALTER TABLE public.org_settings
  ALTER COLUMN name_ar        SET DEFAULT 'نصاب',
  ALTER COLUMN name_en        SET DEFAULT 'NSAB',
  ALTER COLUMN full_name_ar   SET DEFAULT 'نصاب | لحلول الإعاشة',
  ALTER COLUMN full_name_en   SET DEFAULT 'NSAB Catering System',
  ALTER COLUMN tagline        SET DEFAULT 'لحلول الإعاشة',
  ALTER COLUMN color_primary    SET DEFAULT '#1E3A5F',
  ALTER COLUMN color_primary400 SET DEFAULT '#3E6699',
  ALTER COLUMN color_primary700 SET DEFAULT '#16304E',
  ALTER COLUMN color_accent     SET DEFAULT '#B99A64',
  ALTER COLUMN color_accent600  SET DEFAULT '#8C7038',
  ALTER COLUMN color_header     SET DEFAULT '#B99A64';

-- The single existing tenant row. Logo paths are unchanged because the files
-- behind them were replaced, not renamed.
UPDATE public.org_settings SET
  name_ar          = 'نصاب',
  name_en          = 'NSAB',
  full_name_ar     = 'نصاب | لحلول الإعاشة',
  full_name_en     = 'NSAB Catering System',
  tagline          = 'لحلول الإعاشة',
  color_primary    = '#1E3A5F',
  color_primary400 = '#3E6699',
  color_primary700 = '#16304E',
  color_accent     = '#B99A64',
  color_accent600  = '#8C7038',
  color_header     = '#B99A64',
  updated_at       = now()
WHERE id = 1;
