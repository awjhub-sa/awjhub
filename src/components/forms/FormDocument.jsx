/**
 * src/components/forms/FormDocument.jsx
 *
 * Renders a form definition as an A4 document on company letterhead.
 *
 * One component serves three callers, differing only in `mode`:
 *   preview  the builder's live pane — blanks are dotted, nothing is editable
 *   fill     the caterer filling it in — blanks become inputs
 *   view     a submitted form — values printed as text
 *   print    the same, dressed for paper: no page frame, and the signature
 *            and stamp sit on the sheet rather than inside a dashed box —
 *            a box drawn round a signature is scaffolding for filling one
 *            in, and printing it makes a finished document look like a form
 *            somebody forgot to complete
 *
 * Keeping them in one component is the point: what the author sees while
 * building is exactly what the caterer fills and exactly what prints. Three
 * separate renderers would drift apart within a month.
 */

import { splitTokens, FIELD_META, fieldOwner } from '../../config/formSchema.js';
import { asDownload } from '../../lib/db.js';
import { useBrand } from '../../context/BrandContext.jsx';
import { formatHijri, isoToHijriLabel } from '../../lib/hijri.js';
import HijriDateInput from './HijriDateInput.jsx';

const WIDTH_CLS = {
  sm:   'w-24',
  md:   'w-44',
  auto: 'w-56',
  full: 'w-full',
};

/* A blank in preview mode: dotted, sized to its type, showing the label so the
   author can see what each gap will ask for. */
function Blank({ def, fieldKey }) {
  const w = WIDTH_CLS[FIELD_META[def?.type]?.width || 'auto'];
  return (
    <span
      className={`inline-block align-baseline mx-1 px-2 text-center text-[11px] text-muted border-b border-dotted border-muted/60 ${w}`}
      title={def?.source ? 'يُعبَّأ تلقائياً من بيانات النظام' : undefined}
    >
      {def?.source ? `«${def.label || fieldKey}»` : (def?.label || fieldKey)}
    </span>
  );
}

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

/* «2 أبريل 2026» — how a company letter dates itself, as against the
   «29/4/2026» a ruled government cell has room for. */
const gregorianLong = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${Number(m[3])} ${AR_MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
};

