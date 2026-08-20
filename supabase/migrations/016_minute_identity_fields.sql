-- 016_minute_identity_fields.sql
--
-- The blanks the readiness minute fills from the company's own record.
--
-- They describe the service company itself and are the same on every centre's
-- minute, so they belong to the single identity row rather than being retyped
-- on sixty-seven centres and got wrong on at least one.
--
-- The table is public.org_settings. The file that created it is named
-- 005_org_identity.sql, which is why an earlier draft of this migration
-- targeted a table that has never existed.
--
-- Nothing else is needed. The centre's head is already a row in
-- center_officials flagged primary, and the caterer's name, capacity and ID
-- number are already columns on public.caterers — the minute reads all three
-- where they live rather than copying them.

ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS license_number text;  -- رقم الترخيص
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS facility_name  text;  -- اسم المنشأة
ALTER TABLE public.org_settings ADD COLUMN IF NOT EXISTS murabba        text;  -- رقم المربع

COMMENT ON COLUMN public.org_settings.license_number IS 'رقم ترخيص شركة تقديم الخدمة — يظهر في محاضر الجاهزية';
COMMENT ON COLUMN public.org_settings.facility_name  IS 'اسم المنشأة كما يظهر في محاضر الجاهزية';
COMMENT ON COLUMN public.org_settings.murabba        IS 'رقم المربع كما يظهر في محاضر الجاهزية';
