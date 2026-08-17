/**
 * src/lib/menuImport.js
 *
 * Reads a menu out of a spreadsheet or a PDF.
 *
 * Both end up in the same place: a grid of cells fed to one parser. A
 * spreadsheet already is a grid. A PDF is not — it is text with coordinates —
 * so its lines and columns are reconstructed from where the words sit on the
 * page, and then handled by the identical rules. One parser means a heading
 * spelled "الطبق الرئيسي" is understood the same way whichever file it arrived
 * in, and a fix to either benefits both.
 *
 * Neither library is imported at the top: together they are the better part of
 * a megabyte, and they are needed only when someone actually imports a file.
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
    .replace(/[ً-ٰٟ]/g, '')     // strip harakat
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

/* Arabic-Indic digits are what these files are typed in. */
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
 * The one parser. Takes a grid of cells, returns menu rows.
 * @param {string[][]} grid
 */
export function parseGrid(grid) {
  if (!grid?.length) throw new Error('لا يوجد محتوى قابل للقراءة');

  /* The header is the first row that names at least one category — a file that
     opens with a title and a blank line is the normal case, not an exception
     to complain about. */
  let headerRow = -1, cols = {};
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const map = {};
    (grid[i] || []).forEach((cell, j) => {
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
    const r = grid[i] || [];
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
  return { rows, warnings };
}

/**
 * @param {File} file  .xlsx / .xls / .csv
 * @returns {Promise<{rows: object[], warnings: string[], source: string, lines?: string[]}>}
 */
export async function parseMenuSheet(file) {
  const XLSX = await import('xlsx');

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('الملف لا يحتوي على أوراق');

  const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1, blankrows: false, defval: '',
  });
  if (!grid.length) throw new Error('الورقة فارغة');

  const { rows, warnings } = parseGrid(grid);
  return { rows, warnings, source: sheetName };
}

/* Two words belong to the same visual line when their baselines are within a
   couple of points. Table cells are typeset on a shared baseline, so this
   separates lines far more reliably than guessing at row heights. */
const LINE_TOLERANCE = 3;

/** Groups a page's words into visual lines, right-to-left within each line. */
function linesFromItems(items) {
  const lines = [];
  for (const it of items) {
    const str = String(it.str ?? '');
    if (!str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let line = lines.find(l => Math.abs(l.y - y) <= LINE_TOLERANCE);
    if (!line) { line = { y, cells: [] }; lines.push(line); }
    line.cells.push({ x, str });
  }
  lines.sort((a, b) => b.y - a.y);                          // top of page first
  for (const l of lines) l.cells.sort((a, b) => b.x - a.x); // RTL within the line
  return lines;
}

/** The line that names the most column headings is the header. */
function headerLineIndex(lines) {
  let best = -1, bestScore = 1;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const score = lines[i].cells.filter(c => matchKey(c.str, HEADER_ALIASES)).length;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

/**
 * Rebuilds a grid from a PDF page's text and coordinates.
 *
 * Cells are placed by where they sit on the page, not by how many words happen
 * to precede them on their line. That distinction is the whole difficulty: a
 * row continuing a two-line cell holds only the one or two words that spilled
 * over, so counting along the line would file the second dish under the first
 * column. Every cell is snapped to the nearest column of the header instead,
 * which is what makes a sparse row line up with a full one.
 */
export function gridFromItems(items) {
  const lines = linesFromItems(items);
  const hi = headerLineIndex(lines);

  /* No heading row means no columns to snap to — hand back the raw lines and
     let parseGrid reject them, which routes the file to manual sorting. */
  if (hi < 0) return lines.map(l => l.cells.map(c => c.str));

  const anchors = lines[hi].cells.map(c => c.x);
  const slotFor = (x) => {
    let best = 0, dist = Infinity;
    anchors.forEach((a, i) => {
      const d = Math.abs(a - x);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  };

  return lines.map(l => {
    const row = new Array(anchors.length).fill('');
    for (const c of l.cells) {
      const i = slotFor(c.x);
      /* One cell can arrive as several runs when the writer changed font or
         the reader split on a space. */
      row[i] = row[i] ? `${row[i]} ${c.str}` : c.str;
    }
    return row;
  });
}

/**
 * A cell holding two dishes is typeset as two lines, and arrives here as two
 * grid rows — the second carrying no meal name. Folding such a row back into
 * the one above it is what rebuilds the cell.
 *
 * The rule is narrow on purpose: only rows that name no meal are folded, and
 * only into a row that does. A row that names its own meal always stands alone.
 */
export function foldContinuationRows(grid) {
  const out = [];
  for (const row of grid) {
    const namesMeal = row.some(c => matchKey(c, MEAL_ALIASES));
    const prev = out[out.length - 1];
    const prevNamesMeal = prev && prev.some(c => matchKey(c, MEAL_ALIASES));

    if (!namesMeal && prevNamesMeal) {
      row.forEach((cell, i) => {
        if (!String(cell).trim()) return;
        prev[i] = prev[i] ? `${prev[i]}\n${cell}` : cell;
      });
    } else {
      out.push([...row]);
    }
  }
  return out;
}

/**
 * @param {File} file  .pdf
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{rows, warnings, source, lines?}>}
 *   When the page has no table this parser can find, `rows` is empty and
 *   `lines` carries the text for a person to sort by hand.
 */
export async function parseMenuPdf(file, onProgress) {
  const pdfjs = await import('pdfjs-dist');
  /* Vite rewrites this to the bundled worker URL, so the file ships with the
     app rather than being fetched from someone else's CDN at run time. */
  pdfjs.GlobalWorkerOptions.workerSrc =
    (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  let grid = [];
  const flat = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageGrid = gridFromItems(content.items);
    grid = grid.concat(pageGrid);
    flat.push(...pageGrid.map(r => r.join(' ').trim()).filter(Boolean));
    onProgress?.(Math.round((p / doc.numPages) * 100));
  }

  if (!flat.length) {
    /* No text layer at all: the PDF is a scan, a picture of a page. Nothing
       here can read it, and saying so beats returning an empty menu. */
    throw new Error('هذا الملف صورة ممسوحة ضوئياً بلا نص — احفظ المنيو كملف PDF نصّي أو استخدم إكسل');
  }

  try {
    const { rows, warnings } = parseGrid(foldContinuationRows(grid));
    return { rows, warnings, source: `${doc.numPages} صفحة` };
  } catch {
    /* Text came out, but not as a table this parser recognises — a designed
       menu rather than a spreadsheet printed to PDF. The lines are still worth
       having, so they go to the editor for a person to place. */
    return {
      rows: [],
      warnings: [],
      source: `${doc.numPages} صفحة`,
      lines: flat,
    };
  }
}

/** A blank meal, so the editor and the importer agree on the shape. */
export const emptyMeal = () => ({
  location: '', time: '',
  ...Object.fromEntries(CATEGORY_KEYS.map(k => [k, []])),
});
