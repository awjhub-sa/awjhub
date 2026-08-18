/**
 * src/lib/catererScore.js
 *
 * Turns a season of inspections into one number per caterer.
 *
 * The three derived criteria all follow the same shape: take the inspections
 * belonging to this caterer, reduce them to a mark out of ten, and scale that
 * onto the criterion's own maximum. Readiness takes the LATEST inspection per
 * centre — a centre re-inspected after a fix should count as fixed, or the
 * follow-up visit was pointless. Meal quality takes the average of ALL of them,
 * because there the whole season is the subject.
 *
 * A derived value is a proposal. Anything stored against the criterion wins,
 * and `sources` records which of the two every number came from so the screen
 * can say so and the argument can be had.
 */

import { PHASES, ALL_CRITERIA, gradeOf } from '../config/catererScoring.js';

const scoreOf = (r) => {
  if (r?.scoreOutOf10 != null) return Number(r.scoreOutOf10);
  const max = Number(r?.maxScore), tot = Number(r?.totalScore);
  if (max > 0 && !isNaN(tot)) return (tot / max) * 10;
  const pct = parseFloat(r?.percentage);
  return isNaN(pct) ? null : pct / 10;
};

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const ms = (v) => (v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0));

/** One row per centre, keeping the most recent inspection of each. */
function latestPerCentre(rows) {
  const best = new Map();
  for (const r of rows) {
    const key = String(r.center ?? '');
    const prev = best.get(key);
    if (!prev || ms(r.timestamp) > ms(prev.timestamp)) best.set(key, r);
  }
  return [...best.values()];
}

/**
 * @param {object} args
 * @param {Array}  args.caterers
 * @param {Array}  args.mina  @param {Array} args.arafat  @param {Array} args.meals
 * @param {Array}  args.saved   rows from caterer_evaluations
 * @param {Array}  args.centers
 * @returns {Array} one scorecard per caterer, ranked
 */
export function buildScorecards({ caterers = [], mina = [], arafat = [], meals = [], saved = [], centers = [] }) {
  /* Inspections carry the caterer's name rather than its id, so grouping is by
     name. Trimmed, because a trailing space in one form would split a caterer
     into two and halve both. */
  const byName = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const k = String(r.caterer ?? '').trim();
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };
  const minaBy = byName(mina), arafatBy = byName(arafat), mealsBy = byName(meals);
  const savedBy = new Map(saved.map(s => [s.catererId, s]));

  const centresBy = new Map();
  for (const c of centers) {
    const k = String(c.catererName ?? '').trim();
    if (!k) continue;
    if (!centresBy.has(k)) centresBy.set(k, []);
    centresBy.get(k).push(c);
  }

  const cards = caterers.map(cat => {
    const name = String(cat.name ?? '').trim();
    const row = savedBy.get(cat.id) || {};

    /* Out of ten, per source. */
    const tenths = {
      mina:   avg(latestPerCentre(minaBy.get(name)   || []).map(scoreOf).filter(v => v != null)),
      arafat: avg(latestPerCentre(arafatBy.get(name) || []).map(scoreOf).filter(v => v != null)),
      meals:  avg((mealsBy.get(name) || []).map(scoreOf).filter(v => v != null)),
    };

    const scores = {}, sources = {}, derived = {};
    for (const c of ALL_CRITERIA) {
      const auto = c.derive && tenths[c.derive] != null
        ? Math.round((tenths[c.derive] / 10) * c.max * 100) / 100
        : null;
      derived[c.key] = auto;

      const manual = row[c.key];
      if (manual != null && manual !== '') {
        scores[c.key] = Math.min(Number(manual), c.max);
        sources[c.key] = auto != null ? 'override' : 'manual';
      } else if (auto != null) {
        scores[c.key] = auto;
        sources[c.key] = 'auto';
      } else {
        scores[c.key] = null;
        sources[c.key] = 'empty';
      }
    }

    const phases = PHASES.map(p => {
      const vals = p.criteria.map(c => scores[c.key]);
      const known = vals.filter(v => v != null);
      return {
        key: p.key, label: p.label, color: p.color, weight: p.weight,
        total: known.length ? Math.round(known.reduce((a, b) => a + b, 0) * 100) / 100 : null,
        filled: known.length,
        of: p.criteria.length,
      };
    });

    /* The final mark counts an unscored criterion as zero — that is what the
       workbook does, and it is the honest reading: a missing final report is a
       missing final report. `complete` says whether every criterion has a
       number, so a half-entered card is never mistaken for a poor one. */
    const total = Math.round(
      ALL_CRITERIA.reduce((n, c) => n + (scores[c.key] ?? 0), 0) * 100) / 100;
    const filled = ALL_CRITERIA.filter(c => scores[c.key] != null).length;
    const complete = filled === ALL_CRITERIA.length;

    return {
      caterer: cat,
      id: cat.id,
      name: cat.name,
      centres: (centresBy.get(name) || []).length,
      evidence: {
        mina:   (minaBy.get(name)   || []).length,
        arafat: (arafatBy.get(name) || []).length,
        meals:  (mealsBy.get(name)  || []).length,
      },
      scores, sources, derived, phases,
      total, filled, complete,
      grade: gradeOf(total),
      notes: row.notes || '',
      savedId: row.id || null,
      updatedAt: row.updatedAt || null,
    };
  });

  return cards.sort((a, b) => b.total - a.total);
}

/** Season-level figures — the ones the workbook's summary sheet carries. */
export function seasonSummary(cards) {
  const complete = cards.filter(c => c.complete);
  const scored = cards.filter(c => c.filled > 0);
  const totals = scored.map(c => c.total);
  return {
    count: cards.length,
    scored: scored.length,
    complete: complete.length,
    average: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100 : null,
    best: totals.length ? Math.max(...totals) : null,
    worst: totals.length ? Math.min(...totals) : null,
    above80: totals.length ? Math.round((totals.filter(t => t >= 80).length / totals.length) * 100) : null,
    byGrade: [...new Set(cards.map(c => c.grade?.label))].filter(Boolean).map(label => ({
      label,
      color: cards.find(c => c.grade?.label === label)?.grade.color,
      n: scored.filter(c => c.grade?.label === label).length,
    })),
    byPhase: PHASES.map(p => {
      const vals = scored.map(c => c.phases.find(x => x.key === p.key)?.total).filter(v => v != null);
      return {
        ...p,
        average: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null,
      };
    }),
  };
}
