/**
 * src/lib/menuTemplate.js
 *
 * Builds the blank menu the customer fills in.
 *
 * Two files, one shape. Both carry the exact headings the importer matches on,
 * in the same order, with a row already laid out for every day and every meal —
 * so filling one in is typing dishes into cells, never deciding what to call a
 * column. Getting the headings right is most of what makes an import work, and
 * this is how the customer gets them right without being told the rules.
 *
 * The Word file is written as HTML. Word opens an HTML table as a real,
 * editable Word table, which means no document library has to ship in the
 * bundle to produce one — and the same markup is what the layout is built from,
 * so the two files cannot drift apart.
 */

import { HAJJ_DAYS, MEAL_KEYS, MEAL_LABEL, CATEGORY_KEYS, CATEGORY_META } from '../config/menus.js';

/** The heading row, in the order both templates use. */
export const TEMPLATE_HEAD = [
  'اليوم', 'الوجبة', 'الموقع', 'الوقت',
  ...CATEGORY_KEYS.map(k => CATEGORY_META[k].label),
];

/** One row per day per meal, the first four columns already filled. */
export function templateRows(natLabel) {
  const rows = [];
  for (const d of HAJJ_DAYS) {
    for (const m of MEAL_KEYS) {
      rows.push([d.dayAr, MEAL_LABEL[m], '', '', '', '', '', '']);
    }
  }
  return rows;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A Word document the customer fills in and exports as PDF.
 *
 * The instructions sit above the table rather than inside it: the importer
 * skips any row that names no meal, so a paragraph of guidance is ignored,
 * while a stray note typed into a dish cell would be read as a dish.
 */
export function buildWordTemplate(natLabel = '') {
  const head = TEMPLATE_HEAD.map(h =>
    `<td style="background:#1E3A5F;color:#fff;font-weight:bold;padding:6pt;border:1px solid #999;">${esc(h)}</td>`
  ).join('');

  const body = templateRows().map((r, i) => {
    const cells = r.map((c, j) => {
      /* Day and meal are pre-filled and shaded, to read as "given" rather than
         "to fill" — and because changing them is what breaks an import. */
      const fixed = j < 2;
      return `<td style="padding:6pt;border:1px solid #999;${
        fixed ? 'background:#F2F4F7;font-weight:bold;text-align:center;' : ''
      }">${esc(c)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('\n');

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>قالب المنيو</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4 landscape; margin: 1.2cm; }
  body { font-family: 'Cairo', 'Arial', sans-serif; direction: rtl; font-size: 10pt; }
  h1 { font-size: 15pt; color: #1E3A5F; margin: 0 0 4pt; }
  p  { font-size: 9pt; color: #444; margin: 0 0 3pt; }
  table { border-collapse: collapse; width: 100%; }
  td { vertical-align: top; }
</style>
</head>
<body dir="rtl">
  <h1>قالب المنيو${natLabel ? ` — ${esc(natLabel)}` : ''}</h1>
  <p><b>كيف تستخدمه:</b> اكتب الأصناف في الخانات، صنفاً واحداً في كل سطر داخل الخانة.</p>
  <p>اترك خانات الوجبة التي لا تُقدَّم فارغة — الصفوف الفارغة تُتجاهل عند الاستيراد.</p>
  <p><b>لا تغيّر صف العناوين ولا ترتيب الأعمدة</b>، فعليه يعتمد القارئ في التعرّف على الملف.</p>
  <p>بعد التعبئة: ملف ← حفظ باسم ← <b>PDF</b>، ثم ارفع الملف في قسم المنيو.</p>
  <br>
  <table border="1">
    <tr>${head}</tr>
${body}
  </table>
</body>
</html>`;
}

/** Hands the file to the browser as a download. */
export function downloadWordTemplate(natLabel = '') {
  const blob = new Blob(['﻿', buildWordTemplate(natLabel)], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `قالب-المنيو${natLabel ? `-${natLabel}` : ''}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
