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

import { useState }                              from 'react';
import { collection, getDocs, query, where }     from 'firebase/firestore';
import { db }                                    from '../../config/db.js';
import { CENTERS }                               from '../../config/centers.js';
import { cairoBase64 }                           from '../../assets/fonts/CairoFont.js';
import logoSrc                                   from '../../assets/logo.png';
import {
  FileText, X, ChevronDown, Loader2,
  CheckCircle2, Building2, Calendar, ClipboardList,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════
   Domain constants
══════════════════════════════════════════════════════ */
const DHU_DAYS = [
  '٧ ذو الحجة ١٤٤٧',
  '٨ ذو الحجة ١٤٤٧',
  '٩ ذو الحجة ١٤٤٧',
  '١٠ ذو الحجة ١٤٤٧',
  '١١ ذو الحجة ١٤٤٧',
  '١٢ ذو الحجة ١٤٤٧',
  '١٣ ذو الحجة ١٤٤٧',
];

const REPORT_TYPES = [
  { key: 'meal_evaluations', label: 'تقييم جودة الوجبات', color: '#A98159' },
  { key: 'mina_readiness',   label: 'جاهزية مشعر منى',   color: '#2F855A' },
  { key: 'arafat_readiness', label: 'جاهزية مشعر عرفة',  color: '#0987A0' },
];

const MEAL_LABELS = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };

/* ══════════════════════════════════════════════════════════════════════════
   Arabic Reshaper
   ─────────────────────────────────────────────────────────────────────────
   jsPDF renders glyphs left-to-right using raw Unicode codepoints without
   any OpenType shaping.  Arabic requires two corrections:
     1. RESHAPING  – replace standard-block letters (U+0621–U+064A) with
                     their contextual Presentation Forms-B equivalents
                     (isolated / final / initial / medial).
     2. REVERSAL   – flip word and character order so jsPDF's LTR renderer
                     produces the correct right-to-left visual layout.

   fixArabic(text) is the public API.  Pass ANY string through it before
   handing it to doc.text() or autoTable body/head cells.
══════════════════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════
   Logo pre-loader
   Converts the Vite asset URL → base64 data-URL via
   canvas so jsPDF's addImage() can embed it without CORS.
   Result is module-level cached after the first call.
══════════════════════════════════════════════════════ */
let _logoDataUrl = null;

function getLogoDataUrl() {
  if (_logoDataUrl) return Promise.resolve(_logoDataUrl);
  return new Promise((resolve) => {
    const img       = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        _logoDataUrl = canvas.toDataURL('image/png');
      } catch { _logoDataUrl = null; }
      resolve(_logoDataUrl);
    };
    img.onerror = () => resolve(null);
    img.src = logoSrc;
  });
}

/* ══════════════════════════════════════════════════════
   Firestore data fetching
══════════════════════════════════════════════════════ */
async function fetchReportData({ centerFilter, dateFilter, types }) {
  const result = {};
  await Promise.all(types.map(async (type) => {
    const constraints = centerFilter !== 'all'
      ? [where('center', '==', centerFilter)]
      : [];
    const q    = constraints.length
      ? query(collection(db, type), ...constraints)
      : collection(db, type);
    const snap = await getDocs(q);
    let docs   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (dateFilter) {
      docs = docs.filter(d =>
        (d.scheduled_date ?? d.scheduledDate ?? '') === dateFilter
      );
    }
    docs.sort((a, b) =>
      (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0)
    );
    result[type] = docs;
  }));
  return result;
}

/* ══════════════════════════════════════════════════════
   Colour helpers
══════════════════════════════════════════════════════ */
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [0, 0, 0];
}

