-- 017_storage_replace.sql
--
-- Lets a stored file be replaced.
--
-- uploadFile() sends `upsert: true` and most call sites write to a path
-- derived from the record, not from the clock: a signature is always
-- {assignment}/caterer_signature.png. The first write is an INSERT and
-- succeeds; every replacement is an UPDATE, and no bucket had an UPDATE
-- policy — so re-uploading a signature, a stamp or a readiness photo failed
-- with «new row violates row-level security policy», which reads like a
-- permissions bug rather than what it is.
--
-- The grants match the INSERT policies already in force on these buckets;
-- nothing is opened here that was not already open to whoever could write the
-- file in the first place. Tightening all of them belongs with the rest of the
-- security work, not with a bug that stops a caterer replacing a signature
-- they uploaded upside down.

DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['forms', 'brand', 'reports', 'phases'] LOOP
    /* Only for buckets this project actually has. */
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = b) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_update');
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR UPDATE TO anon, authenticated '
        'USING (bucket_id = %L) WITH CHECK (bucket_id = %L)',
        b || '_update', b, b);
    END IF;
  END LOOP;
END $$;
