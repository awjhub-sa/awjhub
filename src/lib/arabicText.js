/**
 * src/lib/arabicText.js
 *
 * Arabic shaping for jsPDF, extracted from AdminReportGenerator so every
 * report — not just the one it was written for — can render Arabic correctly.
 *
 * jsPDF has no OpenType shaping engine: it draws the code points it is given.
 * These helpers do the shaping by hand, mapping logical-order Arabic to
 * Presentation Forms-B (U+FE70–U+FEFF) and reversing to visual order so the
 * LTR renderer lays out an RTL line correctly.
 *
 * Nothing here is specific to a report. Do not add report logic to this file.
 */

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
  return _unreverseDigits(out.reverse().join(''));
}

/* Digits inside a word run left-to-right even in Arabic text, so the pass that
   reverses the word puts them backwards: "مركز 25-أ" printed as "مركز ٥٢-أ".
   Reversing each digit run back restores it without disturbing the letters
   around it. */
const _DIGIT_RUN = /[0-9٠-٩۰-۹]{2,}/g;
function _unreverseDigits(s) {
  return s.replace(_DIGIT_RUN, (run) => [...run].reverse().join(''));
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

/* A URL or an email is a machine string, not prose. Converting its digits
   makes a printed link impossible to type back — so those tokens are left
   exactly as they are while everything around them is converted. */
const _MACHINE = /(https?:\/\/|www\.|@|\.com|\.sa\b)/i;

export function toArabicNum(input) {
  return String(input ?? '')
    .split(/(\s+)/)
    .map(tok => (_MACHINE.test(tok)
      ? tok
      : tok.replace(/\d/g, d => _AR_DIGITS[d.charCodeAt(0) - 48])))
    .join('');
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
