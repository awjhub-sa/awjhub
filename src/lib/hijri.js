/* Saudi Umm al-Qura hijri date formatting.

   The browser's default `ar-SA-u-ca-islamic` can fall back to islamic-civil
   on some platforms (which drifts a day or two from the official Saudi
   calendar). `islamic-umalqura` is the canonical one.

   If the rendered date is still ±1 day off the actual Umm al-Qura, tweak
   HIJRI_OFFSET_DAYS — positive moves the display forward in time. */

export const HIJRI_OFFSET_DAYS = 0;

const DAY_MS = 86400000;

const baseFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day:   'numeric',
  month: 'long',
  year:  'numeric',
});

export function formatHijri(date = new Date()) {
  const d = new Date(date.getTime() + HIJRI_OFFSET_DAYS * DAY_MS);
  return baseFormatter.format(d);
}

/* ── Parts, for pickers ───────────────────────────────────── */

export const HIJRI_MONTHS = [
  'محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة',
];

/* `en` with the islamic-umalqura calendar yields plain latin digits, which
   parse without stripping Arabic-Indic numerals first. */
const partsFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: 'numeric', month: 'numeric', year: 'numeric',
});

/** Gregorian Date → { y, m, d } in Umm al-Qura. */
export function toHijriParts(date = new Date()) {
  const d = new Date(date.getTime() + HIJRI_OFFSET_DAYS * DAY_MS);
  const out = {};
  for (const p of partsFormatter.formatToParts(d)) {
    if (p.type === 'year')  out.y = parseInt(p.value, 10);
    if (p.type === 'month') out.m = parseInt(p.value, 10);
    if (p.type === 'day')   out.d = parseInt(p.value, 10);
  }
  return out;
}

/**
 * Umm al-Qura { y, m, d } → Gregorian Date.
 *
 * Intl converts one way only, so this estimates the Gregorian day from the
 * mean Hijri year length and then walks outward until the round-trip agrees.
 * Searching beats arithmetic here: Umm al-Qura month lengths are set by
 * observation tables, not by a formula, so any closed-form inverse drifts.
 */
export function fromHijriParts(y, m, d) {
  /* 1 Muharram 1 AH ≈ 16 July 622 CE (Julian day 1948439). */
  const approxDays = Math.floor((y - 1) * 354.367) + Math.floor((m - 1) * 29.53) + (d - 1);
  const epoch = Date.UTC(622, 6, 16);
  let guess = new Date(epoch + approxDays * DAY_MS);

  for (let step = 0; step <= 60; step++) {
    for (const sign of step === 0 ? [0] : [-1, 1]) {
      const probe = new Date(guess.getTime() + sign * step * DAY_MS);
      const p = toHijriParts(probe);
      if (p.y === y && p.m === m && p.d === d) return probe;
    }
  }
  return null;   // no such Hijri date — 30 Ramadan in a 29-day year, say
}

/** Days in a given Umm al-Qura month: 29 or 30, never assumed. */
export function hijriMonthLength(y, m) {
  return fromHijriParts(y, m, 30) ? 30 : 29;
}

/** ISO 'YYYY-MM-DD' → '15 ذو القعدة 1447 هـ'. */
export function isoToHijriLabel(iso) {
  if (!iso) return '';
  const date = new Date(`${iso}T12:00:00`);
  if (isNaN(date)) return '';
  const { y, m, d } = toHijriParts(date);
  return `${d} ${HIJRI_MONTHS[m - 1]} ${y} هـ`;
}
