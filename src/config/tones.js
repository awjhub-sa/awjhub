/**
 * src/config/violationTones.js
 *
 * The colours the violations section speaks in, in one place so the office and
 * the caterer never read the same state in two different hues.
 *
 * Chosen to be told apart at a glance rather than to be tasteful in isolation:
 * severity runs hot (rose → orange → cyan), state runs cool (violet → blue →
 * teal → emerald), and the two attachment kinds are deliberately far apart —
 * indigo for what the office photographed, emerald for what the caterer
 * photographed after fixing it. A green chip anywhere in this section means
 * the same thing it means everywhere else in it.
 */

/* how bad */
export const SEVERITY = {
  'عالية':  { bg: '#FFE4E6', ink: '#BE123C', line: '#FDA4AF', bar: '#F43F5E' },
  'متوسطة': { bg: '#FFEDD5', ink: '#C2410C', line: '#FDBA74', bar: '#F97316' },
  'منخفضة': { bg: '#CFFAFE', ink: '#0E7490', line: '#67E8F9', bar: '#06B6D4' },
};

/* where it stands, in this section's own words */
export const STATE = {
  pending:   { label: 'لم يُفد بعد',   bg: '#EDE9FE', ink: '#6D28D9', line: '#C4B5FD', bar: '#8B5CF6' },
  draft:     { label: 'يكتب إفادته',   bg: '#DBEAFE', ink: '#1D4ED8', line: '#93C5FD', bar: '#3B82F6' },
  submitted: { label: 'أُفيد — بانتظار المراجعة', bg: '#CCFBF1', ink: '#0F766E', line: '#5EEAD4', bar: '#14B8A6' },
  accepted:  { label: 'مُغلقة',        bg: '#D1FAE5', ink: '#047857', line: '#6EE7B7', bar: '#10B981' },
  returned:  { label: 'أُعيدت للتعديل', bg: '#FFE4E6', ink: '#BE123C', line: '#FDA4AF', bar: '#F43F5E' },
};
export const stateOf = (status) => STATE[status] || STATE.pending;

/* past the remedy date — the one tone that overrules the others */
export const LATE = { bg: '#FEE2E2', ink: '#B91C1C', line: '#FCA5A5', bar: '#DC2626' };

/* who attached it */
export const ATTACH = {
  evidence:        { label: 'صورة المخالفة', bg: '#E0E7FF', ink: '#4338CA', line: '#A5B4FC', bar: '#6366F1' },
  remedy_evidence: { label: 'مرفق المعالجة', bg: '#D1FAE5', ink: '#047857', line: '#6EE7B7', bar: '#10B981' },
};

/* an aside from the caterer */
export const NOTE = { bg: '#FEF3C7', ink: '#B45309', line: '#FCD34D', bar: '#F59E0B' };

export const extOf = (u) => (String(u).match(/\.[a-z0-9]{2,5}(?=\?|$)/i) || ['.jpg'])[0];

/* ── Forms ──────────────────────────────────────────────────
   The same four-tone grammar the violations register reads by, applied to the
   documents the office asks for. Same family, different assignment: here amber
   is what is still owed rather than a remark, because that is the state the
   caterer opens this list to find.

   Labels stay in STATUS_META — this file colours states, it does not name
   them, and two places naming the same status would eventually disagree. */
export const FORM_STATE = {
  pending:   { bg: '#FEF3C7', ink: '#B45309', line: '#FCD34D', bar: '#F59E0B' },
  draft:     { bg: '#DBEAFE', ink: '#1D4ED8', line: '#93C5FD', bar: '#3B82F6' },
  submitted: { bg: '#CCFBF1', ink: '#0F766E', line: '#5EEAD4', bar: '#14B8A6' },
  accepted:  { bg: '#D1FAE5', ink: '#047857', line: '#6EE7B7', bar: '#10B981' },
  returned:  { bg: '#FFE4E6', ink: '#BE123C', line: '#FDA4AF', bar: '#F43F5E' },
};
export const formToneOf = (status) => FORM_STATE[status] || FORM_STATE.pending;

/* Neutral, for a date that is simply booked or a slot nothing is owed on. */
export const CALM = { bg: '#F8FAFC', ink: 'rgb(var(--c-muted))', line: 'rgb(var(--c-line))', bar: '#CBD5E1' };

