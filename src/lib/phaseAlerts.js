/* Phase alert logic for AdminPhases dashboard.

   Given a meal's distribution time from menus.js (format: "11:00 ص — 02:00 م"),
   computes whether a center is "late" on prep or distribution photos:

   - prepStart = distributionStart - 3 hours
   - phase1Late: !phase1 && now > prepStart + 45 min
   - phase3Late: !phase3 && now > distStart + 30 min

   Hijri day-of-month for Dhul Hijjah is mapped to a Gregorian date via
   Intl islamic-umalqura calendar by scanning ±days around today.
*/

import { getCenterNationalityKey } from '../config/nationalities.js';
import { getMeal } from '../config/menus.js';

const DHUL_HIJJAH = 12;
const DAY_MS      = 86400000;
const PREP_LEAD_MS = 3 * 60 * 60 * 1000;
const PREP_LATE_MS = 45 * 60 * 1000;
const DIST_LATE_MS = 30 * 60 * 1000;

/* "11:00 ص" → { hours: 11, minutes: 0 }
   "02:00 م" → { hours: 14, minutes: 0 }
   "12:00 ص" → { hours: 0,  minutes: 0 }  (midnight)
   "12:00 م" → { hours: 12, minutes: 0 }  (noon) */
function parseArabicTime(str) {
  if (!str) return null;
  const m = String(str).trim().match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(ص|م)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mn = parseInt(m[2], 10);
  const period = m[3];
  if (period === 'م') { if (h !== 12) h += 12; }
  else if (period === 'ص') { if (h === 12) h = 0; }
  if (!Number.isFinite(h) || !Number.isFinite(mn)) return null;
  return { hours: h, minutes: mn };
}

/* Extract the START time from a meal.time range "HH:MM ص — HH:MM م". */
export function getDistributionStart(timeStr) {
  if (!timeStr) return null;
  const first = String(timeStr).split(/[—–\-]/)[0];
  return parseArabicTime(first);
}

/* Format Gregorian date → Hijri parts using Umm al-Qura */
function hijriParts(d) {
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
    day: 'numeric', month: 'numeric', year: 'numeric',
  });
  const parts = fmt.formatToParts(d);
  const day   = parseInt(parts.find(p => p.type === 'day')?.value,   10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
  const year  = parseInt(parts.find(p => p.type === 'year')?.value,  10);
  return { day, month, year };
}

/* Find the Gregorian midnight that corresponds to the given day-of-month
   of Dhul Hijjah closest to today. Returns null if nothing in ±90 days. */
export function gregorianForDhulHijjah(dayOfMonth) {
  const target = Number(dayOfMonth);
  if (!Number.isFinite(target)) return null;
  const today = new Date();
  for (let offset = -90; offset <= 90; offset++) {
    const d = new Date(today.getTime() + offset * DAY_MS);
    const p = hijriParts(d);
    if (p.day === target && p.month === DHUL_HIJJAH) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }
  return null;
}

/* Resolve a meal's time string for (center, day, mealKey).
   Returns the time string from the first nationality assigned to the center
   that actually has a time set for that meal — falls back to any nationality. */
function resolveMealTime(centerId, day, mealKey) {
  const natKey = getCenterNationalityKey(centerId);
  if (!natKey) return null;
  const meal = getMeal(natKey, day, mealKey);
  return meal?.time || null;
}

/**
 * Compute the alert state for a center's meal on a given Hijri day.
 *
 * @param {Object} args
 * @param {string} args.centerId   - e.g. 'مركز 25-أ'
 * @param {string} args.day        - Hijri day of Dhul Hijjah, e.g. '9'
 * @param {string} args.mealKey    - 'breakfast' | 'lunch' | 'dinner'
 * @param {Object} args.cell       - phase data: { phase1, phase2, phase3, ... }
 * @param {Date}   [args.now]      - reference time (defaults to new Date())
 * @returns {{phase1Late:boolean, phase3Late:boolean, prepStart:Date|null,
 *            distStart:Date|null, hasMenuTime:boolean}}
 */
export function computePhaseAlerts({ centerId, day, mealKey, cell, now = new Date(), dateOnly: dateOverride }) {
  const out = {
    phase1Late: false, phase3Late: false,
    prepStart: null, distStart: null, hasMenuTime: false,
  };
  const timeStr = resolveMealTime(centerId, day, mealKey);
  const t = getDistributionStart(timeStr);
  if (!t) return out;
  const dateOnly = dateOverride || gregorianForDhulHijjah(day);
  if (!dateOnly) return out;

  const distStart = new Date(
    dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(),
    t.hours, t.minutes, 0, 0,
  );
  const prepStart = new Date(distStart.getTime() - PREP_LEAD_MS);
  out.distStart   = distStart;
  out.prepStart   = prepStart;
  out.hasMenuTime = true;

  const phase1Done = !!cell?.phase1;
  const phase3Done = !!cell?.phase3;
  const nowMs = now.getTime();

  if (!phase1Done && nowMs > prepStart.getTime() + PREP_LATE_MS) out.phase1Late = true;
  if (!phase3Done && nowMs > distStart.getTime() + DIST_LATE_MS) out.phase3Late = true;

  return out;
}
