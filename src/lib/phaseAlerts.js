/* Phase alert logic for AdminPhases dashboard.

   ── Timezone anchoring ──
   All time math is anchored to Asia/Riyadh (UTC+3, no DST), regardless of
   the browser's local timezone. This protects against admins viewing from
   abroad or via VPN: meal times in menus.js are always KSA-local, and Hijri
   day-of-month is also resolved as it appears in KSA (the official Saudi
   Umm al-Qura calendar). All resulting Date objects are still standard JS
   Date instances (which are UTC under the hood), so direct timestamp
   comparison with `now.getTime()` works correctly.

   ── Alert rules ──
   - prepStart = distributionStart - 3 hours
   - phase1Late: !phase1 && now > prepStart + 45 min
   - phase3Late: !phase3 && now > distStart  + 30 min
*/

import { getCenterNationalityKey } from '../config/nationalities.js';
import { getMeal } from '../config/menus.js';

const DHUL_HIJJAH    = 12;
const DAY_MS         = 86400000;
const PREP_LEAD_MS   = 3 * 60 * 60 * 1000;
const PREP_LATE_MS   = 45 * 60 * 1000;
const DIST_LATE_MS   = 30 * 60 * 1000;
const RIYADH_TZ      = 'Asia/Riyadh';
const RIYADH_OFFSET_H = 3; // UTC+3, no DST

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

/* Extract the START time from a meal.time range like "HH:MM ص — HH:MM م". */
export function getDistributionStart(timeStr) {
  if (!timeStr) return null;
  const first = String(timeStr).split(/[—–\-]/)[0];
  return parseArabicTime(first);
}

/* Format an arbitrary Date as Hijri (Umm al-Qura) parts AS THEY APPEAR IN RIYADH. */
function hijriPartsRiyadh(d) {
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    timeZone: RIYADH_TZ,
  });
  const parts = fmt.formatToParts(d);
  const day   = parseInt(parts.find(p => p.type === 'day')?.value,   10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
  const year  = parseInt(parts.find(p => p.type === 'year')?.value,  10);
  return { day, month, year };
}

/* Format an arbitrary Date as Gregorian parts AS THEY APPEAR IN RIYADH. */
function gregorianPartsRiyadh(d) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    timeZone: RIYADH_TZ,
  });
  const parts = fmt.formatToParts(d);
  const day   = parseInt(parts.find(p => p.type === 'day')?.value,   10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value, 10); // 1-based
  const year  = parseInt(parts.find(p => p.type === 'year')?.value,  10);
  return { day, month, year };
}

/* Find the Gregorian date (as it appears IN RIYADH) corresponding to the given
   day-of-month of Dhul Hijjah closest to today. Returns { year, month, day }
   with month 1-based, or null if not within ±90 days. */
export function gregorianForDhulHijjah(dayOfMonth) {
  const target = Number(dayOfMonth);
  if (!Number.isFinite(target)) return null;
  const nowMs = Date.now();
  for (let offset = -90; offset <= 90; offset++) {
    /* Probe at 12:00 UTC = 15:00 Riyadh — safely inside the same day in both
       UTC and Riyadh, so the Hijri/Gregorian mapping is unambiguous. */
    const probe = new Date(nowMs + offset * DAY_MS);
    const h = hijriPartsRiyadh(probe);
    if (h.day === target && h.month === DHUL_HIJJAH) {
      return gregorianPartsRiyadh(probe);
    }
  }
  return null;
}

/* Build a Date instance that represents the given (Gregorian Riyadh date,
   Riyadh hours:minutes). Since Riyadh = UTC+3 with no DST, we just subtract
   3 hours when constructing a UTC timestamp. */
function riyadhLocalDate(gregParts, hours, minutes) {
  const utcMs = Date.UTC(gregParts.year, gregParts.month - 1, gregParts.day,
    hours - RIYADH_OFFSET_H, minutes, 0, 0);
  return new Date(utcMs);
}

/* Resolve a meal's time string for (center, day, mealKey).
   Uses the first nationality assigned to the center. */
function resolveMealTime(centerId, day, mealKey) {
  const natKey = getCenterNationalityKey(centerId);
  if (!natKey) return null;
  const meal = getMeal(natKey, day, mealKey);
  return meal?.time || null;
}

/**
 * Compute the alert state for a center's meal on a given Hijri day.
 * All time math is anchored to Asia/Riyadh; comparisons use UTC timestamps.
 *
 * @param {Object} args
 * @param {string} args.centerId    - e.g. 'مركز 25-أ'
 * @param {string} args.day         - Hijri day of Dhul Hijjah, e.g. '9'
 * @param {string} args.mealKey     - 'breakfast' | 'lunch' | 'dinner'
 * @param {Object} args.cell        - phase data: { phase1, phase2, phase3, ... }
 * @param {Date}   [args.now]       - reference time (defaults to new Date())
 * @param {Object} [args.dateOnly]  - precomputed Gregorian parts for `day`
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
  const gregParts = dateOverride || gregorianForDhulHijjah(day);
  if (!gregParts) return out;

  const distStart = riyadhLocalDate(gregParts, t.hours, t.minutes);
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
