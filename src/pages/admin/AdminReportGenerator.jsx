/**
 * AdminReportGenerator.jsx
 *
 * PDF export for the admin dashboard.
 * Uses jsPDF v4 + jspdf-autotable v5 with locally-embedded Cairo font.
 *
 * Arabic rendering is fixed by a self-contained reshaper that converts
 * logical-order Unicode (U+0600–U+064A) into visual-order Unicode
 * Presentation Forms-B (U+FE70–U+FEFF) so jsPDF renders connected glyphs
 * without needing OpenType shaping support.
 *
 * Font file : src/assets/fonts/CairoFont.js
 *   Regenerate:  node scripts/downloadCairoFont.mjs
 */

import { useState, useMemo }                     from 'react';
import { db }                                    from '../../lib/db.js';
import {
  toMs, getTotalElapsedMs, fmtDuration,
  TERMINAL_REPORT_STATUSES, TERMINAL_LOGISTICS_STATUSES,
}                                                from '../../lib/statusTracking.js';
import { CENTERS }                               from '../../config/centers.js';
import { cairoBase64 }                           from '../../assets/fonts/CairoFont.js';
const logoSrc = BRAND.logo.color;
import { MEAL_QUESTIONS }                        from '../../config/mealQuestions.js';
import { MINA_ALL_CRITERIA }                     from '../../config/minaQuestions.js';
import { ARAFAT_ALL_CRITERIA }                   from '../../config/arafatQuestions.js';
import { BRAND } from '../../config/brand.js';
import {
  FileText,
  X,
  CaretDown as ChevronDown,
  CircleNotch as Loader2,
  CheckCircle as CheckCircle2,
  Buildings as Building2,
  CalendarBlank as Calendar,
  ClipboardText as ClipboardList,
  ListChecks,
  Eye,
  Info,
  MagnifyingGlass as Search,
  Check,
} from '@phosphor-icons/react';

/* Map each report-type key to its question list (for detail mode) */
const QUESTION_BANK = {
  meal_evaluations: MEAL_QUESTIONS,
  mina_readiness:   MINA_ALL_CRITERIA,
  arafat_readiness: ARAFAT_ALL_CRITERIA,
};

/* Normalize a record's score to /10 across all storage shapes */
function getRecordScore(rec) {
  if (rec.scoreOutOf10 != null) return Number(rec.scoreOutOf10);
  const max = Number(rec.maxScore);
  const tot = Number(rec.totalScore);
  if (max > 0 && !isNaN(tot)) return parseFloat(((tot / max) * 10).toFixed(2));
  const pct = parseFloat(rec.percentage);
  if (!isNaN(pct)) return parseFloat((pct / 10).toFixed(2));
  return null;
}

/* Format a Firestore Timestamp / Date / millis as Arabic short date+time */
function formatSubmitTime(ts) {
  if (!ts) return '—';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

const DHU_DAYS = [
  '٦ ذو الحجة ١٤٤٧',
  '٧ ذو الحجة ١٤٤٧',
  '٨ ذو الحجة ١٤٤٧',
  '٩ ذو الحجة ١٤٤٧',
  '١٠ ذو الحجة ١٤٤٧',
  '١١ ذو الحجة ١٤٤٧',
  '١٢ ذو الحجة ١٤٤٧',
  '١٣ ذو الحجة ١٤٤٧',
];

const REPORT_TYPES = [
  { key: 'meal_evaluations',   label: 'تقييم جودة الوجبات', color: '#7C3AED' },
  { key: 'mina_readiness',     label: 'جاهزية مشعر منى',    color: '#16A34A' },
  { key: 'arafat_readiness',   label: 'جاهزية مشعر عرفة',   color: '#0891B2' },
  { key: 'reports',            label: 'البلاغات الميدانية', color: '#DC2626' },
  { key: 'logistics_requests', label: 'طلبات الإسناد',      color: '#06B6D4' },
];

const MEAL_LABELS = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };

const REPORT_TYPE_LABELS = {
  water: 'تسرب مياه', electric: 'عطل كهربائي', crowd: 'ازدحام حرج',
  food: 'مشكلة غذائية', medical: 'حالة طبية طارئة', security: 'بلاغ أمني',
  fire: 'حريق / دخان', other: 'بلاغ آخر', shortage: 'نقص في الكميات',
  delay: 'تأخر في التوزيع', quality: 'مشكلة في الجودة', hygiene: 'مخالفة صحية',
};
const SEVERITY_LABELS = {
  high: 'عالية', urgent: 'عاجل', medium: 'متوسطة', low: 'منخفضة',
};
const REPORT_STATUS_LABELS = {
  pending: 'قيد الانتظار', in_progress: 'جارٍ التنفيذ', resolved: 'تم الحل',
};
const SUPPORT_LABELS = {
  internal: 'داخلي', external: 'خارجي', both: 'مشترك',
};
const LOGISTICS_CATEGORY_LABELS = { meals: 'وجبات', water: 'مياه' };
const LOGISTICS_STATUS_LABELS = {
  pending: 'قيد الانتظار', approved: 'معتمد',
  delivered: 'تم التسليم', rejected: 'مرفوض',
};

// Presentation forms: char → [isolated, final, initial, medial]
const _AR = {
  'ء': ['ء','ء','ء','ء'],           // ء hamza
  'آ': ['آ','ﺂ','آ','ﺂ'],           // آ alef madda
  'أ': ['أ','ﺄ','أ','ﺄ'],           // أ alef hamza above
  'ؤ': ['ؤ','ﺆ','ؤ','ﺆ'],           // ؤ waw hamza
  'إ': ['إ','ﺈ','إ','ﺈ'],           // إ alef hamza below
  'ئ': ['ئ','ﺊ','ﺋ','ﺌ'],           // ئ yeh hamza
  'ا': ['ا','ﺎ','ا','ﺎ'],           // ا alef
  'ب': ['ب','ﺐ','ﺑ','ﺒ'],           // ب ba
  'ة': ['ة','ﺔ','ة','ﺔ'],           // ة ta marbuta
  'ت': ['ت','ﺖ','ﺗ','ﺘ'],           // ت ta
  'ث': ['ث','ﺚ','ﺛ','ﺜ'],           // ث tha
  'ج': ['ج','ﺞ','ﺟ','ﺠ'],           // ج jim
  'ح': ['ح','ﺢ','ﺣ','ﺤ'],           // ح ha
  'خ': ['خ','ﺦ','ﺧ','ﺨ'],           // خ kha
  'د': ['د','ﺪ','د','ﺪ'],           // د dal
  'ذ': ['ذ','ﺬ','ذ','ﺬ'],           // ذ thal
  'ر': ['ر','ﺮ','ر','ﺮ'],           // ر ra
  'ز': ['ز','ﺰ','ز','ﺰ'],           // ز zain
  'س': ['س','ﺲ','ﺳ','ﺴ'],           // س sin
  'ش': ['ش','ﺶ','ﺷ','ﺸ'],           // ش shin
  'ص': ['ص','ﺺ','ﺻ','ﺼ'],           // ص sad
  'ض': ['ض','ﺾ','ﺿ','ﻀ'],           // ض dad
  'ط': ['ط','ﻂ','ﻃ','ﻄ'],           // ط ta
  'ظ': ['ظ','ﻆ','ﻇ','ﻈ'],           // ظ za
  'ع': ['ع','ﻊ','ﻋ','ﻌ'],           // ع ain
  'غ': ['غ','ﻎ','ﻏ','ﻐ'],           // غ ghain
  'ف': ['ف','ﻒ','ﻓ','ﻔ'],           // ف fa
  'ق': ['ق','ﻖ','ﻗ','ﻘ'],           // ق qaf
  'ك': ['ك','ﻚ','ﻛ','ﻜ'],           // ك kaf
  'ل': ['ل','ﻞ','ﻟ','ﻠ'],           // ل lam
  'م': ['م','ﻢ','ﻣ','ﻤ'],           // م mim
  'ن': ['ن','ﻦ','ﻧ','ﻨ'],           // ن nun
  'ه': ['ه','ﻪ','ﻫ','ﻬ'],           // ه ha
  'و': ['و','ﻮ','و','ﻮ'],           // و waw
  'ى': ['ى','ﻰ','ى','ﻰ'],           // ى alef maksura
  'ي': ['ي','ﻲ','ﻳ','ﻴ'],           // ي ya
};

