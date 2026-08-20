/**
 * scripts/migrateFromOld.mjs
 * Copies every row from the previous Supabase project into the one configured
 * in .env. Safe to re-run: rows are upserted on their primary key.
 *
 * The old project's credentials come from the environment so they are never
 * written to disk:
 *
 *   $env:OLD_SUPABASE_URL      = "https://frbdrqazvclwdfgreqdv.supabase.co"
 *   $env:OLD_SUPABASE_ANON_KEY = "..."
 *   node scripts/migrateFromOld.mjs
 *
 * Pass --dry-run to read and report without writing anything.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient }  from '@supabase/supabase-js';

const __dir   = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

/* Ordered so a table's foreign-key targets are always inserted first:
   users and assigned_tasks are referenced by nearly everything, and
   logistics_requests points at reports. */
const TABLES = [
  { name: 'users',              pk: 'uid' },
  { name: 'assigned_tasks',     pk: 'id'  },
  { name: 'reports',            pk: 'id'  },
  { name: 'logistics_requests', pk: 'id'  },
  { name: 'meal_evaluations',   pk: 'id'  },
  { name: 'mina_readiness',     pk: 'id'  },
  { name: 'arafat_readiness',   pk: 'id'  },
  { name: 'meal_phases',        pk: 'id'  },
  { name: 'task_completions',   pk: 'id'  },
];

const PAGE  = 1000;   // PostgREST caps a single response at 1000 rows
const BATCH = 500;

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env    = readEnv(join(__dir, '../.env'));
const newUrl = env.VITE_SUPABASE_URL;
const newKey = env.VITE_SUPABASE_ANON_KEY;
const oldUrl = process.env.OLD_SUPABASE_URL;
const oldKey = process.env.OLD_SUPABASE_ANON_KEY;

if (!oldUrl || !oldKey) {
  console.error('❌  OLD_SUPABASE_URL / OLD_SUPABASE_ANON_KEY are not set in the environment.');
  process.exit(1);
}
if (!newUrl || !newKey) {
  console.error('❌  .env is missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}
if (oldUrl === newUrl) {
  console.error('❌  Source and destination are the same project. Aborting.');
  process.exit(1);
}

const opts = { auth: { persistSession: false } };
const src  = createClient(oldUrl, oldKey, opts);
const dst  = createClient(newUrl, newKey, opts);

console.log(`FROM  ${oldUrl}`);
console.log(`TO    ${newUrl}`);
console.log(DRY_RUN ? '\n-- DRY RUN: nothing will be written --\n' : '');

/* The two projects' schemas need not match exactly. Reading the column list
   up front would mean introspecting /rest/v1/, which only a secret key may
   do — too much privilege to ask for just to copy rows. Instead, insert
   everything and let PostgREST name the columns the destination lacks, then
   drop those and retry. Self-correcting, and a publishable key is enough. */
const MISSING_COL = /Could not find the '(.+?)' column/;

async function upsertAdapting(table, rows, pk, dropped) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const { error } = await dst.from(table).upsert(rows, { onConflict: pk });
    if (!error) return null;

    const m = error.message.match(MISSING_COL);
    if (!m) return error.message;

    dropped.add(m[1]);
    for (const r of rows) delete r[m[1]];
  }
  return 'too many unknown columns';
}

const summary = [];
let hardFail  = 0;

for (const { name, pk } of TABLES) {
  /* Read every page before writing so a partial read cannot look like a
     complete migration. */
  const rows = [];
  let readErr = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await src
      .from(name).select('*').order(pk, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { readErr = error.message; break; }
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  if (readErr) {
    console.log(`❌ ${name.padEnd(20)} read failed — ${readErr}`);
    summary.push({ table: name, read: 0, written: 0, note: readErr });
    hardFail++;
    continue;
  }

  const dropped = new Set();
  let written = 0;
  let writeErr = null;

  if (!DRY_RUN) {
    for (let i = 0; i < rows.length; i += BATCH) {
      writeErr = await upsertAdapting(name, rows.slice(i, i + BATCH), pk, dropped);
      if (writeErr) break;
      written += Math.min(BATCH, rows.length - i);
    }
  }

  if (writeErr) {
    console.log(`❌ ${name.padEnd(20)} write failed after ${written} row(s) — ${writeErr}`);
    hardFail++;
  } else {
    const note = dropped.size ? `dropped: ${[...dropped].join(', ')}` : '';
    console.log(`✅ ${name.padEnd(20)} read ${String(rows.length).padStart(5)}  wrote ${String(written).padStart(5)}  ${note}`);
  }
  summary.push({ table: name, read: rows.length, written, note: writeErr || [...dropped].join(', ') });
}

/* report_number / request_number default to nextval(). Copying rows does not
   advance those sequences, so the next insert would reuse BLG-0001 and trip
   the UNIQUE constraint. Emit the setval statements to run in the SQL Editor. */
async function maxNumber(table, column, prefix) {
  const { data } = await dst.from(table).select(column).order(column, { ascending: false }).limit(1);
  const val = data?.[0]?.[column];
  if (!val) return 0;
  const n = parseInt(String(val).replace(prefix, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

if (!DRY_RUN) {
  const seqs = [
    ['public.reports_number_seq',   await maxNumber('reports', 'report_number', 'BLG-')],
    ['public.logistics_number_seq', await maxNumber('logistics_requests', 'request_number', 'ISN-')],
  ].filter(([, max]) => max > 0);   // nothing migrated → leave the sequence at 1

  if (seqs.length) {
    console.log('\nRun this in the SQL Editor so new records do not collide:');
    for (const [seq, max] of seqs) console.log(`  SELECT setval('${seq}', ${max}, true);`);
  }
}

console.log('\n' + (hardFail ? `❌  ${hardFail} table(s) failed.` : '✅  Migration finished.'));
console.table(summary);
process.exit(hardFail ? 1 : 0);
