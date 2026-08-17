/**
 * scripts/seedCaterers.mjs
 * Loads the sample season from src/config/centers.js into seasons, caterers,
 * centers and center_officials.
 *
 * This is demo data, not production data. A real customer starts with empty
 * tables and enters their own caterers and their own centers for the season
 * they were granted — which is why every center row is tied to a season here
 * rather than existing on its own.
 *
 * centers.js stays in the app as the legacy fallback; after this runs the
 * database is what the admin screens read and write.
 *
 * Idempotent: upserts on the natural keys (seasons.name, caterers.name,
 * centers season+code). Never deletes.
 *
 * Run:  node scripts/seedCaterers.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));

/* The season this sample data belongs to. */
const SEASON = { name: '١٤٤٦هـ', hijri_year: 1446, gregorian_year: 2025, is_active: true };

function readEnv(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    console.error(`❌  No .env file at ${file}`);
    process.exit(1);
  }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
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

const supabase = createClient(url, key, { auth: { persistSession: false } });

const die = (label, error) => {
  if (!error) return;
  console.error(`❌  ${label}: ${error.message}`);
  process.exit(1);
};

/* centers.js is plain ESM with no JSX, so node imports it directly. */
const centersUrl = pathToFileURL(join(__dir, '../src/config/centers.js')).href;
const { CENTERS, getShakhis, getLocation } = await import(centersUrl);

console.log(`Project: ${url}`);
console.log(`Season : ${SEASON.name}`);
console.log(`Source : src/config/centers.js — ${CENTERS.length} centers\n`);

/* ── 1. Season ────────────────────────────────────────────── */
const { error: seasonErr } = await supabase
  .from('seasons')
  .upsert(SEASON, { onConflict: 'name' });
die('seasons upsert', seasonErr);

const { data: season, error: seasonReadErr } = await supabase
  .from('seasons').select('id, name').eq('name', SEASON.name).single();
die('seasons read-back', seasonReadErr);
console.log(`✅  season ${season.name}`);

/* ── 2. Caterers ──────────────────────────────────────────── */
const names = [...new Set(CENTERS.map(c => c.caterer).filter(Boolean))].sort();

const { error: catErr } = await supabase
  .from('caterers')
  .upsert(names.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
die('caterers upsert', catErr);

const { data: caterers, error: catReadErr } = await supabase
  .from('caterers').select('id, name');
die('caterers read-back', catReadErr);

const idByName = Object.fromEntries(caterers.map(c => [c.name, c.id]));
console.log(`✅  caterers: ${caterers.length} rows (${names.length} distinct in source)`);

/* ── 3. Centers ───────────────────────────────────────────── */
/* centers.js only ever carried one shakhis and one map link per center, from
   the Mina side. Arafat's equivalents were never in the file, so they stay
   empty for an admin to fill in — inventing them would be worse than blank. */
const rows = CENTERS.map(c => ({
  season_id:             season.id,
  code:                  c.id,
  caterer_id:            idByName[c.caterer] ?? null,
  caterer_name:          c.caterer ?? null,
  shakhis_mina:          getShakhis(c.id),
  kitchen_location_mina: getLocation(c.id),
}));

const orphans = rows.filter(r => !r.caterer_id);
if (orphans.length) {
  console.warn(`⚠️   ${orphans.length} center(s) with no matching caterer:`);
  orphans.forEach(r => console.warn(`     ${r.code} → "${r.caterer_name}"`));
}

const { error: cenErr } = await supabase
  .from('centers')
  .upsert(rows, { onConflict: 'season_id,code' });
die('centers upsert', cenErr);

const { data: centers, error: cenReadErr } = await supabase
  .from('centers').select('id, code, shakhis_mina, kitchen_location_mina').eq('season_id', season.id);
die('centers read-back', cenReadErr);

console.log(`✅  centers: ${centers.length} rows in ${season.name}`);
console.log(`    shakhis (mina)  filled: ${centers.filter(c => c.shakhis_mina).length}/${centers.length}`);
console.log(`    kitchen (mina)  filled: ${centers.filter(c => c.kitchen_location_mina).length}/${centers.length}`);
console.log(`    arafat columns  filled: 0/${centers.length}  (not present in centers.js)`);
console.log('\nDone.');
