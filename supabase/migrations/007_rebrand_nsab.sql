-- 007_rebrand_nsab.sql
--
-- The product is now نصاب / NSAB. Identity lives in org_settings at runtime, so
-- renaming the constants in the code is not enough — the stored row is what
-- BrandContext applies to every screen, and it still said أوج.
--
-- The navy is unchanged. The second colour becomes the gold of the نصاب
-- wordmark, replacing the teal.

ALTER TABLE public.org_settings
  ALTER COLUMN name_ar        SET DEFAULT 'نصاب',
  ALTER COLUMN name_en        SET DEFAULT 'NSAB',
  ALTER COLUMN full_name_ar   SET DEFAULT 'نصاب — نظام الإعاشة',
  ALTER COLUMN full_name_en   SET DEFAULT 'NSAB Catering System',
  ALTER COLUMN tagline        SET DEFAULT 'نظام الإعاشة',
  ALTER COLUMN color_accent    SET DEFAULT '#D8A15C',
  ALTER COLUMN color_accent600 SET DEFAULT '#A9762F',
  ALTER COLUMN color_header    SET DEFAULT '#CC9450';

-- The single existing tenant row. Logo paths are unchanged because the files
-- behind them were replaced, not renamed.
UPDATE public.org_settings SET
  name_ar         = 'نصاب',
  name_en         = 'NSAB',
  full_name_ar    = 'نصاب — نظام الإعاشة',
  full_name_en    = 'NSAB Catering System',
  tagline         = 'نظام الإعاشة',
  color_accent    = '#D8A15C',
  color_accent600 = '#A9762F',
  color_header    = '#CC9450',
  updated_at      = now()
WHERE id = 1;