/* ══════════════════════════════════════════════════════════════════════════
   PDF Builder
   ─────────────────────────────────────────────────────────────────────────
   Critical order inside buildPDF():
     1. Register Cairo font (addFileToVFS → addFont → setFont) FIRST —
        before ANY doc.text() / splitTextToSize / autoTable call, otherwise:
        TypeError: Cannot read properties of undefined (reading 'widths')
     2. Await logo data-URL (Promise.all-compatible).
     3. Draw cover page with metadata card (center, contractor, date,
        observer, report types, generation timestamp).
     4. Draw data pages grouped by center → report type.
══════════════════════════════════════════════════════════════════════════ */
async function buildPDF({ data, centerFilter, dateFilter, types }) {
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
  const C_GOLD  = hexToRgb('#A98159');
  const C_DARK  = hexToRgb('#2D2926');
  const C_WHITE = [255, 255, 255];
  const C_LIGHT = hexToRgb('#FDF8F0');
  const C_GRAY  = hexToRgb('#9D8F85');
  const C_LINE  = hexToRgb('#D1C4B9');

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
      fontSize:    9,
      cellPadding: 3.5,
      lineColor:   C_LINE,
      lineWidth:   0.25,
      textColor:   C_DARK,
      valign:      'middle',
      overflow:    'linebreak',
    },
    headStyles: {
      font:      'Cairo',
      fontStyle: 'normal',
      halign:    'right',
      textColor: C_WHITE,
      fontSize:  9,
      cellPadding: 4,
      valign:    'middle',
    },
    alternateRowStyles: { fillColor: C_LIGHT },
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

  const contractorName =
    centerFilter !== 'all'
      ? (CENTERS.find(c => c.id === centerFilter)?.caterer ?? '—')
      : '—';

  let pageNum = 0;

  /* ─────────────────────────────────────────────────
     drawPageHeader
     isFirst=true  → tall decorative band (cover page)
     isFirst=false → slim mini-header (data pages)
  ───────────────────────────────────────────────── */
  function drawPageHeader(isFirst = false) {
    pageNum++;
    const bandH = isFirst ? 62 : 18;

    doc.setFillColor(...C_DARK);
    doc.rect(0, 0, PW, bandH, 'F');

    if (isFirst) {
      /* Decorative dot grid */
      doc.setFillColor(...C_GOLD);
      for (let x = 8; x < PW; x += 14)
        for (let y = 6; y < bandH; y += 14)
          doc.circle(x, y, 0.65, 'F');

      /* Logo — top-right corner */
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', PW - ML - 12, 4, 12, 12); }
        catch { /* silently skip */ }
      }

      /* Brand name */
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(24);
      doc.setTextColor(...C_GOLD);
      doc.text(fixArabic('ضيوف البيت'), PW / 2, 27, { align: 'center' });

      /* Report title */
      doc.setFontSize(12);
      doc.setTextColor(...C_WHITE);
      doc.text(fixArabic('تقرير الرقابة الميدانية'), PW / 2, 40, { align: 'center' });

      /* Season line */
      doc.setFontSize(8);
      doc.setTextColor(195, 175, 148);
      doc.text(fixArabic('موسم الحج ١٤٤٧ هـ'), PW / 2, 51, { align: 'center' });

    } else {
      /* Mini header: brand + title + page number */
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...C_GOLD);
      doc.text(fixArabic('ضيوف البيت'), PW - ML, 11, { align: 'right' });

      doc.setFontSize(9);
      doc.setTextColor(200, 185, 165);
      doc.text(fixArabic('تقرير الرقابة الميدانية'), PW / 2, 11, { align: 'center' });

      doc.setFontSize(9);
      doc.setTextColor(...C_GRAY);
      doc.text(toArabicNum(pageNum), ML, 11, { align: 'left' });

      doc.setDrawColor(...C_GOLD);
      doc.setLineWidth(0.4);
      doc.line(ML, 19, PW - MR, 19);
    }
  }

  /* ── drawPageFooter ── */
  function drawPageFooter() {
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.3);
    doc.line(ML, PH - 13, PW - MR, PH - 13);

    doc.setFont('Cairo', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C_GRAY);
    doc.text(
      fixArabic('منظومة المراقبة الميدانية — ضيوف البيت'),
      PW / 2, PH - 8, { align: 'center' }
    );
  }

  /* ════════════════════════════════════════════════
     COVER PAGE
  ════════════════════════════════════════════════ */
  drawPageHeader(true);

  /* ── Metadata card ──
     Each row auto-sizes (1 or 2 lines) using wrapArabicLines.
     Rows: المركز | المتعهد | التاريخ | المراقب | أنواع التقارير | تاريخ الإصدار */
  const metaRows = [
    ['المركز',         centerFilter === 'all' ? 'جميع المراكز' : centerFilter],
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
  doc.setFontSize(10);
  const VAL_MAX_W = CW - 16;
  const metaPrep = metaRows.map(([lbl, val]) => ({
    lbl,
    lines: wrapArabicLines(doc, val, VAL_MAX_W).slice(0, 2),
  }));

  const ROW_TOP    = 3.5;
  const LABEL_OFF  = 0;       // label sits at top of row
  const VAL_OFF    = 4.5;     // first value line offset below label
  const VAL_LINE_H = 5;       // gap between wrapped value lines
  const ROW_BOT    = 2.5;
  const rowHeights = metaPrep.map(r =>
    ROW_TOP + 2.5 + VAL_OFF + (r.lines.length - 1) * VAL_LINE_H + ROW_BOT
  );
  const cardH = rowHeights.reduce((s, h) => s + h, 0) + 4;
  const cardY = 65;

  doc.setFillColor(...C_LIGHT);
  doc.setDrawColor(...C_GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, cardY, CW, cardH, 3, 3, 'FD');

  /* Gold right accent bar (RTL → visually leading edge is on the right) */
  doc.setFillColor(...C_GOLD);
  doc.rect(PW - ML - 2.5, cardY, 2.5, cardH, 'F');

  let my = cardY + 2;
  metaPrep.forEach((r, idx) => {
    const rowStart = my;
    my += ROW_TOP;

    /* Label */
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_GRAY);
    doc.text(fixArabic(`${r.lbl}:`), PW - ML - 6, my, { align: 'right' });

    /* Value lines (already reshaped + reversed) */
    doc.setFontSize(10);
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

  /* ── Summary count ── */
  const totalRecs = types.reduce((s, t) => s + (data[t]?.length ?? 0), 0);
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...C_GOLD);
  doc.text(
    fixArabic(`إجمالي السجلات: ${toArabicNum(totalRecs)}`),
    PW - ML, afterCardY, { align: 'right' }
  );

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

  /* ════════════════════════════════════════════════
     DATA PAGES — grouped by center → report type
  ════════════════════════════════════════════════ */
  const centers =
    centerFilter === 'all'
      ? [
          ...new Set(
            types.flatMap(t =>
              (data[t] ?? []).map(d => d.center).filter(Boolean)
            )
          ),
        ].sort((a, b) => {
          const na = parseInt((a ?? '').replace(/\D/g, '')) || 0;
          const nb = parseInt((b ?? '').replace(/\D/g, '')) || 0;
          return na - nb;
        })
      : [centerFilter].filter(Boolean);

  for (const center of centers) {
    for (const type of types) {
      const typeMeta = REPORT_TYPES.find(r => r.key === type);
      const recs     = (data[type] ?? []).filter(d => d.center === center);
      if (!recs.length) continue;

      doc.addPage();
      drawPageHeader(false);

      let y = 28;

      /* Center name */
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(...C_DARK);
      doc.text(fixArabic(center), PW - ML, y, { align: 'right' });
      y += 6;

      /* Contractor name for this center — multi-line aware */
      const pageCaterer = CENTERS.find(c => c.id === center)?.caterer ?? '';
      if (pageCaterer) {
        doc.setFont('Cairo', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...C_GRAY);
        const catLines = wrapArabicLines(doc, pageCaterer, CW).slice(0, 2);
        catLines.forEach((line, i) => {
          doc.text(line, PW - ML, y + i * 4.5, { align: 'right' });
        });
        y += catLines.length * 4.5 + 1;
      }

      /* Report-type label + coloured rule */
      const tRgb = hexToRgb(typeMeta?.color ?? '#A98159');
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...tRgb);
      doc.text(fixArabic(typeMeta?.label ?? type), PW - ML, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(...tRgb);
      doc.setLineWidth(0.4);
      doc.line(ML, y, PW - MR, y);
      y += 5;

      /* ── Data table ── */
      if (type === 'meal_evaluations') {
        const rows = recs.map(d => {
          const ans   = d.answers ?? {};
          const yes   = Object.values(ans).filter(v => v === 'نعم').length;
          const no    = Object.values(ans).filter(v => v === 'لا').length;
          const pct   = parseFloat(d.percentage);
          const score = isNaN(pct) ? '—' : toArabicNum(`${(pct / 10).toFixed(1)}/10`);
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

      } else {
        /* mina_readiness / arafat_readiness */
        const rows = recs.map(d => {
          const ans = d.answers ?? {};
          const yes = Object.values(ans).filter(v => v === 'نعم').length;
          const no  = Object.values(ans).filter(v => v === 'لا').length;
          return [
            fixArabic(d.status === 'completed' ? 'مكتمل' : 'مُرسَل'),
            toArabicNum(yes),
            toArabicNum(no),
            fixArabic(d.scheduledDate ?? d.scheduled_date ?? '—'),
            fixArabic(d.observer ?? d.observerName ?? '—'),
          ];
        });

        autoTable(doc, {
          ...TABLE_BASE,
          head: [[
            fixArabic('الحالة'),
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

      drawPageFooter();
    }
  }

  /* ── Save ── */
  doc.save(`تقرير-ضيوف-البيت-${Date.now()}.pdf`);
}

/* ══════════════════════════════════════════════════════
   Filter Modal
══════════════════════════════════════════════════════ */
function ReportModal({ onClose }) {
  const [centerFilter, setCenterFilter] = useState('all');
  const [dateFilter,   setDateFilter]   = useState('');
  const [types, setTypes] = useState([
    'meal_evaluations', 'mina_readiness', 'arafat_readiness',
  ]);
  const [generating, setGenerating] = useState(false);
  const [progress,   setProgress]   = useState('');
  const [error,      setError]      = useState('');

  const toggleType = (key) =>
    setTypes(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  const handleGenerate = async () => {
    if (!types.length) { setError('اختر نوعاً واحداً على الأقل'); return; }
    setGenerating(true);
    setError('');
    try {
      setProgress('جاري جلب البيانات...');
      const data  = await fetchReportData({ centerFilter, dateFilter, types });
      const total = types.reduce((s, t) => s + (data[t]?.length ?? 0), 0);

      if (total === 0) {
        setError('لا توجد سجلات تطابق الفلاتر المحددة');
        setGenerating(false);
        setProgress('');
        return;
      }

      setProgress(`جاري إنشاء PDF (${total} سجل)...`);
      await buildPDF({ data, centerFilter, dateFilter, types });
      setProgress('');
      onClose();
    } catch (e) {
      console.error('PDF generation error:', e);
      setError('حدث خطأ أثناء الإنشاء — راجع Console للتفاصيل.');
    }
    setGenerating(false);
    setProgress('');
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
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-[0_24px_80px_rgba(45,41,38,0.25)] border border-[#EDE5DC] overflow-hidden"
        style={{ animation: 'rg-slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards' }}
      >
        {/* ── Modal header ── */}
        <div
          className="px-6 py-5 border-b border-[#EDE5DC]"
          style={{ background: 'linear-gradient(135deg,#FDF8F0 0%,#fff 60%)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159)' }}
              >
                <FileText size={18} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-[#2D2926] text-base">إصدار تقرير PDF</h2>
                <p className="text-[11px] text-[#9D8F85] mt-0.5">حدّد الفلاتر ثم اضغط إنشاء</p>
              </div>
            </div>
            <button
              onClick={!generating ? onClose : undefined}
              disabled={generating}
              className="w-9 h-9 rounded-xl border border-[#EDE5DC] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors disabled:opacity-40"
            >
              <X size={16} className="text-[#6D6E71]" />
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="p-6 space-y-5 max-h-[58vh] overflow-y-auto">

          {/* 1. Center */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Building2 size={13} className="text-[#A98159]" />
              <label className="text-xs font-black text-[#2D2926] uppercase tracking-wide">
                المركز
              </label>
            </div>
            <div className="relative">
              <select
                value={centerFilter}
                onChange={e => setCenterFilter(e.target.value)}
                disabled={generating}
                className="w-full appearance-none bg-[#FAFAF8] border border-[#EDE5DC] rounded-2xl px-4 py-3 pl-9 text-sm font-bold text-[#2D2926] outline-none focus:border-[#A98159] focus:shadow-[0_0_0_3px_rgba(169,129,89,0.1)] transition-all cursor-pointer disabled:opacity-60"
              >
                <option value="all">جميع المراكز</option>
                {CENTERS.map(c => (
                  <option key={c.id} value={c.id}>{c.id}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <ChevronDown size={14} className="text-[#9D8F85]" />
              </div>
            </div>
          </div>

          {/* 2. Day */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Calendar size={13} className="text-[#A98159]" />
              <label className="text-xs font-black text-[#2D2926] uppercase tracking-wide">
                اليوم
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setDateFilter('')}
                disabled={generating}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-60 ${
                  !dateFilter
                    ? 'bg-[#A98159] text-white border-transparent shadow-md'
                    : 'bg-[#FAFAF8] text-[#6D6E71] border-[#EDE5DC] hover:border-[#A98159]/50'
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
                        ? 'bg-[#A98159] text-white border-transparent shadow-md'
                        : 'bg-[#FAFAF8] text-[#6D6E71] border-[#EDE5DC] hover:border-[#A98159]/50'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
            {dateFilter && (
              <p className="text-[11px] text-[#A98159] font-bold mt-2 text-center">
                {dateFilter}
              </p>
            )}
          </div>

          {/* 3. Report type */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <ClipboardList size={13} className="text-[#A98159]" />
              <label className="text-xs font-black text-[#2D2926] uppercase tracking-wide">
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
                        : { background: '#FAFAF8', borderColor: '#EDE5DC' }
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full transition-colors"
                        style={{ background: active ? rt.color : '#D9CEBC' }}
                      />
                      <span
                        className="text-sm font-bold"
                        style={{ color: active ? rt.color : '#4A3B35' }}
                      >
                        {rt.label}
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        active ? 'border-transparent' : 'border-[#D9CEBC]'
                      }`}
                      style={active ? { background: rt.color } : {}}
                    >
                      {active && (
                        <CheckCircle2 size={11} className="text-white" strokeWidth={2.5} />
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

        {/* ── Generate button ── */}
        <div className="px-6 py-4 border-t border-[#EDE5DC] bg-[#FDFCFB]">
          {progress && (
            <div className="flex items-center gap-2 mb-3 bg-[#FDF8F0] border border-[#D1C4B9] rounded-xl px-3 py-2">
              <Loader2 size={13} className="animate-spin text-[#A98159] shrink-0" />
              <span className="text-[11px] font-bold text-[#A98159]">{progress}</span>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !types.length}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-50 active:scale-[0.98] shadow-[0_4px_20px_rgba(169,129,89,0.35)] hover:shadow-[0_6px_28px_rgba(169,129,89,0.45)]"
            style={{ background: 'linear-gradient(135deg,#C4A46E 0%,#A98159 50%,#8B6840 100%)' }}
          >
            {generating
              ? <><Loader2 size={16} className="animate-spin" /> جاري الإنشاء...</>
              : <><FileText size={16} /> إنشاء وتنزيل تقرير PDF</>}
          </button>
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

/* ══════════════════════════════════════════════════════
   Public component — gold "إصدار تقرير" trigger button
══════════════════════════════════════════════════════ */
export default function AdminReportGenerator() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-xs font-bold transition-all active:scale-95 shadow-[0_4px_16px_rgba(169,129,89,0.35)] hover:shadow-[0_6px_24px_rgba(169,129,89,0.45)] hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#C4A46E 0%,#A98159 50%,#8B6840 100%)' }}
      >
        <FileText size={14} />
        إصدار تقرير
      </button>

      {open && <ReportModal onClose={() => setOpen(false)} />}
    </>
  );
}
