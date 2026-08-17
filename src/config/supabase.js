import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '❌ Supabase env vars missing. Copy .env.example → .env and fill in the values.\n' +
    '   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

/* Storage bucket names — keep in sync with schema.sql */
export const STORAGE_BUCKETS = {
  reports: 'reports',
  phases:  'phases',
};