/* Day/month/year, the way it is written by hand on a form. */
const gregorianLabel = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${Number(m[3])}/${Number(m[2])}/${m[1]}` : iso;
};

function Printed({ value, def, downloadName }) {
  if (value === undefined || value === null || value === '') {
    return <span className="inline-block w-28 border-b border-dotted border-muted/60 mx-1" />;
  }
  /* An attachment is a file, not a string. Printing `value` put the raw
     storage URL on the page — sixty characters of signed path where a reader
     expected a document. */
  if (def?.type === 'file') {
    return (
      <a
        href={asDownload(value, downloadName)}
        download
        className="inline-flex items-center gap-1.5 mx-1 px-2.5 py-1 rounded-lg border border-primary/30
                   text-[12px] font-bold text-primary hover:bg-primary/5 transition-colors no-underline"
      >
        تحميل الملف
      </a>
    );
  }
  /* Dates are stored Gregorian and printed Hijri, matching how the paperwork
     reads, unless the template asked for the other calendar. */
  const text = def?.type === 'bool'  ? (value ? 'نعم' : 'لا')
             : def?.type === 'date'  ? (def.calendar === 'gregorian-long' ? gregorianLong(value)
                                       : def.calendar === 'gregorian' ? gregorianLabel(value)
                                       : isoToHijriLabel(value) || value)
             : Array.isArray(value)  ? value.join('، ')
             : String(value);
  return <span className="font-semibold text-ink mx-1 break-words">{text}</span>;
}

function Input({ fieldKey, def, value, error, onChange, onUpload, disabled, widthClass }) {
  const base =
    `px-2 py-1 border rounded-lg text-sm text-ink outline-none transition bg-white
     ${error ? 'border-red-400' : 'border-line focus:border-primary'}`;
  const w = widthClass || WIDTH_CLS[FIELD_META[def?.type]?.width || 'auto'];
  const set = (v) => onChange(fieldKey, v);

  /* Locked because it is not this role's to answer — either the registry
     already knows it, or another role filled it before this one saw the form. */
  if (disabled) {
    const owner = fieldOwner(def);
    /* The office opens the caterer's sheet with the caterer's pen locked, and
       that must not lock away the document they attached. */
    if (def?.type === 'file' && value) {
      return (
        <a href={asDownload(value, undefined)} download
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/30
                     text-[12px] font-bold text-primary hover:bg-primary/5 transition-colors">
          تحميل الملف
        </a>
      );
    }
    return (
      <span
        className={`inline-block ${w} px-2 py-1 rounded-lg bg-background text-sm font-semibold text-ink border border-line/60 text-center`}
        title={owner === 'system' ? 'مُعبَّأ من بيانات النظام' : 'عبّأته الإدارة عند الإسناد'}
      >
        {value || '—'}
      </span>
    );
  }

  const common = { className: `${base} ${w}`, dir: ['id', 'phone', 'email', 'number'].includes(def.type) ? 'ltr' : undefined };

  switch (def.type) {
    case 'textarea':
      return <textarea rows={3} value={value ?? ''} onChange={e => set(e.target.value)} className={`${base} w-full resize-none`} />;
    case 'select':
      return (
        <select value={value ?? ''} onChange={e => set(e.target.value)} className={`${base} ${w}`}>
          <option value="">اختر</option>
          {(def.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'bool':
      return (
        <label className="inline-flex items-center gap-1.5 align-middle">
          <input type="checkbox" checked={!!value} onChange={e => set(e.target.checked)} className="accent-primary w-4 h-4" />
          <span className="text-sm text-ink">نعم</span>
        </label>
      );
    case 'date':
      /* Hijri by default — this is a Hajj system and the paperwork is Hijri.
         A template may opt a field into the Gregorian picker. */
      return String(def.calendar || '').startsWith('gregorian')
        ? <input type="date" value={value ?? ''} onChange={e => set(e.target.value)} {...common} />
        : <HijriDateInput value={value} onChange={set} error={error} />;
    case 'file':
      return (
        <span className="inline-flex items-center gap-2">
          <label className={`${base} cursor-pointer hover:border-primary text-muted`}>
            <input
              type="file"
              accept={def.accept}
              className="hidden"
              onChange={e => e.target.files?.[0] && onUpload?.(fieldKey, e.target.files[0])}
            />
            {value ? 'استبدال الملف' : (def.accept === 'application/pdf' ? 'اختر ملف PDF' : 'اختر ملفاً')}
          </label>
          {value && (
            <a href={asDownload(value, undefined)} download
              className="text-[11px] font-bold text-primary hover:underline">
              تحميل
            </a>
          )}
        </span>
      );
    case 'number':
    case 'id':
    case 'phone':
      return (
        <input
          value={value ?? ''}
          onChange={e => set(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          maxLength={def.type === 'number' ? undefined : 10}
          {...common}
        />
      );
    default:
      return <input value={value ?? ''} onChange={e => set(e.target.value)} {...common} />;
  }
}

/* Chooses the right representation for one field in the current mode, and
   locks anything the acting role does not own. */
function Slot(props) {
  const { mode, def, as } = props;
  if (mode === 'preview') return <Blank def={def} fieldKey={props.fieldKey} />;
  if (mode === 'view' || mode === 'print') {
    return <Printed value={props.value} def={def} downloadName={props.downloadName} />;
  }
  return <Input {...props} disabled={fieldOwner(def) !== as} />;
}

/* ── Repeating table ──────────────────────────────────────── */
function TableBlock({ def, fieldKey, mode, value, onChange }) {
  const cols = def?.columns || [];
  /* A checklist is a table whose rows the author wrote, not one the caterer
     builds: the eight readiness items are the form. When `rows` is present
     they are the table, in order, and nobody may add or drop one — only answer
     against them. */
  const preset = Array.isArray(def?.rows) ? def.rows : null;
  const saved = Array.isArray(value) ? value : [];
  const rows = preset ? preset.map((r, i) => ({ ...r, ...(saved[i] || {}) })) : saved;
  const editable = mode === 'fill';

  const setCell = (i, key, v) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r));
    onChange(fieldKey, next);
  };
  const addRow    = () => onChange(fieldKey, [...rows, {}]);
  const removeRow = (i) => onChange(fieldKey, rows.filter((_, idx) => idx !== i));

  /* An empty table in preview still needs to show its shape, so draw two ghost
     rows — the author is judging the layout, not the data. */
  const display = mode === 'preview' && rows.length === 0 ? [{}, {}] : rows;

  return (
    <div className="my-3">
      {def?.label && <p className="text-xs font-bold text-ink mb-1.5">{def.label}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-line rounded-lg overflow-hidden">
          <thead className="bg-background text-muted">
            <tr>
              <th className="px-2 py-1.5 w-8 font-semibold border-b border-line">#</th>
              {cols.map(c => (
                <th key={c.key} className="px-2 py-1.5 text-right font-semibold border-b border-line">{c.label}</th>
              ))}
              {editable && !preset && <th className="w-8 border-b border-line" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {display.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="px-2 py-3 text-center text-muted">—</td></tr>
            )}
            {display.map((row, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5 text-muted text-center">{i + 1}</td>
                {cols.map(c => (
                  <td key={c.key} className="px-2 py-1.5">
                    {c.fixed ? (
                      <span className="text-ink leading-relaxed">{row[c.key]}</span>
                    ) : editable && c.options ? (
                      <select
                        value={row[c.key] ?? ''}
                        onChange={e => setCell(i, c.key, e.target.value)}
                        className="w-full px-1.5 py-1 border border-line rounded-md text-xs outline-none focus:border-primary bg-white"
                      >
                        <option value="">اختر</option>
                        {c.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : editable ? (
                      <input
                        value={row[c.key] ?? ''}
                        onChange={e => setCell(i, c.key, e.target.value)}
                        className="w-full px-1.5 py-1 border border-line rounded-md text-xs outline-none focus:border-primary bg-white"
                      />
                    ) : (
                      <span className="text-ink">{row[c.key] || <span className="text-muted/40">—</span>}</span>
                    )}
                  </td>
                ))}
                {editable && !preset && (
                  <td className="px-1">
                    <button type="button" onClick={() => removeRow(i)}
                      className="text-red-400 hover:text-red-600 text-sm leading-none">×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && !preset && (
        <button type="button" onClick={addRow}
          className="mt-1.5 text-xs font-bold text-primary hover:underline">+ إضافة صف</button>
      )}
    </div>
  );
}


/* ── Ministry grid ────────────────────────────────────────── */
/**
 * One bordered table that *is* the document.
 *
 * The ministry's minutes are not prose with blanks in them; they are a four
 * column grid where every label, every value, every section bar and the
 * signatures all sit on the same ruled lines. Rendering them with the house
 * blocks would produce a correct form that no ministry inspector recognises,
 * so this block reproduces the sheet instead of restyling it.
 *
 * The palette is written out rather than taken from the brand tokens on
 * purpose: this sheet belongs to the ministry, and it must not change colour
 * when a customer changes theirs.
 */
/* Two palettes, because the grid draws two different kinds of document.
   The ministry sheet is pale green on black rules and must stay exactly that.
   The company's own letters are neutral on a fine warm rule, with the accent
   reserved for the headings — so a form that goes out under our letterhead
   does not arrive looking like a government form. */
const PALETTES = {
  ministry: { label: '#D9EAD3', line: '#111827', accent: '#1F2937' },
  plain:    { label: '#F6F3ED', line: '#CFC7B8', accent: 'rgb(var(--c-accent-600))' },
};
const GRID_GREEN = PALETTES.ministry.label;
const GRID_LINE  = PALETTES.ministry.line;
/* Amber, and only while filling. It marks the two cells this person actually
   has to touch on a sheet of forty — on screen only, because the printed
   minute must look like the ministry's, not like a form with highlighting on
   it. `print` mode never takes this branch. */
const GRID_MINE  = '#FEF6E0';
const GRID_MINE_LINE = '#D89B2C';

function GridCell({ cell, mode, as, fields, values, errors, onChange, palette = PALETTES.ministry }) {
  /* Is this blank the acting role's to fill? */
  const sigKeys = Array.isArray(cell.sig) ? cell.sig : cell.sig ? [cell.sig] : [];
  const mine = mode === 'fill' && (
    (cell.field && fieldOwner(fields[cell.field] || {}) === as) ||
    (sigKeys.length > 0 && (cell.owner ? cell.owner === as : true))
  );
  const tone = cell.tone === 'label' ? palette.label : mine ? GRID_MINE : '#fff';
  const align = cell.align || (cell.tone === 'label' || cell.field ? 'center' : 'right');

  const body = () => {
    if (cell.sig) {
      /* Signature and stamp share one cell, as they do on the paper. */
      const keys = Array.isArray(cell.sig) ? cell.sig : [cell.sig];
      return (
        <div className="nsab-sig flex items-center justify-center gap-4 py-1 min-h-[64px]">
          {keys.map(k => {
            const img = values[k];
            if (img) return <img key={k} src={img} alt="" className="nsab-sig-img max-h-16 object-contain" />;
            /* Only the side this cell belongs to may put a mark in it. */
            if (!mine) return <span key={k} className="w-24" />;
            return (
              <label key={k} className="cursor-pointer text-[10px] font-bold text-primary hover:underline">
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && onChange(k, e.target.files[0], { file: true })} />
                إرفاق {fields[k]?.label || ''}
              </label>
            );
          })}
        </div>
      );
    }
    if (cell.field) {
      const def = fields[cell.field] || {};
      const empty = values[cell.field] === undefined || values[cell.field] === null || values[cell.field] === '';

      /* Outside fill mode a blank cell stays blank: the dotted rule the rest
         of the app draws for "nothing entered" is not on this sheet. */
      if (mode !== 'fill' && mode !== 'preview' && empty) return null;

      /* While filling, a blank that is not this role's is *printed*, not drawn
         as a disabled box. What the caterer receives is a finished sheet with
         two blanks on it; boxing all forty made it unreadable, and the fixed
         input widths pushed straight through the rules of the table. */
      if (mode === 'fill' && !mine) {
        return empty ? null : <Printed value={values[cell.field]} def={def} />;
      }

      return (
        <>
          <Slot mode={mode} as={as} fieldKey={cell.field} def={def} widthClass="w-full"
            value={values[cell.field]} error={errors[cell.field]} onChange={onChange}
            onUpload={(k, file) => onChange(k, file, { file: true })} />
          {errors[cell.field] && (
            <span className="block text-[9px] text-red-600 mt-0.5">{errors[cell.field]}</span>
          )}
        </>
      );
    }
    if (cell.lines) {
      return cell.lines.map((l, i) => (
        <span key={i} className="block leading-[1.9]">{splitTokens(l).map((p, j) =>
          p.kind === 'text' ? <span key={j}>{p.value}</span> : <ValueOf key={j} k={p.key} values={values} />)}
        </span>
      ));
    }
    return splitTokens(cell.text || '').map((p, i) =>
      p.kind === 'text' ? <span key={i}>{p.value}</span> : <ValueOf key={i} k={p.key} values={values} />);
  };

  return (
    <td
      colSpan={cell.span || 1}
      rowSpan={cell.rowspan || 1}
      className={`nsab-cell px-2 py-1.5 align-middle ${cell.bold || cell.tone === 'label' ? 'font-bold' : ''}`}
      style={{
        border: mine ? `2px solid ${GRID_MINE_LINE}` : `1px solid ${palette.line}`,
        background: tone,
        color: cell.accent ? palette.accent : undefined,
        textAlign: align,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {body()}
    </td>
  );
}

/* A token inside a grid label prints its resolved value, never an input: the
   title line reads "لموسم حج عام 1447", not a box to type the season into. */
function ValueOf({ k, values }) {
  return <span>{values?.[k] ?? ''}</span>;
}

function GridBlock({ block, mode, as, fields, values, errors, onChange }) {
  const widths = block.widths || ['17%', '41%', '21%', '21%'];
  const palette = PALETTES[block.palette] || PALETTES.ministry;
  return (
    <table
      className="nsab-grid w-full text-[11.5px] text-ink my-2"
      style={{ borderCollapse: 'collapse', tableLayout: 'fixed',
               /* The original sheet is printed with Latin digits, and Cairo
                  swaps them for Arabic-Indic ones inside Arabic text. On this
                  document the numbers are the record — a licence number that
                  reads ٤٦٠٧١٨ where the paper reads 460718 is a different
                  document to whoever checks it. */
               fontFeatureSettings: '"locl" 0',
               printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
      <tbody>
        {(block.rows || []).map((row, i) => (
          <tr key={i}>
            {(row.cells || []).map((cell, j) => (
              <GridCell key={j} cell={cell} mode={mode} as={as} palette={palette}
                fields={fields} values={values} errors={errors} onChange={onChange} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Blocks ───────────────────────────────────────────────── */
function Block({ block, fields, mode, as, values, errors, onChange }) {
  const slot = (key) => (
    <Slot
      key={key}
      mode={mode}
      as={as}
      fieldKey={key}
      def={fields[key]}
      value={values[key]}
      error={errors[key]}
      onChange={onChange}
      onUpload={(k, file) => onChange(k, file, { file: true })}
    />
  );

  /* Every prose block resolves tokens the same way. Doing this per case is how
     a heading ends up printing a literal {{season_name}} to a caterer. */
  const prose = (text) =>
    splitTokens(text || '').map((part, i) =>
      part.kind === 'text' ? <span key={i}>{part.value}</span> : slot(part.key),
    );

  switch (block.type) {
    case 'heading':
      return (
        <h3 className="text-sm font-black text-ink mt-5 mb-2 pb-1 border-b border-line">
          {prose(block.text)}
        </h3>
      );

    case 'paragraph':
      return (
        <p className="text-[13px] leading-[2.4] text-ink my-2 text-justify">
          {prose(block.text)}
        </p>
      );

    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className="my-3 space-y-1.5 pr-6">
          {(block.items || []).map((item, i) => (
            <li key={i} className="relative text-[13px] leading-[2.1] text-ink text-justify">
              {block.ordered ? (
                <span className="absolute -right-6 top-0 w-5 text-left text-[11px] font-bold text-muted">{i + 1}.</span>
              ) : (
                <span className="absolute -right-4 top-[0.75em] w-1.5 h-1.5 rounded-full bg-ink/70" />
              )}
              {prose(item)}
            </li>
          ))}
        </Tag>
      );
    }

    case 'fields': {
      /* Bulleted «label: blank» lines — how the official letters present a
         short run of details, rather than as a grid of boxed inputs. */
      if (block.style === 'list') {
        return (
          <ul className="my-3 space-y-2 pr-5">
            {(block.keys || []).map(key => {
              const def = fields[key] || {};
              return (
                <li key={key} className="relative text-[13px] leading-[2.2] text-ink">
                  <span className="absolute -right-4 top-[0.7em] w-1.5 h-1.5 rounded-full bg-ink/70" />
                  <span className="font-medium">{def.label || key}</span>
                  <span className="mx-1">:</span>
                  {slot(key)}
                  {errors[key] && <span className="text-[10px] text-red-600 mr-2">{errors[key]}</span>}
                </li>
              );
            })}
          </ul>
        );
      }

      /* The three-up row is how the official minutes lay out a signatory:
         name, capacity, ID on one line. Written out rather than interpolated
         because Tailwind scans source text and never sees a built class. */
      const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 md:grid-cols-4' }[block.columns] || 'grid-cols-1';
      return (
        <div className={`grid ${cols} gap-x-6 gap-y-3 my-3`}>
          {(block.keys || []).map(key => {
            const def = fields[key] || {};
            return (
              <div key={key}>
                <label className="block text-[11px] font-medium text-muted mb-1">
                  {def.label || key} {def.required && <span className="text-red-500">*</span>}
                </label>
                {def.type === 'table'
                  ? <TableBlock def={def} fieldKey={key} mode={mode} value={values[key]} onChange={onChange} />
                  : slot(key)}
                {errors[key] && <p className="text-[10px] text-red-600 mt-1">{errors[key]}</p>}
              </div>
            );
          })}
        </div>
      );
    }

    case 'table':
      return (
        <TableBlock
          def={fields[block.key]}
          fieldKey={block.key}
          mode={mode}
          value={values[block.key]}
          onChange={onChange}
        />
      );

    case 'grid':
      return (
        <GridBlock block={block} mode={mode} as={as}
          fields={fields} values={values} errors={errors} onChange={onChange} />
      );

    case 'note':
      return (
        <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
          {prose(block.text)}
        </div>
      );

    case 'divider':
      return <hr className="my-4 border-line" />;

    case 'signature': {
      /* Defaults to the signature/stamp pair the official letters use; a
         template may override with its own slots. */
      const slots = block.slots?.length
        ? block.slots
        : [{ label: 'التوقيع', key: 'signature' }, { label: 'الختم', key: 'stamp' }];
      return (
        <div className="mt-10 flex flex-wrap gap-10 justify-around">
          {slots.map(s => {
            const img = values[s.key];
            /* On paper the box goes and a rule takes its place — the same line
               a signature is written above on any letter. On screen the dashed
               box stays, because there it means "something goes here". */
            const box = mode === 'print' ? (
              <div className="h-24 flex items-end justify-center overflow-hidden">
                {img
                  ? <img src={img} alt={s.label} className="max-h-[92px] object-contain" />
                  : <span className="w-full border-b border-ink/40" />}
              </div>
            ) : (
              <div className={`h-20 rounded-lg border border-dashed border-line bg-background/40 flex items-center justify-center overflow-hidden ${
                mode === 'fill' ? 'cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors' : ''
              }`}>
                {img
                  ? <img src={img} alt={s.label} className="max-h-[70px] object-contain" />
                  : <span className="text-[10px] text-muted">
                      {mode === 'fill' ? `ارفع صورة ${s.label}` : `مكان ${s.label}`}
                    </span>}
              </div>
            );
            return (
              <div key={s.key} className="w-48 text-center">
                {mode !== 'print' && <p className="text-xs font-bold text-ink mb-2">{s.label}</p>}
                {mode === 'fill' ? (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && onChange?.(s.key, e.target.files[0], { file: true })}
                    />
                    {box}
                  </label>
                ) : box}
                {mode === 'print' && (
                  <p className="text-[11px] font-bold text-ink mt-1.5">{s.label}</p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    default:
      return null;
  }
}

/* ── The page ─────────────────────────────────────────────── */
export default function FormDocument({
  definition = { blocks: [], fields: {} },
  mode = 'preview',
  /* Which role is holding the pen. In fill mode everything not owned by this
     role renders locked, so the caterer physically cannot alter what the admin
     already settled. */
  as = 'caterer',
  values = {},
  errors = {},
  onChange = () => {},
  title,
  formNumber,
  meta,
}) {
  const { brand } = useBrand();
  const { blocks = [], fields = {} } = definition;
  /* Print is view, plus the paper treatment. Everything that asks "is this
     read-only?" should say yes for both. */
  const isPaper = mode === 'print';
  /* A ministry form carries the ministry's masthead, or none — never ours.
     Putting our letterhead above it would make it a different document, and
     an inspector is entitled to receive the sheet they issued. */
  const bare = definition?.chrome === 'none';
  const today = new Date();
  const hijri = (() => { try { return formatHijri(today); } catch { return null; } })();

  return (
    <div
      className={`nsab-doc bg-white mx-auto ${isPaper ? '' : 'shadow-[0_2px_16px_rgb(var(--c-ink)/0.10)] border border-line'}`}
      style={{ width: '100%', maxWidth: 794, minHeight: 400 }}   /* 794px ≈ A4 at 96dpi */
      dir="rtl"
    >
      {/* Letterhead — from brand.js, never from the template. Reselling the
          system to another company means swapping brand.js, not the forms. */}
      {!bare && (
      <header className="px-8 pt-7 pb-4 border-b-2" style={{ borderColor: 'rgb(var(--c-primary))' }}>
        <div className="flex items-start justify-between gap-4">
          <img src={brand.logo.full} alt={brand.companyFullAr} className="h-11 w-auto" />
          <div className="text-left text-[10px] text-muted leading-relaxed">
            {formNumber && <div className="font-bold text-ink">{formNumber}</div>}
            <div dir="ltr">{today.toISOString().slice(0, 10)}</div>
            {hijri && <div>{hijri}</div>}
          </div>
        </div>
        {title && (
          <h2 className="mt-4 text-center text-base font-black text-ink">{title}</h2>
        )}
        {meta && <p className="mt-1 text-center text-[11px] text-muted">{meta}</p>}
      </header>
      )}

      <div className={`nsab-body ${bare ? 'nsab-bare px-6 py-6' : 'px-8 py-6'}`}>
        {blocks.length === 0 ? (
          <p className="py-16 text-center text-muted text-sm">
            المستند فارغ
          </p>
        ) : (
          blocks.map((block, i) => (
            <div key={block.id || i} className={block.pin === 'bottom' ? 'nsab-pin' : undefined}>
            <Block
              block={block}
              fields={fields}
              mode={mode}
              as={as}
              values={values}
              errors={errors}
              onChange={onChange}
            />
            </div>
          ))
        )}
      </div>

      {!bare && (
      <footer className="px-8 py-3 border-t border-line text-[9px] text-muted flex justify-between gap-4">
        <span>{brand.companyFullAr}</span>
        <span className="text-center">
          {[brand.legal?.crNumber && `س.ت ${brand.legal.crNumber}`, brand.legal?.phone, brand.legal?.website]
            .filter(Boolean).join(' · ')}
        </span>
        <span dir="ltr">{brand.companyFullEn}</span>
      </footer>
      )}
    </div>
  );
}