/* ── Actions ────────────────────────────────────────────────
   A row of five identical grey outlines makes the reader parse five words to
   find one verb. Each verb keeps a colour instead, the same one wherever it
   appears, so «طباعة» is found by its hue before it is read.

   Grouped by consequence, not by looks: reading is cool, sending is violet,
   taking a copy away is amber, and only destruction is red — which is why
   nothing else in this map is allowed near it. */
export const ACTION = {
  view:   { bg: '#EFF6FF', ink: '#1D4ED8', line: '#BFDBFE' },  // فتح · معاينة · مراجعة
  assign: { bg: '#F5F3FF', ink: '#6D28D9', line: '#DDD6FE' },  // إسناد
  print:  { bg: '#F0FDFA', ink: '#0F766E', line: '#99F6E4' },  // طباعة
  attach: { bg: '#EEF2FF', ink: '#4338CA', line: '#C7D2FE' },  // المرفق
  copy:   { bg: '#FFFBEB', ink: '#B45309', line: '#FDE68A' },  // نسخة
  edit:   { bg: '#F0F9FF', ink: '#0369A1', line: '#BAE6FD' },  // تعديل
  danger: { bg: '#FFF1F2', ink: '#BE123C', line: '#FECDD3' },  // حذف
};
export const actionTone = (name) => ACTION[name] || ACTION.view;

/* ── Template identity ──────────────────────────────────────
   Eleven ready-made forms in a grid of eleven identical white cards are told
   apart only by reading the title. A colour per form makes the one you came
   for findable at a glance, and — because the colour is fixed to the key, not
   to the position — it stays findable in the same place tomorrow.

   The tone is an accent, never a fill: the card stays white so a wall of them
   reads as a library rather than a paint chart. */
const HUES = [
  { bar: '#6366F1', ink: '#4338CA', bg: '#EEF2FF', line: '#C7D2FE' },  // indigo
  { bar: '#0EA5E9', ink: '#0369A1', bg: '#F0F9FF', line: '#BAE6FD' },  // sky
  { bar: '#10B981', ink: '#047857', bg: '#ECFDF5', line: '#A7F3D0' },  // emerald
  { bar: '#14B8A6', ink: '#0F766E', bg: '#F0FDFA', line: '#99F6E4' },  // teal
  { bar: '#06B6D4', ink: '#0E7490', bg: '#ECFEFF', line: '#A5F3FC' },  // cyan
  { bar: '#3B82F6', ink: '#1D4ED8', bg: '#EFF6FF', line: '#BFDBFE' },  // blue
  { bar: '#8B5CF6', ink: '#6D28D9', bg: '#F5F3FF', line: '#DDD6FE' },  // violet
  { bar: '#F97316', ink: '#C2410C', bg: '#FFF7ED', line: '#FED7AA' },  // orange
  { bar: '#F59E0B', ink: '#B45309', bg: '#FFFBEB', line: '#FDE68A' },  // amber
  { bar: '#D946EF', ink: '#A21CAF', bg: '#FDF4FF', line: '#F5D0FE' },  // fuchsia
  { bar: '#F43F5E', ink: '#BE123C', bg: '#FFF1F2', line: '#FECDD3' },  // rose
  { bar: '#84CC16', ink: '#4D7C0F', bg: '#F7FEE7', line: '#D9F99D' },  // lime
];

/* Deliberate for the forms that ship with the system — the pair of readiness
   minutes are neighbouring greens because they are the same document twice,
   and the violation notice is the only rose. Anything the customer builds
   takes a stable colour from its own key. */
const TEMPLATE_HUE = {
  caterer_pledge:           0,
  liaison_officer:          1,
  readiness_minutes_mina:   2,
  readiness_minutes_arafat: 3,
  fridge_receipt_mina:      4,
  fridge_receipt_arafat:    5,
  doc_ops_plan:             6,
  doc_kerosene_certificate: 7,
  doc_sample_disposal:      8,
  doc_final_report:         9,
  violation_notice:        10,
};

export function templateTone(key) {
  const named = TEMPLATE_HUE[key];
  if (named !== undefined) return HUES[named];
  /* A stable hash, so a template does not change colour between reloads. */
  const s = String(key ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}
