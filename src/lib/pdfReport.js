/**
 * src/lib/pdfReport.js
 *
 * Turns any table of rows into an A4 PDF on the company letterhead.
 *
 * The existing generator draws five hand-written report types. This does not
 * know what it is printing: give it columns and rows and it produces the
 * document. That is what lets the reports section cover every part of the
 * system without a new PDF routine per section.
 *
 * jsPDF and autotable are imported dynamically so neither is in the main
 * bundle — a report is something a user asks for, not something every page
 * load should pay for.
 */

import { fixArabic, toArabicNum, wrapArabicLines } from './arabicText.js';
import { cairoBase64, cairoBoldBase64 } from '../assets/fonts/CairoFont.js';
import { formatHijri } from './hijri.js';

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

/**
 * jsPDF runs its own Arabic shaper and BiDi reorderer on every text call.
 * Our text arrives already shaped and already in visual order, so both must be
 * unsubscribed or the output is mangled twice over. The UTF-8 escape handler
 * on the same topic must survive — it does the actual PDF string encoding.
 */
function disableBuiltInArabic(doc) {
  doc.processArabic = (t) => t;
  const topics = doc.internal.events.getTopics();
  for (const tok of Object.keys(topics.preProcessText || {})) {
    doc.internal.events.unsubscribe(tok);
  }
  for (const tok of Object.keys(topics.postProcessText || {})) {
    const cb = topics.postProcessText[tok][0];
    const src = cb ? Function.prototype.toString.call(cb) : '';
    if (src.includes('doBidiReorder') || src.includes('bidiEngine')) {
      doc.internal.events.unsubscribe(tok);
    }
  }
}

/* Rasterises the brand logo for the PDF. SVG has no intrinsic size in every
   browser, hence the fallback box.

   The raster is capped at RASTER_W pixels. Multiplying the natural size by a
   fixed factor instead produced a 5 MB PDF from a 26 KB SVG: the logo prints
   about 13 mm tall, so anything past a few hundred pixels is weight nobody
   can see. */
const RASTER_W = 700;

