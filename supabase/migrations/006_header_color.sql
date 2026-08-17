-- 006 — The top bar gets its own colour.
--
-- It was painted with the accent, but the two are used at different scales: the
-- accent marks a 4px indicator or a small badge, while the bar is a flat field
-- across the full width. A shade that reads well as a mark can be a degree too
-- bright as a field, so the bar needs its own value rather than a shared one.
--
-- Nullable on purpose: an empty value falls back to the accent, so a tenant who
-- never opens this setting still gets a bar that matches their palette.

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS color_header text DEFAULT '#29D4BB';
