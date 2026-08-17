/**
 * src/lib/pdfDossier.js
 *
 * A readiness inspection record as an official document: a summary sheet, then
 * one full page per centre carrying its data, its answer to every criterion,
 * the inspector's notes and the photographs taken on site.
 *
 * A flat table cannot serve this purpose. A record that goes to management has
 * to stand on its own per centre — which criterion failed, what was written
 * about it, what the photograph shows — and that is a page, not a row.
 *
 * Shares the Arabic shaping and letterhead conventions of pdfReport.js.
 */

import { fixArabic, toArabicNum, wrapArabicLines } from './arabicText.js';
import { cairoBase64, cairoBoldBase64 } from '../assets/fonts/CairoFont.js';
import { formatHijri } from './hijri.js';

const ar = (v) => fixArabic(toArabicNum(String(v ?? '')));

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

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

/* Centres sort by their number, not their label: a string sort puts مركز 102
   between مركز 10 and مركز 11. The suffix (أ / ب) breaks ties. */
export function compareCenters(a, b) {
  const n = s => parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10) || 0;
  return n(a) - n(b) || String(a ?? '').localeCompare(String(b ?? ''), 'ar');
}

/* ── Images ───────────────────────────────────────────────── */

/**
 * Fetches and downscales a photo for embedding.
 *
 * Downscaling is not optional: the originals are ~600 KB phone photos, and a
 * sixty-centre record with three each would be a document nobody can email.
 * JPEG at 0.72 keeps a wall or a floor legible at the size it is printed.
 */
async function loadPhoto(url, maxW = 900) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxW / bmp.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.72), ratio: canvas.width / canvas.height };
  } catch {
    return null;   // a missing photo must never abort the document
  }
}

