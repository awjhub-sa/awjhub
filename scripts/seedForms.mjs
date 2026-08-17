/**
 * scripts/seedForms.mjs
 * Loads src/config/standardForms.js into public.form_templates.
 *
 * Upserts on `key`, so re-running refreshes a standard form after it is edited
 * in the source file. Templates the customer created themselves have no key and
 * are never touched.
 *
 * Run:  node scripts/seedForms.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createClient } from '@supabase/supabase-js';
import { validateForm, keysOwnedBy } from '../src/config/formSchema.js';

const __dir = dirname(fileURLToPath(import.meta.url));

function readEnv(file) {
  const raw = readFileSync(file, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnv(join(__dir, '../.env'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });

const { STANDARD_FORMS } = await import(pathToFileURL(join(__dir, '../src/config/standardForms.js')).href);

console.log(`Project: ${env.VITE_SUPABASE_URL}`);
console.log(`Templates: ${STANDARD_FORMS.length}\n`);

let bad = 0;
for (const f of STANDARD_FORMS) {
  /* A token naming a field that does not exist prints as a literal {{key}} in
     the PDF, so catch it here rather than in front of a caterer. */
  const errors = validateForm(f.definition, {});
  const tokenErrors = Object.entries(errors).filter(([k]) => k.startsWith('__token_'));

  const bySystem  = keysOwnedBy(f.definition, 'system');
  const byAdmin   = keysOwnedBy(f.definition, 'admin');
  const byCaterer = keysOwnedBy(f.definition, 'caterer');

  console.log(`▸ ${f.title}  (${f.key})`);
  console.log(`  blocks: ${f.definition.blocks.length}`);
  console.log(`  من النظام تلقائياً : ${bySystem.length}  ${bySystem.join(', ') || '—'}`);
  console.log(`  تعبّيه الإدارة      : ${byAdmin.length}  ${byAdmin.join(', ') || '—'}`);
  console.log(`  يعبّيه المتعهد      : ${byCaterer.length}  ${byCaterer.join(', ') || 'يوقّع ويختم فقط'}`);

  if (tokenErrors.length) {
    bad++;
    tokenErrors.forEach(([, msg]) => console.error(`  ❌ ${msg}`));
  } else {
    console.log('  ✅ every token resolves');
  }
  console.log();
}
if (bad) {
  console.error('aborted — fix the templates above');
  process.exit(1);
}

const rows = STANDARD_FORMS.map(f => ({
  key:                 f.key,
  title:               f.title,
  description:         f.description ?? null,
  category:            f.category ?? null,
  definition:          f.definition,
  requires_signature:  f.requiresSignature ?? true,
  requires_attachment: f.requiresAttachment ?? false,
  is_standard:         true,
  active:              true,
  updated_at:          new Date().toISOString(),
}));

const { error } = await supabase.from('form_templates').upsert(rows, { onConflict: 'key' });
if (error) {
  console.error(`❌  upsert failed: ${error.message}`);
  process.exit(1);
}

const { count } = await supabase
  .from('form_templates').select('id', { count: 'exact', head: true }).eq('is_standard', true);

console.log(`✅  form_templates now holds ${count} standard template(s)`);
