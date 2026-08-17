/**
 * src/lib/menuImport.js
 *
 * Reads a menu out of a spreadsheet, and — best effort — out of a photograph.
 *
 * The spreadsheet path is exact: a sheet has columns, the columns say which day
 * and which meal, and the result needs no correction. The photograph path is
 * optical character recognition on Arabic, which is a guess dressed as an
 * answer; it is offered as a first draft to edit, never as an import to trust,
 * and the screen says so.
 *
 * Both are loaded on demand — neither library belongs in the bundle of an
 * operations tool that mostly shows tables.
 */

import { CATEGORY_KEYS, MEAL_KEYS } from '../config/menus.js';

/* Header spellings seen in the sheets the customers already keep. Matching is
   loose on purpose: "الطبق الرئيسي", "رئيسي", "Main" all mean the same column,
   and a customer should not have to rename a heading to import their own file. */
const HEADER_ALIASES = {
  day:      ['اليوم', 'يوم', 'التاريخ', 'day', 'date'],
  meal:     ['الوجبة', 'وجبة', 'meal'],
  location: ['الموقع', 'المكان', 'location', 'place'],
  time:     ['الوقت', 'التوقيت', 'time'],
  main:     ['الطبق الرئيسي', 'الرئيسي', 'رئيسي', 'الوجبة الرئيسية', 'main', 'main dish'],
  side:     ['الأصناف الجانبية', 'الجانبية', 'جانبي', 'side', 'sides'],
  drinks:   ['المشروبات', 'مشروب', 'drinks', 'beverage'],
  snacks:   ['السناكات', 'سناك', 'التسالي', 'snacks', 'snack'],
};

const MEAL_ALIASES = {
  breakfast: ['الإفطار', 'الافطار', 'إفطار', 'افطار', 'breakfast'],
  lunch:     ['الغداء', 'غداء', 'lunch'],
  dinner:    ['العشاء', 'عشاء', 'dinner'],
};

const norm = (v) =>
  String(v ?? '')
    .replace(/[ً-ٰٟ]/g, '')     // strip harakat
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function matchKey(header, aliases) {
  const h = norm(header);
  if (!h) return null;
  for (const [key, list] of Object.entries(aliases)) {
    if (list.some(a => h === norm(a) || h.includes(norm(a)))) return key;
  }
  return null;
}

/* Arabic-Indic digits are what these sheets are typed in. */
const toLatinDigits = (s) =>
  String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
                 .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

const dayOf = (v) => {
  const m = toLatinDigits(v).match(/\d{1,2}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return n >= 1 && n <= 31 ? String(n) : null;
};

/* One cell can hold a whole category: dishes parted by a newline, a comma, a
   dash or a bullet. All of those appear in the files people actually keep. */
export const splitDishes = (cell) =>
  String(cell ?? '')
    .split(/[\n\r؛;،,•]|\s+-\s+/)
    .map(s => s.trim())
    .filter(s => s && s !== '-' && s !== '—');

/**
 * @param {File} file  .xlsx / .xls / .csv
 * @returns {Promise<{rows: object[], warnings: string[], sheet: string}>}
 *   rows: [{ day, meal, location, time, main[], side[], drinks[], snacks[] }]
 */
export async function parseMenuSheet(file) {
  /* Loaded here, not imported at the top: the parser is a few hundred
     kilobytes and is needed only when someone actually imports a file. */
  const XLSX = await import('xlsx');

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('الملف لا يحتوي على أوراق');

  const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1, blankrows: false, defval: '',
  });
  if (!grid.length) throw new Error('الورقة فارغة');

  /* The header is the first row that names at least one category — a sheet
     that opens with a title and a blank line is the normal case, not an
     exception to complain about. */
  let headerRow = -1, cols = {};
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const map = {};
    grid[i].forEach((cell, j) => {
      const key = matchKey(cell, HEADER_ALIASES);
      if (key && map[key] == null) map[key] = j;
    });
    const named = CATEGORY_KEYS.filter(k => map[k] != null).length;
    if (named >= 1 && map.meal != null) { headerRow = i; cols = map; break; }
    if (named >= 2) { headerRow = i; cols = map; break; }
  }
  if (headerRow < 0) {
    throw new Error('لم يُعثر على صف العناوين — يحتاج الملف عمودًا للوجبة وأعمدة للأصناف');
  }

  const warnings = [];
  const missing = CATEGORY_KEYS.filter(k => cols[k] == null);
  if (missing.length) warnings.push(`أعمدة غير موجودة في الملف: ${missing.join('، ')}`);
  if (cols.day == null) warnings.push('لا يوجد عمود لليوم — ستُسنَد كل الصفوف لليوم المفتوح');

  const rows = [];
  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i];
    const at = (k) => (cols[k] == null ? '' : r[cols[k]]);

    const meal = matchKey(at('meal'), MEAL_ALIASES);
    if (!meal || !MEAL_KEYS.includes(meal)) continue;   // not a menu row

    const row = {
      day: cols.day == null ? null : dayOf(at('day')),
      meal,
      location: String(at('location') ?? '').trim() || null,
      time: String(at('time') ?? '').trim() || null,
    };
    let any = false;
    for (const k of CATEGORY_KEYS) {
      row[k] = splitDishes(at(k));
      if (row[k].length) any = true;
    }
    if (any) rows.push(row);
  }

  if (!rows.length) throw new Error('لم يُقرأ أي صف — تأكد أن عمود الوجبة يحتوي إفطار/غداء/عشاء');
  return { rows, warnings, sheet: sheetName };
}

/**
 * Best-effort reading of a photographed menu.
 *
 * Arabic OCR on a phone photo is not reliable, and pretending otherwise would
 * put wrong dishes in front of pilgrims. What comes back is lines of text for a
 * human to sort into categories — the screen presents it as a draft, and
 * nothing is saved until someone has looked at it.
 */
export async function readMenuImage(file, onProgress) {
  /* tesseract.js fetches its wasm core and the Arabic model from
     tessdata.projectnaptha.com the first time this runs — roughly 3 MB, cached
     by the browser afterwards. It needs internet the first time, and it puts a
     third-party host in the path.

     To take both away, copy worker.min.js from node_modules/tesseract.js/dist,
     the tesseract-core-simd.* files from node_modules/tesseract.js-core, and
     ara.traineddata.gz into public/tesseract/, then pass
     { workerPath, corePath, langPath } below. */
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ara', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    const lines = String(data?.text ?? '')
      .split(/\r?\n/)
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(s => s.length > 2);
    return { lines, confidence: Math.round(data?.confidence ?? 0) };
  } finally {
    await worker.terminate();
  }
}

/** A blank meal, so the editor and the importer agree on the shape. */
export const emptyMeal = () => ({
  location: '', time: '',
  ...Object.fromEntries(CATEGORY_KEYS.map(k => [k, []])),
});