// Mandatory Lam-Alef ligatures: { alef_variant → [isolated_lig, final_lig] }
const _LA = {
  'آ': ['ﻵ','ﻶ'],  // لآ
  'أ': ['ﻷ','ﻸ'],  // لأ
  'إ': ['ﻹ','ﻺ'],  // لإ
  'ا': ['ﻻ','ﻼ'],  // لا
};

// Right-joiners + non-joiners: do NOT connect forward (to the left visually)
const _NF = new Set([
  'ء','آ','أ','ؤ','إ','ا',
  'ة','د','ذ','ر','ز','و','ى',
]);

// Letters that don't accept connection from the preceding letter
const _NB = new Set(['ء']); // bare hamza only

// Arabic combining diacritics — stay attached to their base glyph
const _DC = new Set([
  'ً','ٌ','ٍ','َ','ُ',
  'ِ','ّ','ْ','ٰ',
]);

function _isAr(c) {
  const n = c.charCodeAt(0);
  return (n >= 0x0621 && n <= 0x064A) ||
         (n >= 0xFB50 && n <= 0xFDFF) ||
         (n >= 0xFE70 && n <= 0xFEFF);
}
function _canFwd(c) { return _isAr(c) && !_NF.has(c); }

/**
 * Reshape one space-free Arabic word and reverse it to visual (LTR) order.
 */
function _reshapeWord(word) {
  const chars = [...word];   // spread handles surrogate pairs
  const toks  = [];

  // Pass 1: tokenise — merge diacritics into base char; detect lam+alef pairs
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (_DC.has(c)) {
      if (toks.length) toks[toks.length - 1].d += c;
      else toks.push({ la: false, c, d: '' });
    } else if (c === 'ل' && i + 1 < chars.length && _LA[chars[i + 1]]) {
      // Lam + {آ أ إ ا} → mandatory ligature token
      let d = '';
      let j = i + 2;
      while (j < chars.length && _DC.has(chars[j])) d += chars[j++];
      toks.push({ la: true, alef: chars[i + 1], d });
      i = j - 1;
    } else {
      toks.push({ la: false, c, d: '' });
    }
  }

  // Pass 2: assign presentation form for each token
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];

    // connectToPrev: does the previous token connect forward to this one?
    let cp = false;
    if (i > 0) {
      const p = toks[i - 1];
      cp = !p.la && _isAr(p.c) && _canFwd(p.c);
    }

    if (t.la) {
      // Lam-alef: accepts backward connection; never connects forward
      const ligs = _LA[t.alef];
      out.push((cp ? ligs[1] : ligs[0]) + t.d);
    } else {
      const forms = _AR[t.c];
      if (!forms) { out.push(t.c + t.d); continue; }

      // connectToNext: does this token connect forward to the next one?
      let cn = false;
      if (i + 1 < toks.length) {
        const nx = toks[i + 1];
        cn = _canFwd(t.c) && (nx.la || (_isAr(nx.c) && !_NB.has(nx.c)));
      }

      // [isolated=0, final=1, initial=2, medial=3]
      const fi = (cp && cn) ? 3 : cp ? 1 : cn ? 2 : 0;
      out.push(forms[fi] + t.d);
    }
  }

  // Pass 3: reverse to visual (left-to-right) order for jsPDF
  return out.reverse().join('');
}

/**
 * fixArabic(text)
 *
 * The single entry point for Arabic text rendering in this PDF generator.
 * Wrap EVERY string in this before doc.text() or autotable cells/headers.
 *
 * – Arabic words  → reshaped to Presentation Forms-B, characters reversed
 * – Non-Arabic tokens (digits, Latin, symbols) → repositioned only
 * – Word order is reversed so jsPDF's LTR engine produces correct RTL lines
 */
export function fixArabic(text) {
  if (text == null) return '';
  return String(text)
    .split(' ')
    .map(w =>
      [...w].some(c => _AR[c] !== undefined) ? _reshapeWord(w) : w
    )
    .reverse()
    .join(' ');
}

/* ──────────────────────────────────────────────────────
   Numeric helper — convert ASCII digits to Arabic-Indic.
   Use for any number that appears alongside Arabic text
   so the visual script stays consistent.
─────────────────────────────────────────────────────── */
const _AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function toArabicNum(input) {
  return String(input ?? '').replace(/\d/g, d => _AR_DIGITS[d.charCodeAt(0) - 48]);
}

/* ──────────────────────────────────────────────────────
   RTL-aware multi-line wrapping.
   Splits a logical-order string into visual lines that
   fit within maxWidth (in mm at the current font/size).
   Each returned line is reshaped and word-reversed,
   ready to pass directly to doc.text().

   IMPORTANT: requires doc.setFont('Cairo','normal') and
   doc.setFontSize(N) to be set BEFORE the call, since
   it uses doc.getTextWidth() under the current state.
─────────────────────────────────────────────────────── */
function _reshapeIfArabic(w) {
  return [...w].some(c => _AR[c] !== undefined) ? _reshapeWord(w) : w;
}
export function wrapArabicLines(doc, text, maxWidth) {
  if (text == null || text === '') return [''];
  const words  = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const formed = words.map(_reshapeIfArabic);
  const widths = formed.map(f => doc.getTextWidth(f));
  const spaceW = doc.getTextWidth(' ');

  const lines = [];
  let cur = [], curW = 0;
  for (let i = 0; i < formed.length; i++) {
    const need = cur.length ? curW + spaceW + widths[i] : widths[i];
    if (need > maxWidth && cur.length) {
      lines.push(cur);
      cur  = [formed[i]];
      curW = widths[i];
    } else {
      cur.push(formed[i]);
      curW = need;
    }
  }
  if (cur.length) lines.push(cur);
  // Reverse word order on each line for jsPDF's LTR renderer
  return lines.map(l => l.slice().reverse().join(' '));
}

let _logoDataUrl = null;

/* Logo aspect ratio fallback — matches the SVG viewBox (600 × 378.6) so
   the canvas isn't 0×0 when the browser can't infer SVG natural size. */
const LOGO_FALLBACK_W = 600;
const LOGO_FALLBACK_H = 379;
const LOGO_RASTER_SCALE = 4; // upscale before rasterizing so PDF stays crisp

