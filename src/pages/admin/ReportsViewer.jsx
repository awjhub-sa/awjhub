/**
 * ReportsViewer.jsx — /admin/reports-view
 *
 * The report as a document. The reports centre picks what goes in it; this
 * page renders it on A4 in the company's identity, and the browser turns it
 * into a PDF.
 *
 * Generating the PDF ourselves meant re-implementing text layout — line
 * breaking, column widths, Arabic shaping — against a library that does none of
 * it. The browser already does all of that, with the real Cairo font, so the
 * document is HTML and Save-as-PDF is the export.
 *
 * Opens outside AdminLayout so nothing but the document reaches the paper.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Printer, FileXls, X, CircleNotch } from '@phosphor-icons/react';
import { db } from '../../lib/db.js';
import { useBrand } from '../../context/BrandContext.jsx';
import { formatHijri } from '../../lib/hijri.js';
import { SOURCE_BY_KEY } from '../../config/reportSources.js';
import {
  AR_NUM, buildLookups, buildTable, describeFilters,
  scoreOf, bandOf, exportCsv, readReportRequest,
} from '../../lib/reportQuery.js';
import './reports-viewer.css';
import { usePrintPage, closeDocumentTab } from '../../lib/printPage.js';

const ROLE_AR = { observer: 'مراقب', supervisor: 'مشرف', staff: 'موظف', admin: 'مسؤول', caterer: 'متعهد' };

const fmtDate = (v) => {
  if (!v) return '—';
  const d = v?.toDate?.() ?? new Date(v);
  return isNaN(d) ? '—' : d.toISOString().slice(0, 10);
};

export default function ReportsViewer() {
  const nav = useNavigate();
  usePrintPage('A4 portrait', '12mm');
  const [params] = useSearchParams();
  const { brand } = useBrand();

  const request = useMemo(() => readReportRequest(params.get('k')), [params]);

  const [rows,    setRows]    = useState(null);   // sourceKey → records
  const [meta,    setMeta]    = useState({ caterers: [], centers: [], seasons: [], templates: [] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* The tab title becomes the PDF's default filename, so it carries the
     report's name rather than the app's. */
  useEffect(() => {
    if (request?.title) document.title = request.title;
  }, [request]);

  useEffect(() => {
    if (!request) { setError('انتهت صلاحية طلب التقرير — أعد فتحه من قسم التقارير.'); setLoading(false); return; }
    (async () => {
      try {
        const [ca, ce, se, tp] = await Promise.all([
          db.caterers.list({ orderBy: 'name' }),
          db.centers.list(),
          db.seasons.list(),
          db.form_templates.list(),
        ]);
        setMeta({ caterers: ca, centers: ce, seasons: se, templates: tp });

        const pairs = await Promise.all(
          request.picked.map(async (k) => [k, await db[SOURCE_BY_KEY[k].table].list()]),
        );
        setRows(Object.fromEntries(pairs));
      } catch (ex) { setError(ex.message); }
      setLoading(false);
    })();
  }, [request]);

  const lookups = useMemo(() => buildLookups(meta), [meta]);

  const sections = useMemo(() => {
    if (!rows || !request) return [];
    return request.picked.map(k => {
      const source = SOURCE_BY_KEY[k];
      const table = buildTable(source, rows[k], {
        filters: request.filters, search: request.search,
        lookups, cols: request.cols, detailed: request.detailed,
      });
      return { source, ...table };
    });
  }, [rows, request, lookups]);

  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
  const subtitle = request
    ? describeFilters({ filters: request.filters, detailed: request.detailed, seasons: meta.seasons, totalRows })
    : '';

  const palette = {
    '--rv-primary': brand?.colors?.primary || '#1B2A4A',
    '--rv-accent':  brand?.colors?.accent  || '#D8A15C',
  };

  const today = new Date();
  const stamp = { hijri: formatHijri(today), greg: today.toISOString().slice(0, 10) };

  const Sheet = ({ children, foot = true }) => (
    <article className="rv-page">
      <header className="rv-head">
        {brand?.logo?.full && <img src={brand.logo.full} alt="" />}
        <div className="rv-head-meta">
          <b>{stamp.hijri}</b>
          <div>{stamp.greg}</div>
        </div>
      </header>
      {children}
      {foot && (
        <footer className="rv-foot">
          <span><b>{brand?.companyFullAr}</b></span>
          <span>{request?.title}</span>
        </footer>
      )}
    </article>
  );

  return (
    <div className="rv" dir="rtl" style={palette}>
      <Toolbar sections={sections} title={request?.title} />

      {loading && <div className="rv-page"><p className="rv-empty">جارٍ تحضير التقرير…</p></div>}
      {error && !loading && <div className="rv-page"><p className="rv-empty">{error}</p></div>}

      {!loading && !error && (
        <>
          {/* ── Cover ── */}
          <Sheet>
            <div className="rv-title">
              <h1>{request.title}</h1>
              <p>{subtitle}</p>
            </div>

            <div className="rv-stats">
              <Stat label="عدد الأقسام" value={AR_NUM(sections.length)} color="var(--rv-primary)" />
              <Stat label="إجمالي السجلات" value={AR_NUM(totalRows)} color="var(--rv-accent-ink)" />
              <Stat label="تاريخ الإصدار" value={stamp.greg} color="#475569" text />
              <Stat label="جهة الإصدار" value={brand?.companyName} color="#475569" text />
            </div>

            <div className="rv-tablewrap">
              <table className="rv-table">
                <thead>
                  <tr>
                    <th className="rv-idx">#</th>
                    <th>القسم</th>
                    <th className="rv-tight">المجموعة</th>
                    <th className="rv-tight">عدد السجلات</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s, i) => (
                    <tr key={s.source.key}>
                      <td className="rv-idx">{AR_NUM(i + 1)}</td>
                      <td className="rv-strong">{s.source.label}</td>
                      <td className="rv-tight">{s.source.group}</td>
                      <td className="rv-tight rv-strong">{AR_NUM(s.rows.length)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sheet>

          {/* ── One sheet per section ── */}
          {sections.map(s => {
            const dossier = request.detailed && s.source.criteriaSections;
            return (
              <div key={s.source.key}>
                <Sheet>
                  <div className="rv-band">
                    <h2>{s.source.label}</h2>
                    <span>{AR_NUM(s.count)} سجل</span>
                  </div>
                  {dossier
                    ? <ReadinessSummary records={s.records} />
                    : s.rows.length === 0
                    ? <p className="rv-empty">لا سجلات مطابقة</p>
                    : <PlainTable columns={s.columns} rows={s.rows} />}
                </Sheet>

                {dossier && s.records.map(rec => (
                  <CenterRecord
                    key={rec.id ?? `${rec.center}-${rec.timestamp}`}
                    rec={rec}
                    source={s.source}
                    withPhotos={request.photos}
                    Sheet={Sheet}
                  />
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* Any section's rows, as a table.
 *
 * Column widths are the whole problem here. Left to itself the browser gives
 * every column an equal share, so a date and a score take as much room as a
 * caterer's full trade name — and the name is what wraps. Short columns are
 * measured from their content and pinned; whatever is left goes to the columns
 * that hold prose. */
const NARROW = /^(#|رقم|المركز|الحالة|التاريخ|اليوم|الدرجة|النسبة|التقدير|الخطورة|المشعر|الوجبة|التصنيف|الفئة|الصفة|الدور|كمية|عدد|المرحلة|وقت|مفعّل|المرفقات|التأخير|الجنسية|الشاخص|المربع|الجوال|البريد|السجل|رخصة|نوع)/;

function PlainTable({ columns, rows }) {
  const tight = columns.map(c => NARROW.test(String(c).trim()));

  return (
    <div className="rv-tablewrap">
      <table className="rv-table">
        <thead>
          <tr>
            <th className="rv-idx">#</th>
            {columns.map((c, i) => (
              <th key={i} className={tight[i] ? 'rv-tight' : undefined}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="rv-idx">{AR_NUM(i + 1)}</td>
              {r.map((cell, j) => (
                <td key={j} className={tight[j] ? 'rv-tight' : undefined}>{cell || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* The opening sheet of a محضر: where every centre stands, at a glance, before
   the reader turns to any single one of them. */
function ReadinessSummary({ records }) {
  if (!records.length) return <p className="rv-empty">لا تقييمات مطابقة</p>;

  const scored = records.map(r => scoreOf(r)).filter(v => v != null);
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const top = scored.filter(v => v >= 8).length;
  const low = scored.filter(v => v < 6).length;

  return (
    <>
      <div className="rv-stats">
        <Stat label="عدد المراكز" value={AR_NUM(records.length)} color="var(--rv-primary)" />
        <Stat label="متوسط الجاهزية"
          value={avg == null ? '—' : AR_NUM(avg.toFixed(1))}
          color={avg == null ? '#475569' : bandOf(avg).color} />
        <Stat label="ممتاز" value={AR_NUM(top)} color="#15803D" />
        <Stat label="دون المقبول" value={AR_NUM(low)} color="#B91C1C" />
      </div>

      {/* The narrow columns declare themselves narrow, so the two that hold
          names get the rest of the page instead of wrapping a surname onto a
          line of its own. */}
      <div className="rv-tablewrap">
        <table className="rv-table">
          <thead>
            <tr>
              <th className="rv-idx">#</th>
              <th className="rv-tight">المركز</th>
              <th>المتعهد</th>
              <th>المقيّم</th>
              <th className="rv-tight">الدرجة</th>
              <th className="rv-tight">التقدير</th>
              <th className="rv-tight">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const sc = scoreOf(r);
              const band = sc == null ? null : bandOf(sc);
              return (
                <tr key={r.id ?? i}>
                  <td className="rv-idx">{AR_NUM(i + 1)}</td>
                  <td className="rv-tight rv-strong">{r.center || '—'}</td>
                  <td>{r.caterer || '—'}</td>
                  <td>{r.observer || '—'}</td>
                  <td className="rv-tight rv-strong">{sc == null ? '—' : AR_NUM(sc.toFixed(1))}</td>
                  <td className="rv-tight">
                    {band
                      ? <span className="rv-pill" style={{
                          color: band.color, background: band.soft, borderColor: band.line,
                        }}>{band.label}</span>
                      : '—'}
                  </td>
                  <td className="rv-tight">{fmtDate(r.timestamp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── A single centre's inspection record ─────────────────────
   One centre, one page: what was inspected, when, by whom, the answer to every
   criterion with the inspector's note, the photographs, and a place to sign. */
function CenterRecord({ rec, source, withPhotos, Sheet }) {
  const answers = rec.answers || {};
  const details = answers.__details || {};
  const photos  = answers.__photos  || {};
  const sc = scoreOf(rec);
  const band = sc == null ? null : bandOf(sc);

  const shots = Object.entries(photos).filter(([, u]) => !!u);
  const criteriaById = useMemo(() => {
    const m = new Map();
    for (const sec of source.criteriaSections) for (const q of sec.criteria) m.set(String(q.id), q);
    return m;
  }, [source]);

  const pairs = [
    ['المركز',  rec.center],
    ['المتعهد', rec.caterer],
    ['المقيّم',  rec.observer],
    ['الصفة',   ROLE_AR[rec.role] ?? rec.role],
    ['التاريخ', fmtDate(rec.timestamp)],
    ['اليوم',   rec.scheduledDate],
  ];

  const showPhotos = withPhotos && shots.length > 0;

  return (
    <>
    <Sheet>
      <div className="rv-title">
        <h1>{source.dossierTitle || source.label}</h1>
        <p>{rec.center}</p>
      </div>

      <div className="rv-id">
        {band && (
          <div className="rv-badge" style={{ background: band.color }}>
            <i>من ١٠</i>
            <b>{AR_NUM(sc.toFixed(1))}</b>
            <em>{band.label}</em>
          </div>
        )}
        <div className="rv-id-grid">
          {pairs.map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <strong title={v || ''}>{v || '—'}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* No per-criterion score column: the reader is looking for which
          criterion failed, and the weight of each one only adds up to the
          final score already shown in the badge. */}
      <div className="rv-tablewrap">
        <table className="rv-table">
          <thead>
            <tr>
              <th className="rv-idx">#</th>
              <th>المعيار</th>
              <th className="rv-tight">الإجابة</th>
            </tr>
          </thead>
          <tbody>
            {source.criteriaSections.map(sec => (
              <Fragment key={sec.id ?? sec.title}>
                <tr className="rv-sec-row">
                  <td colSpan={3}>{sec.title}</td>
                </tr>
                {sec.criteria.map(q => {
                  const a = answers[q.id] ?? answers[String(q.id)] ?? '';
                  const note = details[q.id] ?? details[String(q.id)] ?? '';
                  return (
                    <tr key={`${sec.title}-${q.id}`}>
                      <td className="rv-idx">{AR_NUM(q.id)}</td>
                      <td>
                        {q.text}
                        {note && <span className="rv-note">— {note}</span>}
                      </td>
                      <td className="rv-tight"><Answer value={a} /></td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Sheet>

    {/* Photographs get their own sheet. Twenty-four criteria and three
        site photos do not share an A4 page, and squeezing them onto one
        would shrink the criteria — the part being signed for — to fit the
        part that merely illustrates it. */}
    {showPhotos && (
      <Sheet>
        <div className="rv-title">
          <h1>{source.dossierTitle || source.label}</h1>
          <p>{rec.center} — الصور الميدانية</p>
        </div>
        <div className="rv-band">
          <h2>الصور المرفقة</h2>
          <span>{AR_NUM(shots.length)} صورة</span>
        </div>
        <div className="rv-shots">
          {shots.map(([qid, url]) => (
            <figure className="rv-shot" key={qid}>
              <img src={url} alt="" loading="lazy" />
              <figcaption>
                <b>{AR_NUM(qid)}</b> · {criteriaById.get(String(qid))?.text ?? 'معيار'}
              </figcaption>
            </figure>
          ))}
        </div>
      </Sheet>
    )}
    </>
  );
}

/* نعم / لا carry the whole reading of the page, so they are the only coloured
   thing in the table. */
function Answer({ value }) {
  if (!value) return <span className="rv-pill rv-pill-na">—</span>;
  const cls = value === 'نعم' ? 'rv-pill-yes' : value === 'لا' ? 'rv-pill-no' : 'rv-pill-na';
  return <span className={`rv-pill ${cls}`}>{value}</span>;
}

function Stat({ label, value, color, text }) {
  return (
    <div className={`rv-stat${text ? ' is-text' : ''}`} style={{ '--rv-stat-color': color }}>
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
  );
}

function Toolbar({ sections, title }) {
  const [pick, setPick] = useState(0);
  const busy = !sections.length;
  const s = sections[pick];

  return (
    <div className="rv-bar rv-noprint">
      <button className="rv-btn rv-btn-main" onClick={() => window.print()} disabled={busy}>
        {busy ? <CircleNotch size={15} className="animate-spin" /> : <Printer size={15} weight="bold" />}
        اطبع / احفظ PDF
      </button>

      <button className="rv-btn" disabled={busy}
        onClick={() => s && exportCsv({ columns: s.columns, rows: s.rows, fileName: `${s.source.label}.csv` })}>
        <FileXls size={15} /> تنزيل Excel
      </button>

      {sections.length > 1 && (
        <select className="rv-btn" value={pick} onChange={e => setPick(Number(e.target.value))}
          title="القسم الذي سيُنزَّل كملف Excel">
          {sections.map((x, i) => <option key={x.source.key} value={i}>{x.source.label}</option>)}
        </select>
      )}

      <button className="rv-btn" onClick={() => closeDocumentTab(nav, '/admin/reports-center')}>
        <X size={14} /> إغلاق
      </button>

      <p className="rv-hint">
        عند الطباعة اختر <b>A4</b> وفعّل <b>«Background graphics»</b> ليخرج التنسيق الملوّن — ثم
        احفظ كـ PDF{title ? ` باسم «${title}»` : ''}.
      </p>
    </div>
  );
}