function loadLogo(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth  || 600;
        const h = img.naturalHeight || 379;
        const ratio = w / h;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.min(RASTER_W, w * 4);
        canvas.height = Math.round(canvas.width / ratio);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/png'), ratio });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const ar = (v) => fixArabic(toArabicNum(String(v ?? '')));

/**
 * Splits `total` across columns in proportion to `weights`, but never letting a
 * column fall below `min` or rise above `max`. Clamped columns are fixed and
 * the remainder is redistributed among the rest, repeatedly, because fixing one
 * column can push another past a bound.
 *
 * Falls back to equal shares when the bounds cannot all be met — a slightly
 * cramped table beats one whose columns do not add up to the page.
 */
function distribute(weights, total, min, max) {
  const n = weights.length;
  if (!n) return [];
  if (min * n > total) return weights.map(() => total / n);

  const fixed = new Array(n).fill(null);
  for (let pass = 0; pass < n + 1; pass++) {
    const freeIdx = fixed.map((f, i) => (f === null ? i : -1)).filter(i => i >= 0);
    if (!freeIdx.length) break;

    const used = fixed.reduce((s, f) => s + (f ?? 0), 0);
    const room = total - used;
    const wSum = freeIdx.reduce((s, i) => s + weights[i], 0) || 1;

    let changed = false;
    for (const i of freeIdx) {
      const w = (weights[i] / wSum) * room;
      if (w < min) { fixed[i] = min; changed = true; }
      else if (w > max) { fixed[i] = max; changed = true; }
    }
    if (!changed) {
      for (const i of freeIdx) fixed[i] = (weights[i] / wSum) * room;
      break;
    }
  }
  return fixed.map(f => f ?? total / n);
}

/**
 * @param {object}   o
 * @param {string}   o.title       document title
 * @param {string}   [o.subtitle]  one line under it — the filters, usually
 * @param {object[]} o.sections    [{ title?, columns, rows }] — one table each.
 *                                 Several sections make one document, which is
 *                                 how a season report covers evaluations,
 *                                 reports and logistics in a single file.
 * @param {object[]} [o.summary]   {label, value} chips printed above the tables
 * @param {object}   o.brand       the live identity from BrandContext
 * @param {'portrait'|'landscape'} [o.orientation]
 * @param {string}   [o.fileName]
 */
export async function exportTablePdf({
  title, subtitle, sections, columns, rows, summary = [], brand,
  orientation = 'portrait', fileName,
}) {
  /* Single-table callers keep working unchanged. */
  const parts = sections?.length ? sections : [{ columns, rows }];
  const { jsPDF }              = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const PW = orientation === 'landscape' ? 297 : 210;
  const M  = 12;
  const CW = PW - M * 2;

  /* Both weights registered before any text operation. jsPDF cannot synthesise
     bold: an unregistered style falls back to a built-in Latin face, and Arabic
     then renders as empty boxes. */
  doc.addFileToVFS('Cairo-Regular.ttf', cairoBase64);
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
  doc.addFileToVFS('Cairo-Bold.ttf', cairoBoldBase64);
  doc.addFont('Cairo-Bold.ttf', 'Cairo', 'bold');
  doc.setFont('Cairo', 'normal');
  disableBuiltInArabic(doc);

  const PRIMARY = hexToRgb(brand?.colors?.primary || '#1B2A4A');
  const ACCENT  = hexToRgb(brand?.colors?.accent  || '#30D9CB');
  const INK     = hexToRgb(brand?.colors?.ink     || '#16233D');
  const GRAY    = hexToRgb('#64748B');
  const LINE    = hexToRgb('#E2E8F0');

  /* ── Letterhead ── */
  const logo = await loadLogo(brand?.logo?.full);
  let y = M;

  if (logo) {
    const h = 13;
    doc.addImage(logo.dataUrl, 'PNG', M, y, h * logo.ratio, h);
  }

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const today = new Date();
  doc.text(ar(formatHijri(today)), PW - M, y + 5,   { align: 'right' });
  doc.text(today.toISOString().slice(0, 10), PW - M, y + 10, { align: 'right' });

  y += 18;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.8);
  doc.line(M, y, PW - M, y);

  y += 9;
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(ar(title), PW / 2, y, { align: 'center' });

  if (subtitle) {
    y += 6;
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(ar(subtitle), PW / 2, y, { align: 'center' });
  }

  /* ── Summary chips ── */
  if (summary.length) {
    y += 8;
    const boxW = Math.min(46, CW / summary.length - 2);
    let x = PW - M - boxW;
    for (const s of summary) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, boxW, 14, 2, 2, 'FD');
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(ar(s.label), x + boxW - 3, y + 5, { align: 'right' });
      doc.setFont('Cairo', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...PRIMARY);
      doc.text(ar(s.value), x + boxW - 3, y + 11, { align: 'right' });
      x -= boxW + 2;
    }
    y += 18;
  } else {
    y += 6;
  }

  /* ── Table ──
     Columns are reversed because autotable lays out left-to-right; reversing
     both header and cells puts the first column on the right where an Arabic
     reader expects it. */
  /* ── Column widths, then wrapping ──
     autotable cannot wrap this text itself. What it receives is already shaped
     into presentation forms and reversed to visual order, so breaking it at a
     space puts the END of a sentence on the first line and its beginning on the
     second. Widths are therefore fixed here, and each cell is wrapped by
     wrapArabicLines, which reverses per line and keeps the lines in reading
     order. autotable then only has to honour the newlines. */
  const PAD = 3;
  const FONT_SIZE = 8.5;
  /* Keeps a line measured exactly at the boundary from touching the cell
     border. A millimetre is invisible; a clipped glyph is not. */
  const SLACK = 1.2;

  /* Widths come from measuring the text, not from counting its characters.
     Character counts are a poor proxy in Arabic — glyph widths vary far more
     than in Latin — and the first attempt truncated "قيد المعالجة" while
     leaving a numbers column half empty.

     Each column asks for the width of its widest single word plus padding,
     which is the narrowest it can be without a word having to be cut. What is
     left over is shared out in proportion to how much text each column holds,
     so a description gets the slack and a count does not. */
  const MIN_W = 14;
  const MAX_W = 62;

  const widestWord = (text, size, style) => {
    doc.setFont('Cairo', style);
    doc.setFontSize(size);
    return String(text ?? '').split(/\s+/).filter(Boolean)
      .reduce((m, w) => Math.max(m, doc.getTextWidth(fixArabic(toArabicNum(w)))), 0);
  };

  const computeWidths = (cols, body) => {
    const need = cols.map((label, i) => {
      let w = widestWord(label, 9, 'bold');
      for (const r of body) w = Math.max(w, widestWord(r[i], FONT_SIZE, 'normal'));
      return Math.min(Math.max(w + PAD * 2 + SLACK, MIN_W), MAX_W);
    });
    const totalNeed = need.reduce((a, b) => a + b, 0);
    if (totalNeed > CW) return distribute(need, CW, MIN_W, MAX_W);

    /* Spare width goes where the text is, measured by total content length. */
    const bulk = cols.map((label, i) =>
      body.reduce((s, r) => s + String(r[i] ?? '').length, label.length) + 1);
    const bulkSum = bulk.reduce((a, b) => a + b, 0) || 1;
    const spare = CW - totalNeed;
    return need.map((w, i) => w + (bulk[i] / bulkSum) * spare);
  };

  /* wrapArabicLines reshapes and reverses each line itself, so its output must
     not be passed through `ar()` again — that would shape twice. It measures
     with the current font, hence setting the exact face and size first. */
  /* Autotable must never re-break these lines: it would split text that is
     already shaped and reversed, scattering the words across rows in the wrong
     order. So the cell is wrapped here, drawn with overflow:'visible', and any
     line that still cannot fit — a single unbroken URL — is truncated here
     rather than left to spill outside the cell. With widths derived from the
     widest word, that truncation should now only ever hit an unbreakable
     token such as a URL. */
  const wrapCell = (text, w) => {
    const avail = Math.max(6, w - PAD * 2 - SLACK);
    const lines = wrapArabicLines(doc, toArabicNum(String(text ?? '')), avail);
    return lines.map(line => {
      if (doc.getTextWidth(line) <= avail) return line;
      let cut = line;
      while (cut.length > 1 && doc.getTextWidth(cut + '…') > avail) cut = cut.slice(0, -1);
      return cut + '…';
    }).join('\n');
  };

  /* One table per section, each measured and wrapped on its own data — a
     section of five short columns must not inherit the widths of one with a
     long description. */
  for (const part of parts) {
    const cols = part.columns || [];
    const data = part.rows || [];
    if (!cols.length) continue;

    const widths = computeWidths(cols, data);

    doc.setFont('Cairo', 'bold');
    doc.setFontSize(9);
    const head = cols.map((c, i) => wrapCell(c, widths[i])).reverse();

    doc.setFont('Cairo', 'normal');
    doc.setFontSize(FONT_SIZE);
    const body = data.map(r => r.map((cell, i) => wrapCell(cell, widths[i])).reverse());

    const columnStyles = {};
    [...widths].reverse().forEach((w, i) => { columnStyles[i] = { cellWidth: w }; });

    /* After the first section, continue below the previous table — or on a new
       page if there is not enough room left for a heading and a few rows.
       The first section keeps the y the letterhead left behind; overriding it
       drew the heading on top of the title and covered the summary. */
    if (doc.lastAutoTable) {
      y = doc.lastAutoTable.finalY + 12;
      if (y > doc.internal.pageSize.getHeight() - 55) {
        doc.addPage();
        y = M + 12;
      }
    }

    if (parts.length > 1 && part.title) {
      doc.setFont('Cairo', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...PRIMARY);
      doc.text(ar(part.title), PW - M, y, { align: 'right' });
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(0.6);
      doc.line(M, y + 2.5, PW - M, y + 2.5);
      y += 7;
    }

    autoTable(doc, {
      startY: y,
      /* Forced to the full content width. Left to size itself, autotable
         shrinks to its content and pins the result to the left margin — which
         on an RTL page leaves the table hanging off the wrong edge with the
         columns the reader starts from furthest from where they look. */
      tableWidth: CW,
      columnStyles,
      head: [head],
      body,
      styles: {
        font: 'Cairo', fontStyle: 'normal', halign: 'right',
        fontSize: FONT_SIZE, cellPadding: { top: 2.5, right: PAD, bottom: 2.5, left: PAD },
        lineColor: LINE, lineWidth: 0.15, textColor: INK,
        valign: 'middle',
        overflow: 'visible',
      },
      headStyles: {
        font: 'Cairo', fontStyle: 'bold', halign: 'right',
        fillColor: PRIMARY, textColor: [255, 255, 255],
        fontSize: 9, cellPadding: { top: 3, right: PAD, bottom: 3, left: PAD },
        lineWidth: 0, overflow: 'visible',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid',
      margin: { right: M, left: M, top: M, bottom: 16 },

      didDrawPage: () => {
        const page  = doc.internal.getCurrentPageInfo().pageNumber;
        const total = doc.internal.getNumberOfPages();
        const PH = doc.internal.pageSize.getHeight();
        /* Reset explicitly: autotable leaves whatever face the last cell used,
           and a footer drawn in the fallback Latin font prints Arabic as
           empty boxes. */
        doc.setFont('Cairo', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(ar(brand?.companyFullAr || ''), PW - M, PH - 7, { align: 'right' });
        doc.text(ar(`صفحة ${page} من ${total}`), M, PH - 7, { align: 'left' });
        doc.setDrawColor(...ACCENT);
        doc.setLineWidth(0.5);
        doc.line(M, PH - 11, PW - M, PH - 11);
      },
    });
  }

  doc.save(fileName || `${title}.pdf`);
}

/**
 * CSV with a UTF-8 BOM. Without it Excel on Windows opens Arabic as mojibake,
 * which is the single most common complaint about exported Arabic data.
 */
export function exportCsv({ columns, rows, fileName }) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [columns, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'report.csv';
  a.click();
  URL.revokeObjectURL(url);
}
