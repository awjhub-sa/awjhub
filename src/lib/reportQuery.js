/**
 * src/lib/reportQuery.js
 *
 * The query half of the reports centre: given a source declaration, a set of
 * filters and a column selection, produce the rows that belong in the report.
 *
 * This lives outside the pages because two screens need the identical answer —
 * the picker, which shows a preview, and the report tab, which renders the
 * document. If each kept its own copy the preview would eventually disagree
 * with the thing it claims to preview.
 */

import { cellValue, dhuDayOf, SOURCE_BY_KEY } from '../config/reportSources.js';

export const AR_NUM = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

/* Centres sort by their number, not their label: a string sort puts مركز ١٠٢
   between مركز ١٠ and مركز ١١. The suffix (أ / ب) breaks ties. */
export function compareCenters(a, b) {
  const n = s => parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10) || 0;
  return n(a) - n(b) || String(a ?? '').localeCompare(String(b ?? ''), 'ar');
}

/** A readiness record's score on a 0–10 scale, whichever field carries it. */
export function scoreOf(rec) {
  if (rec?.scoreOutOf10 != null) return Number(rec.scoreOutOf10);
  const max = Number(rec?.maxScore), tot = Number(rec?.totalScore);
  if (max > 0 && !isNaN(tot)) return (tot / max) * 10;
  const pct = parseFloat(rec?.percentage);
  return isNaN(pct) ? null : pct / 10;
}

export const BANDS = [
  { min: 8, label: 'ممتاز', color: '#15803D', soft: '#F0FDF4', line: '#BBF7D0' },
  { min: 6, label: 'مقبول', color: '#B45309', soft: '#FFFBEB', line: '#FDE68A' },
  { min: 0, label: 'ضعيف',  color: '#B91C1C', soft: '#FEF2F2', line: '#FECACA' },
];
export const bandOf = (score) =>
  BANDS.find(b => Number(score) >= b.min) || BANDS[BANDS.length - 1];

/** id → label dictionaries the `lookup` columns resolve against. */
export function buildLookups({ caterers = [], centers = [], templates = [] }) {
  return {
    caterer:  Object.fromEntries(caterers.map(c => [c.id, c.name])),
    center:   Object.fromEntries(centers.map(c => [c.id, c.code])),
    template: Object.fromEntries(templates.map(t => [t.id, t.title])),
  };
}

const has = (s, f) => s.filters?.includes(f);

export function filterRows(source, rows, { filters = {}, search = '', lookups = {} } = {}) {
  const q = String(search).trim();
  const fromMs = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const toMs   = filters.to   ? new Date(`${filters.to}T23:59:59`).getTime()   : null;

  return (rows || []).filter(r => {
    if (has(source, 'date') && (fromMs || toMs)) {
      const raw = r[source.dateField];
      const ms = raw?.toMillis?.() ?? (raw ? new Date(raw).getTime() : null);
      if (ms == null) return false;
      if (fromMs && ms < fromMs) return false;
      if (toMs   && ms > toMs)   return false;
    }
    if (has(source, 'dhuDay') && filters.dhuDay) {
      if (dhuDayOf(r[source.dateField]) !== Number(filters.dhuDay)) return false;
    }
    if (has(source, 'season') && filters.season && r.seasonId !== filters.season) return false;
    if (has(source, 'center') && filters.center
        && (r.center ?? lookups.center?.[r.centerId]) !== filters.center) return false;
    if (has(source, 'caterer') && filters.caterer) {
      const name = r.caterer ?? r.catererName ?? lookups.caterer?.[r.catererId] ?? r.name;
      if (name !== filters.caterer) return false;
    }
    if ((has(source, 'status') || has(source, 'formStatus') || has(source, 'catererStatus'))
        && filters.status && r.status !== filters.status) return false;
    if (has(source, 'role') && filters.role && r.role !== filters.role) return false;

    if (q && !source.columns.map(c => cellValue(c, r, lookups)).join(' ').includes(q)) return false;
    return true;
  });
}

/** Matching records, in centre order where the source is keyed by centre. */
export function sortedRecords(source, rows, opts) {
  const out = filterRows(source, rows, opts);
  return out.some(r => r.center || r.code)
    ? [...out].sort((a, b) => compareCenters(a.center ?? a.code, b.center ?? b.code))
    : out;
}

/**
 * A source reduced to a printable table.
 *
 * Detailed mode turns each evaluation into one row per question, which is what
 * makes a report usable as evidence: the score alone does not say which
 * criterion failed.
 */
export function buildTable(source, rows, { filters, search, lookups, cols, detailed } = {}) {
  const records = sortedRecords(source, rows, { filters, search, lookups });
  const chosen = cols?.[source.key] || source.defaultColumns;
  const active = source.columns.filter(c => chosen.includes(c.key));

  if (detailed && source.questions?.length) {
    const idCols = active.filter(c => ['center', 'caterer', 'observer', 'mealType'].includes(c.key));
    const columns = [...idCols.map(c => c.label), 'المعيار', 'الإجابة'];
    const body = [];
    for (const r of records) {
      const answers = r.answers || {};
      for (const qn of source.questions) {
        const a = answers[qn.id] ?? answers[String(qn.id)];
        if (a === undefined || a === null || a === '') continue;
        body.push([
          ...idCols.map(c => String(cellValue(c, r, lookups) ?? '')),
          qn.text ?? qn.label ?? String(qn.id),
          a === true ? 'نعم' : a === false ? 'لا' : String(a),
        ]);
      }
    }
    return { columns, rows: body, count: records.length, records };
  }

  return {
    columns: active.map(c => c.label),
    rows: records.map(r => active.map(c => String(cellValue(c, r, lookups) ?? ''))),
    count: records.length,
    records,
  };
}

/** The one-line description of what the reader is looking at. */
export function describeFilters({ filters = {}, detailed, seasons = [], totalRows }) {
  const bits = [];
  if (filters.from || filters.to) bits.push(`من ${filters.from || '—'} إلى ${filters.to || '—'}`);
  if (filters.dhuDay) bits.push(`${AR_NUM(filters.dhuDay)} ذو الحجة`);
  if (filters.season) bits.push(`موسم ${seasons.find(s => s.id === filters.season)?.name || ''}`);
  if (filters.center)  bits.push(filters.center);
  if (filters.caterer) bits.push(filters.caterer);
  if (detailed) bits.push('عرض مفصّل');
  if (totalRows != null) bits.push(`${AR_NUM(totalRows)} سجل`);
  return bits.join(' · ');
}

/* ── Handing the report to the next tab ───────────────────────
   The viewer opens in its own tab, so the selection has to survive the trip.
   A URL would have to carry a dozen filters and a column list; localStorage
   carries the object itself and the URL carries only its key. */
const SLOT = 'awj.report.request';

export function stashReportRequest(config) {
  const id = `r${Date.now().toString(36)}`;
  try {
    localStorage.setItem(`${SLOT}.${id}`, JSON.stringify(config));
  } catch { /* private mode — the viewer will report the miss */ }
  return id;
}

export function readReportRequest(id) {
  try {
    const raw = localStorage.getItem(`${SLOT}.${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* Old requests are dead weight: the tab that needed them has been opened. */
export function pruneReportRequests(keep) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${SLOT}.`) && k !== `${SLOT}.${keep}`) localStorage.removeItem(k);
    }
  } catch { /* nothing to clean */ }
}

/** Excel opens CSV directly; the BOM is what stops it mangling Arabic. */
export function exportCsv({ columns, rows, fileName = 'report.csv' }) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [columns, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export { SOURCE_BY_KEY };
