/**
 * scripts/checkSupabase.mjs
 * Verifies the .env credentials reach a Supabase project that has schema.sql
 * applied: every table reachable, both storage buckets present, an admin seeded.
 *
 * Run:  node scripts/checkSupabase.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient }  from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));

/* Minimal .env reader — the app relies on Vite for this, so there is no
   dotenv dependency to lean on here. */
function readEnv(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    console.error(`❌  No .env file at ${file}`);
    console.error('    Copy .env.example → .env and fill in the two values.');
    process.exit(1);
  }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnv(join(__dir, '../.env'));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env');
  process.exit(1);
}
console.log(`Project: ${url}\n`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

/* Must match supabase/schema.sql */
const TABLES = [
  'users', 'reports', 'logistics_requests', 'meal_evaluations',
  'mina_readiness', 'arafat_readiness', 'meal_phases',
  'assigned_tasks', 'task_completions',
];
const BUCKETS = ['reports', 'phases'];

let failures = 0;
const fail = msg => { console.log(`  ❌ ${msg}`); failures++; };

console.log('Tables');
for (const t of TABLES) {
  /* limit(0) rather than head:true — a HEAD response carries no body, so
     supabase-js cannot parse PostgREST's error and reports success with a
     null count for a table that does not exist. */
  const { count, error } = await supabase.from(t).select('*', { count: 'exact' }).limit(0);
  if (error) fail(`${t.padEnd(20)} ${error.message}`);
  else if (count === null) fail(`${t.padEnd(20)} no row count returned — table missing?`);
  else console.log(`  ✅ ${t.padEnd(20)} ${count} row(s)`);
}

console.log('\nStorage buckets');
for (const b of BUCKETS) {
  /* list() returns an empty array whether or not the bucket exists, and
     getBucket() needs a storage.buckets read grant the publishable key does
     not have. Requesting a missing object through the public endpoint is the
     one probe that separates the two cases:
       NoSuchKey    → bucket exists, object does not
       NoSuchBucket → bucket is missing */
  try {
    const res  = await fetch(`${url}/storage/v1/object/public/${b}/__probe__`);
    const body = await res.json().catch(() => ({}));
    if (body.code === 'NoSuchKey') console.log(`  ✅ ${b.padEnd(20)} public bucket present`);
    else fail(`${b.padEnd(20)} ${body.message || `HTTP ${res.status}`}`);
  } catch (e) {
    fail(`${b.padEnd(20)} ${e.message}`);
  }
}

console.log('\nAdmin account');
const { data: admins, error: adminErr } = await supabase
  .from('users').select('email, auth_uid').eq('role', 'admin');
if (adminErr) {
  fail(`could not query users — ${adminErr.message}`);
} else if (!admins.length) {
  fail('no role=admin row yet — run supabase/seed_admin.sql');
} else {
  /* auth.users is not readable with a publishable key, so this only proves a
     public.users row exists — not that a matching Supabase Auth account does.
     AuthContext falls back to an email lookup, so a stale auth_uid (e.g. one
     carried over from another project) still signs in, but the row is not
     really "linked" until that account is created here. */
  for (const a of admins) {
    console.log(`  ✅ ${a.email} — role row present`
      + (a.auth_uid ? ' (auth_uid set; verify the Auth account exists in THIS project)'
                    : ' (no auth_uid — will link on first sign-in)'));
  }
}

console.log(failures ? `\n❌  ${failures} check(s) failed.` : '\n✅  All checks passed.');
process.exit(failures ? 1 : 0);