function loadLogo(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || 600, h = img.naturalHeight || 379;
        const ratio = w / h;
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(700, w * 4);
        canvas.height = Math.round(canvas.width / ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/png'), ratio });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ── Score bands ──────────────────────────────────────────── */
const BANDS = [
  { min: 8,   label: 'ممتاز',  color: '#15803D' },
  { min: 6,   label: 'مقبول',  color: '#CA8A04' },
  { min: 0,   label: 'ضعيف',   color: '#DC2626' },
];
export const bandOf = (score) =>
  BANDS.find(b => Number(score) >= b.min) || BANDS[BANDS.length - 1];

export function scoreOf(rec) {
  if (rec.scoreOutOf10 != null) return Number(rec.scoreOutOf10);
  const max = Number(rec.maxScore), tot = Number(rec.totalScore);
  if (max > 0 && !isNaN(tot)) return (tot / max) * 10;
  const pct = parseFloat(rec.percentage);
  return isNaN(pct) ? null : pct / 10;
}

/**
 * @param {object}   o
 * @param {string}   o.title      e.g. "محضر جاهزية مشعر منى"
 * @param {string}   [o.subtitle] the filters in one line
 * @param {object[]} o.records    readiness rows, one per centre visit
 * @param {object[]} o.sections   [{ title, criteria }] the criteria, grouped
 * @param {object}   o.brand      live identity from BrandContext
 * @param {boolean}  [o.withPhotos]
 * @param {(n:number,total:number)=>void} [o.onProgress]
 */
export async function exportReadinessDossier({
  title, subtitle, records, sections, brand,
  withPhotos = true, onProgress, fileName,
}) {
  const { jsPDF }              = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 14;
  const CW = PW - M * 2;

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
  const SOFT    = hexToRgb('#F8FAFC');

  const logo  = await loadLogo(brand?.logo?.full);
  const today = new Date();

  const ordered = [...records].sort((a, b) => compareCenters(a.center, b.center));
  const allCriteria = sections.flatMap(s => s.criteria);

  /* ── Shared furniture ── */
  const letterhead = (docTitle, sub) => {
    let y = M;
    if (logo) doc.addImage(logo.dataUrl, 'PNG', M, y, 12 * logo.ratio, 12);
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(ar(formatHijri(today)), PW - M, y + 4.5, { align: 'right' });
    doc.text(today.toISOString().slice(0, 10), PW - M, y + 9, { align: 'right' });

    y += 16;
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.8);
    doc.line(M, y, PW - M, y);

    y += 8;
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text(ar(docTitle), PW / 2, y, { align: 'center' });

    if (sub) {
      y += 5.5;
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...GRAY);
      doc.text(ar(sub), PW / 2, y, { align: 'center' });
    }
    return y + 7;
  };

  /* Footers are stamped once, at the very end. Drawing them per page as the
     tables were laid out printed "من ٣" before the photo pages existed, and the
     corrected total was then drawn on top of it. */
  const stampFooters = () => {
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont('Cairo', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(ar(brand?.companyFullAr || ''), PW - M, PH - 8, { align: 'right' });
      doc.text(ar(`صفحة ${p} من ${total}`), M, PH - 8, { align: 'left' });
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(0.5);
      doc.line(M, PH - 12, PW - M, PH - 12);
    }
  };

  const wrap = (text, w, size = 8.5, style = 'normal') => {
    doc.setFont('Cairo', style);
    doc.setFontSize(size);
    return wrapArabicLines(doc, toArabicNum(String(text ?? '')), w);
  };

  /* ── Summary sheet ── */
  let y = letterhead(title, subtitle);

  const scored = ordered.map(r => scoreOf(r)).filter(v => v != null);
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const stats = [
    { label: 'عدد المراكز',   value: String(ordered.length) },
    { label: 'متوسط الجاهزية', value: avg != null ? avg.toFixed(1) : '—' },
    { label: 'ممتاز', value: String(scored.filter(v => v >= 8).length) },
    { label: 'دون المقبول', value: String(scored.filter(v => v < 6).length) },
  ];
  const boxW = (CW - 6) / 4;
  let bx = PW - M - boxW;
  for (const s of stats) {
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(bx, y, boxW, 15, 2, 2, 'FD');
    doc.setFont('Cairo', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(ar(s.label), bx + boxW - 3, y + 5.5, { align: 'right' });
    doc.setFont('Cairo', 'bold'); doc.setFontSize(12); doc.setTextColor(...PRIMARY);
    doc.text(ar(s.value), bx + boxW - 3, y + 12, { align: 'right' });
    bx -= boxW + 2;
  }
  y += 21;

  const sumCols  = ['#', 'المركز', 'المتعهد', 'المقيّم', 'الدرجة /10', 'التقدير'];
  const sumWidth = [10, 24, 62, 34, 20, 22];
  const sumBody = ordered.map((r, i) => {
    const sc = scoreOf(r);
    return [
      String(i + 1),
      String(r.center ?? ''),
      String(r.caterer ?? ''),
      String(r.observer ?? ''),
      sc != null ? sc.toFixed(1) : '—',
      sc != null ? bandOf(sc).label : '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    tableWidth: CW,
    columnStyles: Object.fromEntries([...sumWidth].reverse().map((w, i) => [i, { cellWidth: w }])),
    head: [sumCols.map(c => ar(c)).reverse()],
    body: sumBody.map((r, ri) => r.map((c, ci) =>
      wrap(c, sumWidth[ci] - 5).join('\n')).reverse()),
    styles: {
      font: 'Cairo', fontStyle: 'normal', halign: 'right', fontSize: 8,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      lineColor: LINE, lineWidth: 0.15, textColor: INK, valign: 'middle',
      overflow: 'visible',
    },
    headStyles: {
      font: 'Cairo', fontStyle: 'bold', halign: 'right', fillColor: PRIMARY,
      textColor: [255, 255, 255], fontSize: 8.5, lineWidth: 0, overflow: 'visible',
    },
    alternateRowStyles: { fillColor: SOFT },
    theme: 'grid',
    margin: { right: M, left: M, top: M, bottom: 18 },
    /* The band column is the one a reader scans, so it carries its colour. */
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (d.column.index !== 0) return;              // reversed: التقدير is first
      const sc = scoreOf(ordered[d.row.index]);
      if (sc == null) return;
      d.cell.styles.textColor = hexToRgb(bandOf(sc).color);
      d.cell.styles.fontStyle = 'bold';
    },
    // footers are stamped once at the end
  });

  /* ── One page per centre ── */
  let done = 0;
  for (const rec of ordered) {
    doc.addPage();
    let py = letterhead(title, `${rec.center ?? ''}`);

    const sc = scoreOf(rec);
    const band = sc != null ? bandOf(sc) : null;

    /* Identity block. Each field stacks its label above its value rather than
       sitting beside it: a caterer's name is long and unpredictable, and a
       side-by-side layout ran one field into the next and into the badge.
       Values are clipped to their column so the block can never overflow. */
    const BADGE_W = 34;
    const cols = 3;
    const gridW = CW - BADGE_W - 8;
    const cellW = gridW / cols;
    const rowH  = 11;
    const blockH = rowH * 2 + 7;

    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, py, CW, blockH, 2, 2, 'FD');

    const clip = (text, w, size, style) => {
      doc.setFont('Cairo', style); doc.setFontSize(size);
      let s = ar(text);
      if (doc.getTextWidth(s) <= w) return s;
      while (s.length > 1 && doc.getTextWidth(s + '…') > w) s = s.slice(0, -1);
      return s + '…';
    };

    const pairs = [
      ['المركز',  rec.center],
      ['المتعهد', rec.caterer],
      ['المقيّم',  rec.observer],
      ['الصفة',   rec.role === 'supervisor' ? 'مشرف' : rec.role === 'observer' ? 'مراقب' : (rec.role ?? '')],
      ['التاريخ', rec.timestamp ? new Date(rec.timestamp).toISOString().slice(0, 10) : ''],
      ['اليوم',   rec.scheduledDate ?? ''],
    ];

    pairs.forEach(([k, v], i) => {
      const cx = PW - M - 4 - (i % cols) * cellW;
      const cy = py + 6 + Math.floor(i / cols) * rowH;
      doc.setFont('Cairo', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...GRAY);
      doc.text(ar(k), cx, cy, { align: 'right' });
      doc.setTextColor(...INK);
      doc.text(clip(v || '—', cellW - 5, 8, 'bold'), cx, cy + 5, { align: 'right' });
    });

    if (band) {
      const bh = blockH - 8;
      doc.setFillColor(...hexToRgb(band.color));
      doc.roundedRect(M + 4, py + 4, BADGE_W, bh, 2, 2, 'F');
      doc.setFont('Cairo', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
      doc.text(ar(sc.toFixed(1)), M + 4 + BADGE_W / 2, py + 4 + bh / 2 + 0.5, { align: 'center' });
      doc.setFontSize(7);
      doc.text(ar(band.label), M + 4 + BADGE_W / 2, py + 4 + bh - 3, { align: 'center' });
      doc.setFontSize(6);
      doc.text(ar('من ١٠'), M + 4 + BADGE_W / 2, py + 9, { align: 'center' });
    }
    py += blockH + 6;

    /* Criteria, grouped as the form groups them. */
    const answers = rec.answers || {};
    const details = answers.__details || {};
    const photos  = answers.__photos  || {};

    const CW_ID = 9, CW_ANS = 26, CW_SCORE = 16;
    const CW_TEXT = CW - CW_ID - CW_ANS - CW_SCORE;
    const widths = [CW_ID, CW_TEXT, CW_ANS, CW_SCORE];

    const body = [];
    const rowMeta = [];
    for (const sec of sections) {
      body.push([{ content: ar(sec.title), colSpan: 4, styles: {
        fillColor: hexToRgb('#EEF2F7'), fontStyle: 'bold', textColor: PRIMARY,
        halign: 'right', fontSize: 8.5,
      } }]);
      rowMeta.push(null);
      for (const q of sec.criteria) {
        const a = answers[q.id] ?? answers[String(q.id)] ?? '';
        const detail = details[q.id] ?? details[String(q.id)] ?? '';
        const text = detail ? `${q.text}\n— ${detail}` : q.text;
        body.push([
          wrap(String(q.id), CW_ID - 4).join('\n'),
          wrap(text, CW_TEXT - 5).join('\n'),
          wrap(a || '—', CW_ANS - 5).join('\n'),
          wrap(q.score ? (a === 'نعم' ? `${q.score}` : '0') : '—', CW_SCORE - 5).join('\n'),
        ].reverse());
        rowMeta.push({ q, a });
      }
    }

    autoTable(doc, {
      startY: py,
      tableWidth: CW,
      columnStyles: Object.fromEntries([...widths].reverse().map((w, i) => [i, { cellWidth: w }])),
      head: [['#', 'المعيار', 'الإجابة', 'الدرجة'].map(c => ar(c)).reverse()],
      body,
      styles: {
        font: 'Cairo', fontStyle: 'normal', halign: 'right', fontSize: 7.6,
        cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
        lineColor: LINE, lineWidth: 0.15, textColor: INK, valign: 'middle',
        overflow: 'visible',
      },
      headStyles: {
        font: 'Cairo', fontStyle: 'bold', halign: 'right', fillColor: PRIMARY,
        textColor: [255, 255, 255], fontSize: 8, lineWidth: 0, overflow: 'visible',
      },
      theme: 'grid',
      margin: { right: M, left: M, top: M + 4, bottom: 18 },
      /* The answer is what the reader is looking for, so a failed criterion is
         red and a met one green — the rest of the row stays neutral. */
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        const meta = rowMeta[d.row.index];
        if (!meta || d.column.index !== 1) return;   // reversed: الإجابة
        if (meta.a === 'نعم') d.cell.styles.textColor = hexToRgb('#15803D');
        else if (meta.a === 'لا') d.cell.styles.textColor = hexToRgb('#DC2626');
        d.cell.styles.fontStyle = 'bold';
      },
      // footers are stamped once at the end
    });

    py = doc.lastAutoTable.finalY + 7;

    /* Photographs, three to a row, each labelled with its criterion. */
    const shots = Object.entries(photos).filter(([, u]) => !!u);
    if (withPhotos && shots.length) {
      if (py > PH - 60) { doc.addPage(); py = M + 6; }
      doc.setFont('Cairo', 'bold'); doc.setFontSize(9); doc.setTextColor(...PRIMARY);
      doc.text(ar('الصور المرفقة'), PW - M, py, { align: 'right' });
      doc.setDrawColor(...ACCENT); doc.setLineWidth(0.5);
      doc.line(M, py + 2, PW - M, py + 2);
      py += 6;

      const perRow = 3, gap = 8;
      const cellW = (CW - gap * (perRow - 1)) / perRow;
      const cellH = cellW * 0.72;

      for (let i = 0; i < shots.length; i++) {
        const [qid, url] = shots[i];
        const colIdx = i % perRow;
        if (colIdx === 0 && py + cellH + 8 > PH - 20) { doc.addPage(); py = M + 6; }
        const x = PW - M - cellW - colIdx * (cellW + gap);

        const img = await loadPhoto(url);
        doc.setDrawColor(...LINE); doc.setLineWidth(0.2);
        if (img) {
          /* Fit inside the cell, centred, so nothing is stretched. */
          const boxRatio = cellW / cellH;
          const w = img.ratio > boxRatio ? cellW : cellH * img.ratio;
          const h = img.ratio > boxRatio ? cellW / img.ratio : cellH;
          doc.addImage(img.dataUrl, 'JPEG', x + (cellW - w) / 2, py + (cellH - h) / 2, w, h);
          doc.rect(x, py, cellW, cellH);
        } else {
          doc.setFillColor(...SOFT);
          doc.rect(x, py, cellW, cellH, 'FD');
          doc.setFont('Cairo', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAY);
          doc.text(ar('تعذّر تحميل الصورة'), x + cellW / 2, py + cellH / 2, { align: 'center' });
        }
        /* One clipped line. Taking the first line of a wrap left the rest of a
           long criterion spilling under the neighbouring photo. */
        doc.setTextColor(...GRAY);
        const q = allCriteria.find(c => String(c.id) === String(qid));
        doc.text(clip(q ? `${qid} · ${q.text}` : `المعيار ${qid}`, cellW - 2, 6.6, 'normal'),
          x + cellW, py + cellH + 3.5, { align: 'right' });

        if (colIdx === perRow - 1) py += cellH + 7;
      }
      if (shots.length % perRow !== 0) py += cellH + 7;
    }

    /* Signature block — this is a record, and a record is signed. */
    if (py > PH - 34) { doc.addPage(); py = M + 6; }
    py = Math.max(py, PH - 34);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2);
    doc.line(M, py, PW - M, py);
    py += 6;
    doc.setFont('Cairo', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
    const slots = [['المقيّم', rec.observer ?? ''], ['التوقيع', ''], ['الاعتماد', '']];
    slots.forEach(([label, value], i) => {
      const w = CW / 3;
      const x = PW - M - i * w;
      doc.text(ar(label), x, py, { align: 'right' });
      doc.setFont('Cairo', 'bold'); doc.setTextColor(...INK);
      doc.text(ar(value || '................'), x, py + 6, { align: 'right' });
      doc.setFont('Cairo', 'normal'); doc.setTextColor(...GRAY);
    });

    onProgress?.(++done, ordered.length);
  }

  stampFooters();
  doc.save(fileName || `${title}.pdf`);
}
