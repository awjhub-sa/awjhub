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