function getLogoDataUrl() {
  if (_logoDataUrl) return Promise.resolve(_logoDataUrl);
  return new Promise((resolve) => {
    const img       = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth  || LOGO_FALLBACK_W;
        const h = img.naturalHeight || LOGO_FALLBACK_H;
        const canvas = document.createElement('canvas');
        canvas.width  = w * LOGO_RASTER_SCALE;
        canvas.height = h * LOGO_RASTER_SCALE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        _logoDataUrl = canvas.toDataURL('image/png');
      } catch { _logoDataUrl = null; }
      resolve(_logoDataUrl);
    };
    img.onerror = () => resolve(null);
    img.src = logoSrc;
  });
}

/* Logo aspect ratio for sizing in PDF (landscape SVG) */
const LOGO_ASPECT = LOGO_FALLBACK_W / LOGO_FALLBACK_H;

/* Convert "٦ ذو الحجة ١٤٤٧" → 6. Returns null if not parseable. */
function dhuDayFromLabel(label) {
  if (!label) return null;
  const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  /* Take leading digits (could be one or two chars: e.g. ١٠) */
  const m = String(label).trim().match(/^[٠-٩\d]+/);
  if (!m) return null;
  let n = 0;
  for (const ch of m[0]) {
    const idx = arabicDigits.indexOf(ch);
    n = n * 10 + (idx >= 0 ? idx : parseInt(ch, 10));
  }
  return Number.isFinite(n) ? n : null;
}

/* Returns the day-of-month in Dhul Hijjah for a given timestamp (Riyadh tz),
   or null if not in Dhul Hijjah. */
function dhuDayFromTimestamp(ts) {
  if (!ts) return null;
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', timeZone: 'Asia/Riyadh',
    });
    const parts = fmt.formatToParts(d);
    const day   = parseInt(parts.find(p => p.type === 'day')?.value,   10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
    return month === 12 ? day : null;
  } catch { return null; }
}

/* centerFilter is a (possibly empty) array of exact center IDs.
   Empty array = no center restriction (all centers).
   dateFilter is a Hijri-day label like "٦ ذو الحجة ١٤٤٧"; we match either
   the legacy scheduledDate string OR the timestamp's Hijri day in Riyadh. */
async function fetchReportData({ centerFilter, dateFilter, types }) {
  const result = {};
  const wantCenters = Array.isArray(centerFilter) && centerFilter.length > 0
    ? new Set(centerFilter)
    : null;
  const wantDay = dateFilter ? dhuDayFromLabel(dateFilter) : null;
  await Promise.all(types.map(async (type) => {
    let docs = await db[type].list();
    if (wantCenters) {
      docs = docs.filter(d => wantCenters.has(d.center));
    }
    if (dateFilter) {
      docs = docs.filter(d => {
        if ((d.scheduledDate ?? '') === dateFilter) return true;
        if (wantDay != null && dhuDayFromTimestamp(d.timestamp) === wantDay) return true;
        return false;
      });
    }
    docs.sort((a, b) =>
      (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0)
    );
    result[type] = docs;
  }));
  return result;
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [0, 0, 0];
}

async function buildPDF({ data, centerFilter, dateFilter, types, detailed = false }) {
  /* Dynamic imports — only bundled & loaded when user clicks "generate" */
  const { jsPDF }              = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  /* ── Document ── */
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297;
  const ML = 14, MR = 14;
  const CW = PW - ML - MR;   // 182 mm usable width

  /* ─────────────────────────────────────────────────────────────
     STEP 1 — Register Cairo font FIRST.
     MUST happen before any text operation.
  ─────────────────────────────────────────────────────────────*/
  doc.addFileToVFS('Cairo-Regular.ttf', cairoBase64);
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
  doc.setFont('Cairo', 'normal');

  /* ─────────────────────────────────────────────────────────────
     CRITICAL: jsPDF auto-runs its own Arabic shaper (processArabic
     on preProcessText) and BiDi reorderer (bidiEngineFunction on
     postProcessText) on every text call. Our fixArabic already
     produces fully shaped + visually-reversed text, so we MUST
     unsubscribe those internal handlers or the output gets mangled
     (ligature substitutions kick in, alef gets flipped, BiDi
     re-reorders our visual-order string back to logical order).
     We must KEEP utf8EscapeFunction on postProcessText — that one
     handles the actual UTF-8 → PDF-string encoding.
  ─────────────────────────────────────────────────────────────*/
  doc.processArabic = (t) => t;
  {
    const topics = doc.internal.events.getTopics();
    // preProcessText: only subscriber is processArabic — clear it
    for (const tok of Object.keys(topics.preProcessText || {})) {
      doc.internal.events.unsubscribe(tok);
    }
    // postProcessText has TWO handlers we care about:
    //   • utf8EscapeFunction → required (UTF-8 → PDF encoding) — KEEP
    //   • bidiEngineFunction → harmful (re-reorders our visual text) — DROP
    // Function names are stripped by the bundler, so identify by source.
    for (const tok of Object.keys(topics.postProcessText || {})) {
      const cb = topics.postProcessText[tok][0];
      const src = cb ? Function.prototype.toString.call(cb) : '';
      if (src.includes('doBidiReorder') || src.includes('bidiEngine')) {
        doc.internal.events.unsubscribe(tok);
      }
    }
  }

  /* ── STEP 2 — Pre-load logo before drawing anything ── */
  const logoDataUrl = await getLogoDataUrl();

  /* ── Palette ── */
  const C_GOLD  = hexToRgb('#7C3AED');
  const C_DARK  = hexToRgb('#1E1B2E');
  const C_WHITE = [255, 255, 255];
  const C_LIGHT = hexToRgb('#F8FAFC');
  const C_GRAY  = hexToRgb('#64748B');
  const C_LINE  = hexToRgb('#E2E8F0');

  const nowStr = new Date().toLocaleString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  /* ── Shared autoTable config ──
     font:'Cairo' + halign:'right' on every style level is mandatory for
     correct Arabic Presentation Forms glyph lookup and RTL cell alignment. */
  const TABLE_BASE = {
    styles: {
      font:        'Cairo',
      fontStyle:   'normal',
      halign:      'right',
      fontSize:    9.5,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      lineColor:   C_LINE,
      lineWidth:   0.2,
      textColor:   C_DARK,
      valign:      'middle',
      overflow:    'linebreak',
    },
    headStyles: {
      font:      'Cairo',
      fontStyle: 'normal',
      halign:    'right',
      textColor: C_WHITE,
      fontSize:  10,
      cellPadding: { top: 4.5, right: 5, bottom: 4.5, left: 5 },
      valign:    'middle',
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: [253, 248, 240] },  // softer cream
    theme:  'grid',
    margin: { right: ML, left: MR },
  };

  /* ── Metadata: observer names and contractor ── */
  const allObservers = [
    ...new Set(
      types.flatMap(t =>
        (data[t] ?? [])
          .map(d => d.observer ?? d.observerName ?? null)
          .filter(Boolean)
      )
    ),
  ];
  const observerDisplay =
    allObservers.length === 0 ? '—'
    : allObservers.length === 1 ? allObservers[0]
    : allObservers.length <= 3  ? allObservers.join(' • ')
    : `${allObservers[0]} و${allObservers.length - 1} آخرون`;

  /* contractorName only shows when exactly one center is selected; for
     multiple, the per-center sections show each contractor separately. */
  const contractorName =
    Array.isArray(centerFilter) && centerFilter.length === 1
      ? (CENTERS.find(c => c.id === centerFilter[0])?.caterer ?? '—')
      : '—';

  let pageNum = 0;

  /* ─────────────────────────────────────────────────
     drawPageHeader
     isFirst=true  → tall decorative band (cover page)
     isFirst=false → slim mini-header (data pages)
  ───────────────────────────────────────────────── */
  function drawPageHeader(isFirst = false) {
    pageNum++;

    if (isFirst) {
      /* ── Top decorative band ── */
      doc.setFillColor(...C_LIGHT);
      doc.rect(0, 0, PW, 14, 'F');
      doc.setDrawColor(...C_GOLD);
      doc.setLineWidth(0.6);
      doc.line(0, 14, PW, 14);

      /* ── Centered logo ── */
      if (logoDataUrl) {
        const logoW = 46;
        const logoH = logoW / LOGO_ASPECT;
        const logoX = (PW - logoW) / 2;
        try { doc.addImage(logoDataUrl, 'PNG', logoX, 22, logoW, logoH); }
        catch { /* silently skip */ }
      }

      /* ── Brand name ── */
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(30);
      doc.setTextColor(...C_GOLD);
      doc.text(fixArabic(BRAND.companyName), PW / 2, 56, { align: 'center' });

      /* ── Small decorative dots flanking the title divider ── */
      doc.setFillColor(...C_GOLD);
      doc.circle(PW / 2 - 38, 62, 0.9, 'F');
      doc.circle(PW / 2,      62, 1.2, 'F');
      doc.circle(PW / 2 + 38, 62, 0.9, 'F');

      /* ── Report title ── */
      doc.setFontSize(16);
      doc.setTextColor(...C_DARK);
      doc.text(fixArabic('تقرير الرقابة الميدانية'), PW / 2, 70, { align: 'center' });

      /* ── Season line ── */
      doc.setFontSize(10);
      doc.setTextColor(...C_GRAY);
      doc.text(fixArabic(BRAND.tagline), PW / 2, 77, { align: 'center' });

      /* ── Double-line divider (thicker + thinner under it) ── */
      doc.setDrawColor(...C_GOLD);
      doc.setLineWidth(0.6);
      doc.line(ML, 82.5, PW - MR, 82.5);
      doc.setLineWidth(0.2);
      doc.line(ML, 83.7, PW - MR, 83.7);

    } else {
      /* ── Mini header band ── */
      doc.setFillColor(...C_LIGHT);
      doc.rect(0, 0, PW, 16, 'F');

      /* Small accent square on the right side */
      doc.setFillColor(...C_GOLD);
      doc.rect(PW - ML - 1.5, 5, 1.5, 6, 'F');

      /* Brand on the right */
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...C_GOLD);
      doc.text(fixArabic(BRAND.companyName), PW - ML - 4, 10, { align: 'right' });

      /* Title centered */
      doc.setFontSize(9.5);
      doc.setTextColor(...C_DARK);
      doc.text(fixArabic('تقرير الرقابة الميدانية'), PW / 2, 10, { align: 'center' });

      /* Page number with prefix */
      doc.setFontSize(8.5);
      doc.setTextColor(...C_GRAY);
      doc.text(
        fixArabic(`صفحة ${toArabicNum(pageNum)}`),
        ML, 10, { align: 'left' }
      );

      /* Gold divider line */
      doc.setDrawColor(...C_GOLD);
      doc.setLineWidth(0.5);
      doc.line(0, 16, PW, 16);
    }
  }

  /* ── drawPageFooter ── */
  function drawPageFooter() {
    /* Gold accent line */
    doc.setDrawColor(...C_GOLD);
    doc.setLineWidth(0.4);
    doc.line(ML, PH - 14, PW - MR, PH - 14);

    /* Thin secondary line below the gold one */
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.15);
    doc.line(ML, PH - 13, PW - MR, PH - 13);

    doc.setFont('Cairo', 'normal');

    /* Brand label on the right */
    doc.setFontSize(8);
    doc.setTextColor(...C_GOLD);
    doc.text(fixArabic(BRAND.companyName), PW - MR, PH - 8, { align: 'right' });

    /* Centered tagline */
    doc.setFontSize(8);
    doc.setTextColor(...C_GRAY);
    doc.text(
      fixArabic(BRAND.tagline),
      PW / 2, PH - 8, { align: 'center' }
    );

    /* Page number on the left */
    doc.setFontSize(8);
    doc.setTextColor(...C_GRAY);
    doc.text(
      fixArabic(`صفحة ${toArabicNum(pageNum)}`),
      ML, PH - 8, { align: 'left' }
    );
  }

  /* Render one info-table per incident report / logistics request.
     Each card lists key→value pairs (number, observer, type, status,
     timestamps, elapsed duration) + a description/notes block. */
  function drawIncidentCards(records, typeKey, tRgb) {
    const isReport = typeKey === 'reports';
    const terminals = isReport ? TERMINAL_REPORT_STATUSES : TERMINAL_LOGISTICS_STATUSES;

    records.forEach((rec) => {
      const closedMs = toMs(rec.closedAt);
      const isClosed = terminals.includes(rec.status) && closedMs != null;
      const elapsedMs = getTotalElapsedMs(rec, terminals);

      const rows = [];
      const num = isReport ? rec.reportNumber : rec.requestNumber;
      rows.push([fixArabic(isReport ? 'رقم البلاغ' : 'رقم الطلب'),  num ?? '—']);
      rows.push([fixArabic('المراقب'),                                fixArabic(rec.observer ?? '—')]);
      if (isReport) {
        rows.push([fixArabic('النوع'),    fixArabic(REPORT_TYPE_LABELS[rec.reportType] ?? rec.reportType ?? '—')]);
        rows.push([fixArabic('الخطورة'),  fixArabic(SEVERITY_LABELS[rec.severity] ?? rec.severity ?? '—')]);
        rows.push([fixArabic('الحالة'),   fixArabic(REPORT_STATUS_LABELS[rec.status] ?? rec.status ?? '—')]);
      } else {
        rows.push([fixArabic('الفئة'),       fixArabic(LOGISTICS_CATEGORY_LABELS[rec.category] ?? rec.category ?? '—')]);
        rows.push([fixArabic('نوع الإسناد'), fixArabic(SUPPORT_LABELS[rec.supportType] ?? rec.supportType ?? '—')]);
        if (rec.qtyInternal != null) rows.push([fixArabic('كمية داخلي'), toArabicNum(String(rec.qtyInternal))]);
        if (rec.qtyExternal != null) rows.push([fixArabic('كمية خارجي'), toArabicNum(String(rec.qtyExternal))]);
        if (rec.reportNumber) rows.push([fixArabic('بلاغ مرتبط'), `#${rec.reportNumber}`]);
        rows.push([fixArabic('الحالة'), fixArabic(LOGISTICS_STATUS_LABELS[rec.status] ?? rec.status ?? '—')]);
      }
      rows.push([fixArabic('جاء في'), fixArabic(formatSubmitTime(rec.timestamp))]);
      if (isClosed) rows.push([fixArabic('تاريخ الإغلاق'), fixArabic(formatSubmitTime(rec.closedAt))]);
      rows.push([
        fixArabic(isClosed ? 'المدة الكاملة' : 'المدة حتى الآن'),
        fixArabic(fmtDuration(elapsedMs)),
      ]);

      const body = rec.reportNumber || rec.requestNumber ? rows : rows;

      autoTable(doc, {
        ...TABLE_BASE,
        startY: (doc.lastAutoTable?.finalY ?? 24) + 4,
        body,
        headStyles: { ...TABLE_BASE.headStyles, fillColor: tRgb },
        styles:     { ...TABLE_BASE.styles, fontSize: 9, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 40, halign: 'right', fontStyle: 'bold', fillColor: [248, 245, 240] },
          1: { cellWidth: 'auto', halign: 'right' },
        },
        theme: 'grid',
      });

      const longText = isReport ? rec.description : rec.notes;
      if (longText) {
        autoTable(doc, {
          ...TABLE_BASE,
          startY: doc.lastAutoTable.finalY,
          head:   [[fixArabic(isReport ? 'الوصف' : 'ملاحظات')]],
          body:   [[fixArabic(longText)]],
          headStyles: { ...TABLE_BASE.headStyles, fillColor: tRgb, fontSize: 9 },
          styles:     { ...TABLE_BASE.styles, fontSize: 9, cellPadding: 3 },
          columnStyles: { 0: { cellWidth: 'auto', halign: 'right' } },
          theme: 'grid',
        });
      }
    });
  }

  /* ──────────────────────────────────────────────
     drawDetailSection — for detailed-mode PDFs
     Renders one breakdown card per record:
       • header line: observer + score badge
       • info line:   date + meal type (for meals)
       • red box:     list of all questions answered «لا»
                      with full question text
  ────────────────────────────────────────────── */
  function drawDetailSection(records, typeKey, typeMeta) {
    if (!records?.length) return;
    const allQs   = QUESTION_BANK[typeKey] || [];
    const qsById  = new Map(allQs.map(q => [String(q.id), q]));
    const tRgb    = hexToRgb(typeMeta?.color ?? '#7C3AED');

    /* Section header */
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      body:   [[fixArabic(`التفاصيل الفردية — ${toArabicNum(records.length)} سجل`)]],
      styles: {
        font:        'Cairo',
        fontStyle:   'normal',
        fontSize:    10,
        halign:      'right',
        cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
        lineWidth:   0,
        fillColor:   tRgb,
        textColor:   C_WHITE,
      },
      tableWidth:   CW,
      columnStyles: { 0: { cellWidth: CW } },
      theme: 'plain',
      margin: { left: ML, right: ML },
    });

    for (const rec of records) {
      const obs     = rec.observer ?? rec.observerName ?? '—';
      const score   = getRecordScore(rec);
      const dateStr = rec.scheduled_date ?? rec.scheduledDate ?? '—';
      const mealLbl = rec.mealType ? (MEAL_LABELS[rec.mealType] ?? rec.mealType) : '';

      /* Collect "no" answers with full question text */
      const noQs = [];
      const ans  = rec.answers ?? {};
      for (const [k, v] of Object.entries(ans)) {
        if (v !== 'لا') continue;
        const q = qsById.get(String(k));
        if (q) noQs.push(q);
      }

      /* Header row: observer (right) + score (left)
         NOTE: fontStyle 'bold' would force jsPDF to look up 'Cairo-Bold',
         which we never registered — that falls back to Helvetica and
         renders Arabic as garbled bytes. Keep 'normal' everywhere. */
      const scoreText = score == null ? '—' : toArabicNum(`${score.toFixed(1)} / 10`);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 2,
        body: [[fixArabic(scoreText), fixArabic(obs)]],
        styles: {
          font:        'Cairo',
          fontStyle:   'normal',
          fontSize:    10,
          halign:      'right',
          cellPadding: { top: 3, right: 5, bottom: 3, left: 5 },
          lineWidth:   0.3,
          lineColor:   tRgb,
          fillColor:   C_LIGHT,
          textColor:   C_DARK,
        },
        tableWidth: CW,
        columnStyles: {
          0: { cellWidth: 38,      halign: 'center', textColor: tRgb },
          1: { cellWidth: CW - 38 },
        },
        theme: 'plain',
        margin: { left: ML, right: ML },
      });

      /* Info grid: center, caterer, date, meal, submission time.
         Rendered as a 2-column table — value (left) | label+value pair.
         Each row holds two key/value cells to save vertical space. */
      const recCenter  = rec.center || rec.centerId || '—';
      const recCaterer = rec.caterer
        || (CENTERS.find(c => c.id === recCenter)?.caterer)
        || '—';
      const submitStr  = formatSubmitTime(rec.timestamp);

      const pairs = [];
      pairs.push([`المركز: ${recCenter}`, `التاريخ: ${dateStr}`]);
      if (mealLbl) {
        pairs.push([`المتعهد: ${recCaterer}`, `الوجبة: ${mealLbl}`]);
        pairs.push([`وقت الإرسال: ${submitStr}`, '']);
      } else {
        pairs.push([`المتعهد: ${recCaterer}`, `وقت الإرسال: ${submitStr}`]);
      }

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY,
        body:   pairs.map(([left, right]) => [fixArabic(left), fixArabic(right)]),
        styles: {
          font:        'Cairo',
          fontStyle:   'normal',
          fontSize:    8,
          halign:      'right',
          cellPadding: { top: 2, right: 5, bottom: 2, left: 5 },
          lineWidth:   0.3,
          lineColor:   tRgb,
          fillColor:   [250, 250, 248],
          textColor:   C_DARK,
          overflow:    'linebreak',
        },
        tableWidth: CW,
        columnStyles: {
          0: { cellWidth: CW / 2, textColor: C_GRAY },
          1: { cellWidth: CW / 2, textColor: C_GRAY },
        },
        theme: 'plain',
        margin: { left: ML, right: ML },
      });

      /* "No" answers list — or "no violations" message.
         IMPORTANT: explicit cellWidth + tableWidth forces autoTable to
         honour `overflow: 'linebreak'` for long question texts (otherwise
         a single-column table with cellWidth:'auto' grows to fit the
         widest row and never wraps). */
      if (noQs.length) {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY,
          head:   [[fixArabic(`الأسئلة المُجابة بـ«لا» (${toArabicNum(noQs.length)})`)]],
          body:   noQs.map(q => [fixArabic(q.text)]),
          styles: {
            font:        'Cairo',
            fontStyle:   'normal',
            fontSize:    8.5,
            halign:      'right',
            cellPadding: { top: 2.5, right: 6, bottom: 2.5, left: 6 },
            lineWidth:   0.3,
            lineColor:   [254, 202, 202],
            fillColor:   [254, 242, 242],
            textColor:   [127, 29, 29],
            overflow:    'linebreak',
          },
          headStyles: {
            font:        'Cairo',
            fontStyle:   'normal',
            fontSize:    9,
            halign:      'right',
            fillColor:   [220, 38, 38],
            textColor:   C_WHITE,
            cellPadding: { top: 2.5, right: 6, bottom: 2.5, left: 6 },
          },
          tableWidth:   CW,
          columnStyles: { 0: { cellWidth: CW } },
          theme: 'plain',
          margin: { left: ML, right: ML },
        });
      } else {
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY,
          body: [[fixArabic('لا توجد أسئلة مُجابة بـ«لا» في هذا السجل')]],
          styles: {
            font:        'Cairo',
            fontStyle:   'normal',
            fontSize:    8.5,
            halign:      'right',
            cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
            lineWidth:   0.3,
            lineColor:   [187, 247, 208],
            fillColor:   [220, 252, 231],
            textColor:   [22, 101, 52],
          },
          tableWidth:   CW,
          columnStyles: { 0: { cellWidth: CW } },
          theme: 'plain',
          margin: { left: ML, right: ML },
        });
      }
    }
  }

  drawPageHeader(true);

  /* ── Metadata card ──
     Each row auto-sizes (1 or 2 lines) using wrapArabicLines.
     Rows: المركز | المتعهد | التاريخ | المراقب | أنواع التقارير | تاريخ الإصدار */
  const centerLabel = !Array.isArray(centerFilter) || centerFilter.length === 0
    ? 'جميع المراكز'
    : centerFilter.length === 1
      ? centerFilter[0]
      : centerFilter.length <= 3
        ? centerFilter.join(' • ')
        : `${centerFilter.length} مراكز محددة`;
  const metaRows = [
    ['المركز',         centerLabel],
    ['اسم المتعهد',    contractorName],
    ['التاريخ',        dateFilter || 'جميع الأيام'],
    ['اسم المراقب',    observerDisplay],
    ['أنواع التقارير',
      types
        .map(t => REPORT_TYPES.find(r => r.key === t)?.label)
        .filter(Boolean)
        .join(' • ')],
    ['تاريخ الإصدار',  nowStr],
  ];

  /* Precompute wrapped lines for each value at the value font size,
     so we can size the card and rows correctly before drawing. */
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(11);
  const VAL_MAX_W = CW - 16;
  const metaPrep = metaRows.map(([lbl, val]) => ({
    lbl,
    lines: wrapArabicLines(doc, val, VAL_MAX_W).slice(0, 2),
  }));

  const ROW_TOP    = 4;
  const LABEL_OFF  = 0;       // label sits at top of row
  const VAL_OFF    = 5.5;     // first value line offset below label
  const VAL_LINE_H = 5.5;     // gap between wrapped value lines
  const ROW_BOT    = 3;
  const rowHeights = metaPrep.map(r =>
    ROW_TOP + 2.5 + VAL_OFF + (r.lines.length - 1) * VAL_LINE_H + ROW_BOT
  );
  const cardH = rowHeights.reduce((s, h) => s + h, 0) + 4;
  const cardY = 90;

  doc.setFillColor(...C_LIGHT);
  doc.setDrawColor(...C_GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, cardY, CW, cardH, 4, 4, 'FD');

  /* Gold right accent bar with a softer width (RTL → leading edge on the right) */
  doc.setFillColor(...C_GOLD);
  doc.rect(PW - ML - 3, cardY, 3, cardH, 'F');

  /* Small gold cap at top of accent bar for elegance */
  doc.setFillColor(196, 164, 110); // lighter gold
  doc.rect(PW - ML - 3, cardY, 3, 5, 'F');

  let my = cardY + 2;
  metaPrep.forEach((r, idx) => {
    const rowStart = my;
    my += ROW_TOP;

    /* Label */
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C_GOLD);
    doc.text(fixArabic(r.lbl), PW - ML - 6, my, { align: 'right' });

    /* Value lines (already reshaped + reversed) */
    doc.setFontSize(11);
    doc.setTextColor(...C_DARK);
    r.lines.forEach((line, lineIdx) => {
      doc.text(line, PW - ML - 6, my + VAL_OFF + lineIdx * VAL_LINE_H, { align: 'right' });
    });

    my = rowStart + rowHeights[idx];

    /* Hairline separator between rows */
    if (idx < metaPrep.length - 1) {
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.15);
      doc.line(ML + 5, my - 0.5, PW - ML - 6, my - 0.5);
    }
  });

  const afterCardY = cardY + cardH + 8;

  /* ── Summary count — boxed badge for visual weight ── */
  const totalRecs = types.reduce((s, t) => s + (data[t]?.length ?? 0), 0);
  doc.setFont('Cairo', 'normal');

  /* Right-aligned pill background */
  const badgeText = fixArabic(`إجمالي السجلات: ${toArabicNum(totalRecs)}`);
  doc.setFontSize(11);
  const badgeW = doc.getTextWidth(badgeText) + 10;
  const badgeH = 8;
  const badgeY = afterCardY - 5.5;
  const badgeX = PW - ML - badgeW;

  doc.setFillColor(...C_GOLD);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');

  doc.setTextColor(...C_WHITE);
  doc.text(badgeText, PW - ML - 5, afterCardY, { align: 'right' });

  /* ── Summary table ── */
  const summaryBody = types
    .filter(t => data[t]?.length > 0)
    .map(t => {
      const recs = data[t];
      const meta = REPORT_TYPES.find(r => r.key === t);
      const avg  =
        t === 'meal_evaluations' && recs.length
          ? (recs.reduce((s, d) => s + (parseFloat(d.percentage) || 0), 0) /
              recs.length / 10).toFixed(1)
          : '—';
      return [
        toArabicNum(recs.length),
        avg !== '—' ? toArabicNum(`${avg}/10`) : '—',
        fixArabic(meta?.label ?? t),
      ];
    });

  if (summaryBody.length) {
    autoTable(doc, {
      ...TABLE_BASE,
      head: [[
        fixArabic('السجلات'),
        fixArabic('متوسط الدرجة'),
        fixArabic('نوع التقرير'),
      ]],
      body:   summaryBody,
      startY: afterCardY + 5,
      headStyles: { ...TABLE_BASE.headStyles, fillColor: C_GOLD, fontSize: 9 },
      styles:     { ...TABLE_BASE.styles, fontSize: 9, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 26, halign: 'center' },
        1: { cellWidth: 34, halign: 'center' },
        2: { cellWidth: 'auto' },
      },
    });
  }

  drawPageFooter();

  /* If centerFilter is empty → derive centers from the data;
     otherwise use the explicit selection. Always sort by numeric prefix. */
  const sortByNum = (a, b) => {
    const na = parseInt((a ?? '').replace(/\D/g, '')) || 0;
    const nb = parseInt((b ?? '').replace(/\D/g, '')) || 0;
    return na - nb;
  };
  const centers =
    !Array.isArray(centerFilter) || centerFilter.length === 0
      ? [
          ...new Set(
            types.flatMap(t =>
              (data[t] ?? []).map(d => d.center).filter(Boolean)
            )
          ),
        ].sort(sortByNum)
      : [...centerFilter].sort(sortByNum);

  for (const center of centers) {
    for (const type of types) {
      const typeMeta = REPORT_TYPES.find(r => r.key === type);
      const recs     = (data[type] ?? []).filter(d => d.center === center);
      if (!recs.length) continue;

      doc.addPage();
      drawPageHeader(false);

      let y = 24;

      /* ── Center title with gold square accent on the right ── */
      doc.setFillColor(...C_GOLD);
      doc.rect(PW - ML - 1.2, y - 4.5, 1.5, 6, 'F');

      doc.setFont('Cairo', 'normal');
      doc.setFontSize(15);
      doc.setTextColor(...C_DARK);
      doc.text(fixArabic(center), PW - ML - 4, y, { align: 'right' });
      y += 6.5;

      /* Contractor name — multi-line aware */
      const pageCaterer = CENTERS.find(c => c.id === center)?.caterer ?? '';
      if (pageCaterer) {
        doc.setFont('Cairo', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...C_GRAY);
        const catLines = wrapArabicLines(doc, pageCaterer, CW - 4).slice(0, 2);
        catLines.forEach((line, i) => {
          doc.text(line, PW - ML - 4, y + i * 4.5, { align: 'right' });
        });
        y += catLines.length * 4.5 + 2;
      }

      /* ── Report-type tag (pill with bg color) ── */
      const tRgb = hexToRgb(typeMeta?.color ?? '#7C3AED');
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(9.5);
      const tagText = fixArabic(typeMeta?.label ?? type);
      const tagW = doc.getTextWidth(tagText) + 10;
      const tagH = 6.5;
      doc.setFillColor(...tRgb);
      doc.roundedRect(PW - ML - tagW, y - 4.5, tagW, tagH, 1.5, 1.5, 'F');
      doc.setTextColor(...C_WHITE);
      doc.text(tagText, PW - ML - 5, y, { align: 'right' });
      y += 5;

      /* Thin colored rule beneath the tag */
      doc.setDrawColor(...tRgb);
      doc.setLineWidth(0.5);
      doc.line(ML, y, PW - MR, y);
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.15);
      doc.line(ML, y + 0.8, PW - MR, y + 0.8);
      y += 6;

      /* ── Data table ── */
      if (type === 'meal_evaluations') {
        const rows = recs.map(d => {
          const ans   = d.answers ?? {};
          const yes   = Object.values(ans).filter(v => v === 'نعم').length;
          const no    = Object.values(ans).filter(v => v === 'لا').length;
          const s     = getRecordScore(d);
          const score = s == null ? '—' : toArabicNum(`${s.toFixed(1)}/10`);
          return [
            score,
            toArabicNum(yes),
            toArabicNum(no),
            fixArabic(d.scheduled_date ?? '—'),
            fixArabic(MEAL_LABELS[d.mealType] ?? d.mealType ?? '—'),
            fixArabic(d.observer ?? d.observerName ?? '—'),
          ];
        });

        autoTable(doc, {
          ...TABLE_BASE,
          head: [[
            fixArabic('الدرجة'),
            fixArabic('نعم'),
            fixArabic('لا'),
            fixArabic('التاريخ'),
            fixArabic('الوجبة'),
            fixArabic('المراقب'),
          ]],
          body:   rows,
          startY: y,
          headStyles: { ...TABLE_BASE.headStyles, fillColor: C_GOLD },
          columnStyles: {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 14, halign: 'center' },
            2: { cellWidth: 14, halign: 'center' },
            3: { cellWidth: 42 },
            4: { cellWidth: 22 },
            5: { cellWidth: 'auto' },
          },
        });

      } else if (type === 'reports' || type === 'logistics_requests') {
        drawIncidentCards(recs, type, tRgb);

      } else {
        /* mina_readiness / arafat_readiness */
        const rows = recs.map(d => {
          const ans = d.answers ?? {};
          const yes = Object.values(ans).filter(v => v === 'نعم').length;
          const no  = Object.values(ans).filter(v => v === 'لا').length;
          const s   = getRecordScore(d);
          const score = s == null ? '—' : toArabicNum(`${s.toFixed(1)}/10`);
          return [
            score,
            toArabicNum(yes),
            toArabicNum(no),
            fixArabic(d.scheduledDate ?? d.scheduled_date ?? '—'),
            fixArabic(d.observer ?? d.observerName ?? '—'),
          ];
        });

        autoTable(doc, {
          ...TABLE_BASE,
          head: [[
            fixArabic('الدرجة'),
            fixArabic('نعم'),
            fixArabic('لا'),
            fixArabic('التاريخ'),
            fixArabic('المراقب'),
          ]],
          body:   rows,
          startY: y,
          headStyles: { ...TABLE_BASE.headStyles, fillColor: tRgb },
          columnStyles: {
            0: { cellWidth: 24, halign: 'center' },
            1: { cellWidth: 14, halign: 'center' },
            2: { cellWidth: 14, halign: 'center' },
            3: { cellWidth: 42 },
            4: { cellWidth: 'auto' },
          },
        });
      }

      /* ─────────────────────────────────────────
         DETAILED MODE — per-record breakdown
      ───────────────────────────────────────── */
      if (detailed && QUESTION_BANK[type]) {
        drawDetailSection(recs, type, typeMeta);
      }

      drawPageFooter();
    }
  }

  /* ── Open as preview in new tab (revoke later) ──
     Matches the Hajj-Dashboard pattern: view first, save from browser. */
  const blob = doc.output('blob');
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {
    // Popup blocked — fall back to direct download so user still gets the file.
    doc.save(`تقرير-ضيوف-البيت-${Date.now()}.pdf`);
  }
  // Free memory after the user has had time to view/save.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function CenterMultiSelect({ value, onChange, onToggle, search, onSearchChange, disabled }) {
  const filtered = useMemo(() => {
    const q = (search || '').trim();
    if (!q) return CENTERS;
    return CENTERS.filter(c => c.id.includes(q) || (c.caterer || '').includes(q));
  }, [search]);

  const allSelected = value.length === CENTERS.length;
  const summary = value.length === 0
    ? 'جميع المراكز'
    : value.length === 1
      ? value[0]
      : `${value.length} مركز محدد`;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <Building2 size={13} className="text-primary" />
          <label className="text-xs font-black text-ink uppercase tracking-wide">المركز</label>
        </div>
        <span className="text-[10px] font-bold text-muted tabular-nums">{summary}</span>
      </div>

      {/* Action row: select all / clear */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : CENTERS.map(c => c.id))}
          disabled={disabled}
          className="text-[11px] font-black px-2.5 py-1.5 rounded-lg border border-primary/30 bg-background text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-60"
        >
          {allSelected ? 'إلغاء التحديد' : 'تحديد الكل'}
        </button>
        {value.length > 0 && !allSelected && (
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-[11px] font-black px-2.5 py-1.5 rounded-lg border border-[#E3E8EF] text-muted hover:bg-[#EEF2FF] transition-colors disabled:opacity-60"
          >
            مسح
          </button>
        )}
        <span className="ml-auto text-[10px] font-bold text-muted tabular-nums">
          {value.length === 0 ? 'لا تحديد = الكل' : `${value.length} / ${CENTERS.length}`}
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" weight="bold" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          disabled={disabled}
          placeholder="ابحث برقم المركز أو المتعهد..."
          className="w-full pr-9 pl-3 py-2 rounded-xl border border-[#E3E8EF] bg-[#F6F8FB] text-xs font-bold text-ink placeholder:text-[#64748B] focus:border-primary focus:outline-none transition-colors disabled:opacity-60"
        />
      </div>

      {/* Chips grid */}
      <div className="max-h-[180px] overflow-y-auto bg-[#F6F8FB] border border-[#E3E8EF] rounded-2xl p-2">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-center text-muted py-6 font-bold">لا يوجد مركز مطابق</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {filtered.map(c => {
              const active = value.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggle(c.id)}
                  disabled={disabled}
                  title={c.caterer || c.id}
                  className={`relative flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black border-2 transition-all disabled:opacity-60 ${
                    active
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-ink border-[#E3E8EF] hover:border-primary/40'
                  }`}
                >
                  {active && <Check size={10} weight="bold" />}
                  <span className="truncate">{c.id}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportModal({ onClose }) {
  /* centerFilter is now an array of center IDs.
     Empty array = "all centers" (no restriction). */
  const [centerFilter, setCenterFilter] = useState([]);
  const [centerSearch, setCenterSearch] = useState('');
  const [dateFilter,   setDateFilter]   = useState('');
  const [types, setTypes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [progress,   setProgress]   = useState('');
  const [error,      setError]      = useState('');

  const toggleType = (key) =>
    setTypes(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  const toggleCenter = (id) =>
    setCenterFilter(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );

  /* Open the HTML report view in a new tab. */
  const handleGenerate = (detailed = false) => {
    if (!types.length) { setError('اختر نوعاً واحداً على الأقل'); return; }
    setError('');

    const params = new URLSearchParams();
    if (centerFilter.length > 0) params.set('center', centerFilter.join(','));
    if (dateFilter) params.set('date', dateFilter);
    params.set('types', types.join(','));
    if (detailed) params.set('detailed', '1');

    const url = `/admin/report-view?${params.toString()}`;
    const win = window.open(url, '_blank', 'noopener');
    if (!win) {
      setError('المتصفح حجب فتح التبويب — اسمح بالتبويبات المنبثقة من إعدادات الموقع.');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!generating ? onClose : undefined}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-[0_24px_80px_rgba(30,27,46, 0.25)] border border-[#E3E8EF] overflow-hidden"
        style={{ animation: 'rg-slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards' }}
      >
        {/* ── Modal header ── */}
        <div
          className="px-6 py-5 border-b border-[#E3E8EF]"
          style={{ background: 'linear-gradient(135deg,#F8FAFC 0%,#fff 60%)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-2xl blur-lg opacity-50"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#7C3AED)' }}
                />
                <div
                  className="relative w-10 h-10 rounded-2xl flex items-center justify-center shadow-md"
                  style={{ background: 'rgb(var(--c-accent))' }}
                >
                  <Eye size={18} className="text-primary" weight="bold" />
                </div>
              </div>
              <div>
                <h2 className="font-bold text-ink text-base">عرض تقرير</h2>
                <p className="text-[11px] text-muted mt-0.5">حدّد الفلاتر ثم اعرض المعاينة</p>
              </div>
            </div>
            <button
              onClick={!generating ? onClose : undefined}
              disabled={generating}
              className="w-9 h-9 rounded-xl border border-[#E3E8EF] flex items-center justify-center hover:bg-[#EEF2FF] transition-colors disabled:opacity-40"
            >
              <X size={16} className="text-muted" />
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="p-6 space-y-5 max-h-[58vh] overflow-y-auto">

          {/* 1. Center */}
          <CenterMultiSelect
            value={centerFilter}
            onChange={setCenterFilter}
            onToggle={toggleCenter}
            search={centerSearch}
            onSearchChange={setCenterSearch}
            disabled={generating}
          />

          {/* 2. Day */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Calendar size={13} className="text-primary" />
              <label className="text-xs font-black text-ink uppercase tracking-wide">
                اليوم
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setDateFilter('')}
                disabled={generating}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-60 ${
                  !dateFilter
                    ? 'bg-primary text-white border-transparent shadow-md'
                    : 'bg-[#F6F8FB] text-muted border-[#E3E8EF] hover:border-primary/50'
                }`}
              >
                الكل
              </button>
              {DHU_DAYS.map(d => {
                const dayNum = d.split(' ')[0];
                const active = dateFilter === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDateFilter(active ? '' : d)}
                    disabled={generating}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-60 ${
                      active
                        ? 'bg-primary text-white border-transparent shadow-md'
                        : 'bg-[#F6F8FB] text-muted border-[#E3E8EF] hover:border-primary/50'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
            {dateFilter && (
              <p className="text-[11px] text-primary font-bold mt-2 text-center">
                {dateFilter}
              </p>
            )}
          </div>

          {/* 3. Report type */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <ClipboardList size={13} className="text-primary" />
              <label className="text-xs font-black text-ink uppercase tracking-wide">
                نوع التقرير
              </label>
            </div>
            <div className="space-y-2">
              {REPORT_TYPES.map(rt => {
                const active = types.includes(rt.key);
                return (
                  <button
                    key={rt.key}
                    onClick={() => toggleType(rt.key)}
                    disabled={generating}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all disabled:opacity-60 text-right"
                    style={
                      active
                        ? {
                            background:  `${rt.color}10`,
                            borderColor: `${rt.color}50`,
                            boxShadow:   `0 2px 10px ${rt.color}1A`,
                          }
                        : { background: '#F6F8FB', borderColor: '#E3E8EF' }
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full transition-colors"
                        style={{ background: active ? rt.color : '#E3E8EF' }}
                      />
                      <span
                        className="text-sm font-bold"
                        style={{ color: active ? rt.color : '#2C3E63' }}
                      >
                        {rt.label}
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        active ? 'border-transparent' : 'border-[#E3E8EF]'
                      }`}
                      style={active ? { background: rt.color } : {}}
                    >
                      {active && (
                        <CheckCircle2 size={11} className="text-white" weight="bold" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-600 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* ── Generate buttons ── */}
        <div className="px-6 py-4 border-t border-[#E3E8EF] bg-background">
          {progress && (
            <div className="flex items-center gap-2 mb-3 bg-background border border-line rounded-xl px-3 py-2">
              <Loader2 size={13} className="animate-spin text-primary shrink-0" />
              <span className="text-[11px] font-bold text-primary">{progress}</span>
            </div>
          )}

          {/* Info hint: opens preview in a new tab */}
          <div className="flex items-start gap-2 mb-3 bg-background border border-line rounded-xl px-3 py-2.5">
            <Info size={14} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted leading-relaxed">
              التقرير راح يفتح في <span className="font-bold text-primary">تبويب جديد</span> للمعاينة.
              تقدر تحفظه أو تطبعه من زر <span className="font-bold">«حفظ كـ PDF»</span> في المتصفح.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating || !types.length}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-ink font-bold text-sm transition-all disabled:opacity-50 active:scale-[0.98] bg-white border-2 border-ink hover:bg-background"
            >
              {generating
                ? <><Loader2 size={16} className="animate-spin" /> جارٍ التحضير...</>
                : <><ListChecks size={16} /> عرض مفصّل (مع أسئلة المخالفات)</>}
            </button>
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating || !types.length}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-[0.98] shadow-[0_4px_20px_rgba(79,70,229, 0.35)] hover:shadow-[0_6px_28px_rgba(79,70,229, 0.45)]"
              style={{ background: 'linear-gradient(135deg,#A78BFA 0%,#7C3AED 50%,#6D28D9 100%)' }}
            >
              {generating
                ? <><Loader2 size={16} className="animate-spin" /> جارٍ التحضير...</>
                : <><Eye size={16} weight="bold" /> عرض التقرير</>}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rg-slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}

export default function AdminReportGenerator() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        /* Navy text, not white: #30D9CB is light enough that white sits at
           ~1.7:1 against it, while the brand navy clears 8:1. */
        className="group relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-primary text-xs font-bold transition-all active:scale-95 shadow-[0_4px_16px_rgb(var(--c-accent)/0.40)] hover:shadow-[0_6px_24px_rgb(var(--c-accent)/0.55)] hover:opacity-90"
        style={{ background: 'rgb(var(--c-accent))' }}
      >
        <Eye size={14} weight="bold" className="group-hover:scale-110 transition-transform duration-300" />
        عرض تقرير
      </button>

      {open && <ReportModal onClose={() => setOpen(false)} />}
    </>
  );
}
