import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db.js';
import {
  REPORT_SOURCES, SOURCE_GROUPS, DHU_DAYS,
} from '../../config/reportSources.js';
import {
  AR_NUM, buildLookups, buildTable, describeFilters,
  stashReportRequest, pruneReportRequests,
} from '../../lib/reportQuery.js';
import PageHeader from '../../components/PageHeader.jsx';
import {
  FileArrowDown, ArrowSquareOut, MagnifyingGlass as Search, X, Warning,
  Columns, Funnel, Table as TableIcon, CalendarBlank, ListChecks,
} from '@phosphor-icons/react';

const inputCls =
  'w-full px-3 py-2 border border-line rounded-xl text-sm text-ink outline-none focus:border-primary transition placeholder-muted/40 bg-white';

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-medium text-muted mb-1">{label}</label>
    {children}
  </div>
);

/* Rows are read on demand rather than kept subscribed: a report is a snapshot
   someone asked for, and holding realtime channels open on a dozen tables so a
   preview can twitch would cost more than it is worth. */
export default function AdminReportsCenter() {
  /* Several sections at once — a season report is one document covering
     evaluations, reports and logistics, not three separate files. */
  const [picked, setPicked] = useState([REPORT_SOURCES[0].key]);
  const [active, setActive] = useState(REPORT_SOURCES[0].key);

  const sources = useMemo(
    () => REPORT_SOURCES.filter(s => picked.includes(s.key)),
    [picked],
  );
  const source = sources.find(s => s.key === active) || sources[0] || REPORT_SOURCES[0];

  const [data,    setData]    = useState({});   // sourceKey → rows
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const [cols,     setCols]     = useState({}); // sourceKey → column keys
  const [search,   setSearch]   = useState('');
  const [detailed, setDetailed] = useState(false);
  const [photos,   setPhotos]   = useState(true);
  const [filters,  setFilters]  = useState({
    from: '', to: '', dhuDay: '', center: '', caterer: '', status: '', role: '', season: '',
  });

  const [caterers,  setCaterers]  = useState([]);
  const [centers,   setCenters]   = useState([]);
  const [seasons,   setSeasons]   = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [ca, ce, se, tp] = await Promise.all([
          db.caterers.list({ orderBy: 'name' }),
          db.centers.list(),
          db.seasons.list(),
          db.form_templates.list(),
        ]);
        setCaterers(ca); setCenters(ce); setSeasons(se); setTemplates(tp);
        setFilters(f => ({ ...f, season: (se.find(s => s.isActive) || se[0])?.id || '' }));
      } catch (ex) { setError(ex.message); }
    })();
  }, []);

  const lookups = useMemo(
    () => buildLookups({ caterers, centers, templates }),
    [caterers, centers, templates],
  );

  /* Load only what is newly picked; already-loaded sections are kept. */
  useEffect(() => {
    const missing = picked.filter(k => !data[k]);
    if (!missing.length) return;
    setLoading(true);
    Promise.all(missing.map(k => {
      const s = REPORT_SOURCES.find(x => x.key === k);
      return db[s.table].list().then(rows => [k, rows]);
    }))
      .then(pairs => setData(d => ({ ...d, ...Object.fromEntries(pairs) })))
      .catch(ex => setError(ex.message))
      .finally(() => setLoading(false));
  }, [picked]);

  useEffect(() => {
    setCols(c => {
      const next = { ...c };
      for (const s of REPORT_SOURCES) if (!next[s.key]) next[s.key] = s.defaultColumns;
      return next;
    });
  }, []);

  const togglePick = (key) => {
    setPicked(p => {
      const next = p.includes(key) ? p.filter(k => k !== key) : [...p, key];
      if (!next.length) return p;                      // never leave it empty
      if (!next.includes(active)) setActive(next[0]);
      else if (!p.includes(key)) setActive(key);
      return next;
    });
  };

  const has = (s, f) => s.filters?.includes(f);

  const tables = useMemo(
    () => Object.fromEntries(sources.map(s => [
      s.key,
      buildTable(s, data[s.key] || [], { filters, search, lookups, cols, detailed }),
    ])),
    [sources, data, cols, filters, search, detailed, lookups],
  );

  const current = tables[source.key] || { columns: [], rows: [], count: 0 };
  const totalRows = sources.reduce((n, s) => n + (tables[s.key]?.rows.length || 0), 0);

  const filterSummary = useMemo(
    () => describeFilters({ filters, detailed, seasons, totalRows }),
    [filters, totalRows, seasons, detailed],
  );

  const docTitle = sources.length === 1
    ? (detailed && sources[0].criteriaSections ? sources[0].dossierTitle : sources[0].label)
    : 'تقرير مجمّع';

  /* One button, one destination. The report opens as a document in its own tab
     — laid out on A4 in the company's identity — and every way of taking it
     away (print to PDF, download Excel) lives there, next to what it exports. */
  const openReport = () => {
    if (!totalRows) return setError('لا توجد سجلات مطابقة — عدّل الفلاتر أولاً.');
    const id = stashReportRequest({
      title: docTitle, picked, cols, filters, search, detailed, photos,
    });
    pruneReportRequests(id);
    window.open(`/admin/reports-view?k=${id}`, '_blank', 'noopener');
  };

  /* A readiness inspection is a record, not a row: in detailed mode each centre
     gets a page carrying its data, every criterion with the answer given, the
     inspector's notes and the photographs taken on site. */
  const canDossier = !!source.criteriaSections;

  const anyHas = (f) => sources.some(s => has(s, f));

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      <PageHeader
        Icon={FileArrowDown}
        title="التقارير"
        subtitle="اختر أي أقسام في النظام، حدّد ما تريده، وصدّره بهوية الشركة"
      />

      {/* ── 1. Sections ── */}
      <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <TableIcon size={15} className="text-primary" />
            <h2 className="text-sm font-bold text-ink">١ · الأقسام ({AR_NUM(picked.length)})</h2>
          </div>
          <p className="text-[11px] text-muted">اختر أكثر من قسم لتقرير واحد مجمّع</p>
        </div>
        {SOURCE_GROUPS.map(group => (
          <div key={group}>
            <p className="text-[10px] font-bold text-muted mb-1.5">{group}</p>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_SOURCES.filter(s => s.group === group).map(s => {
                const on = picked.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => togglePick(s.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      on ? 'text-white border-transparent shadow-[0_3px_10px_rgb(var(--c-primary)/0.35)]'
                         : 'bg-white text-ink border-line hover:border-primary/40'
                    }`}
                    style={on
                      ? { background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }
                      : undefined}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── 2. Filters ── */}
      <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Funnel size={15} className="text-primary" />
          <h2 className="text-sm font-bold text-ink">٢ · التصفية</h2>
        </div>

        {anyHas('dhuDay') && (
          <Field label="يوم ذي الحجة">
            <div className="flex flex-wrap gap-1.5">
              {[['', 'الكل'], ...DHU_DAYS.map(d => [String(d), AR_NUM(d)])].map(([v, label]) => (
                <button
                  key={v || 'all'}
                  onClick={() => setFilters(f => ({ ...f, dhuDay: v }))}
                  className={`min-w-[44px] px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    filters.dhuDay === v
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-ink border-line hover:border-primary/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {anyHas('date') && (
            <>
              <Field label="من تاريخ">
                <input type="date" value={filters.from} dir="ltr"
                  onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="إلى تاريخ">
                <input type="date" value={filters.to} dir="ltr"
                  onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className={inputCls} />
              </Field>
            </>
          )}
          {anyHas('season') && (
            <Field label="الموسم">
              <select value={filters.season} onChange={e => setFilters(f => ({ ...f, season: e.target.value }))} className={inputCls}>
                <option value="">كل المواسم</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          {anyHas('center') && (
            <Field label="المركز">
              <select value={filters.center} onChange={e => setFilters(f => ({ ...f, center: e.target.value }))} className={inputCls}>
                <option value="">كل المراكز</option>
                {[...new Set(centers.map(c => c.code))].sort((a, b) =>
                  (parseInt(String(a).replace(/\D/g, ''), 10) || 0) - (parseInt(String(b).replace(/\D/g, ''), 10) || 0)
                ).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          )}
          {anyHas('caterer') && (
            <Field label="المتعهد">
              <select value={filters.caterer} onChange={e => setFilters(f => ({ ...f, caterer: e.target.value }))} className={inputCls}>
                <option value="">كل المتعهدين</option>
                {caterers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {source.statuses && (
            <Field label="الحالة">
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                <option value="">كل الحالات</option>
                {Object.entries(source.statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          )}
          {anyHas('role') && (
            <Field label="الدور">
              <select value={filters.role} onChange={e => setFilters(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                <option value="">كل الأدوار</option>
                {[['observer', 'مراقب'], ['supervisor', 'مشرف'], ['staff', 'موظف'], ['admin', 'مسؤول']]
                  .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          )}
          <Field label="بحث حر">
            <div className="relative">
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <Search size={13} className="text-muted" />
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="أي نص داخل السجل" className={`${inputCls} pr-8`} />
            </div>
          </Field>
        </div>

        {sources.some(s => s.questions?.length) && (
          <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-line cursor-pointer hover:bg-background transition-colors">
            <input type="checkbox" checked={detailed}
              onChange={e => setDetailed(e.target.checked)}
              className="accent-primary w-4 h-4 mt-0.5" />
            <span className="text-xs">
              <span className="text-ink font-medium flex items-center gap-1.5">
                <ListChecks size={13} />
                {sources.some(s => s.criteriaSections)
                  ? 'محضر مفصّل — صفحة لكل مركز'
                  : 'عرض مفصّل — إجابة كل معيار'}
              </span>
              <span className="text-muted">
                {sources.some(s => s.criteriaSections)
                  ? 'صفحة كاملة لكل مركز: بياناته وتاريخه وإجابة كل معيار وصوره وخانات التوقيع.'
                  : 'يفكّ كل تقييم إلى سطر لكل سؤال. الدرجة وحدها لا تقول أي معيار سقط.'}
              </span>
            </span>
          </label>
        )}
      </section>

      {/* ── 3. Columns ── */}
      {!detailed && (
        <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Columns size={15} className="text-primary" />
              <h2 className="text-sm font-bold text-ink">
                ٣ · أعمدة «{source.label}» ({AR_NUM((cols[source.key] || []).length)})
              </h2>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setCols(c => ({ ...c, [source.key]: source.columns.map(x => x.key) }))}
                className="px-2.5 py-1 rounded-lg border border-line text-[11px] font-bold text-muted hover:text-primary hover:border-primary/40 transition-colors">
                الكل
              </button>
              <button onClick={() => setCols(c => ({ ...c, [source.key]: source.defaultColumns }))}
                className="px-2.5 py-1 rounded-lg border border-line text-[11px] font-bold text-muted hover:text-primary hover:border-primary/40 transition-colors">
                الافتراضي
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {source.columns.map(c => {
              const on = (cols[source.key] || []).includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => setCols(m => ({
                    ...m,
                    [source.key]: on
                      ? (m[source.key] || []).filter(k => k !== c.key)
                      : [...(m[source.key] || []), c.key],
                  }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                    on ? 'bg-accent/15 border-accent/40 text-accent-600' : 'bg-white border-line text-muted hover:border-primary/30'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2.5 text-sm font-medium flex items-start gap-2">
          <Warning size={15} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-amber-600 hover:text-amber-900"><X size={14} /></button>
        </div>
      )}

      {/* ── 4. Preview + export ── */}
      <section className="bg-white rounded-2xl border border-line overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-ink">{detailed ? '٣' : '٤'} · المعاينة</h2>
            <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
              <CalendarBlank size={11} /> {filterSummary}
            </p>
          </div>
          <button onClick={openReport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold hover:opacity-90 transition shadow-[0_4px_16px_rgb(var(--c-primary)/0.35)]"
            style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
            <ArrowSquareOut size={15} weight="bold" />
            عرض التقرير
          </button>
        </div>

        <div className="px-4 pb-1 -mt-1 flex items-center gap-4 flex-wrap">
          {canDossier && detailed && (
            <label className="flex items-center gap-2 text-[11px] text-muted cursor-pointer">
              <input type="checkbox" checked={photos} onChange={e => setPhotos(e.target.checked)}
                className="accent-primary w-3.5 h-3.5" />
              تضمين الصور الميدانية
            </label>
          )}
          <span className="text-[11px] text-muted">
            يفتح في تبويب مستقل بمقاس A4 وهوية الشركة — ومنه تحفظه PDF أو تنزّله Excel.
          </span>
        </div>

        {/* Section tabs — the PDF carries them all; the preview shows one. */}
        {sources.length > 1 && (
          <div className="px-4 pt-3 flex flex-wrap gap-1.5">
            {sources.map(s => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                  active === s.key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-muted border-line hover:border-primary/40'
                }`}
              >
                {s.label}
                <span className={`mr-1.5 px-1.5 py-0.5 rounded-full ${active === s.key ? 'bg-white/25' : 'bg-background'}`}>
                  {AR_NUM(tables[s.key]?.rows.length ?? 0)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto mt-3">
          <table className="w-full text-xs">
            <thead className="text-muted border-b border-line sticky top-0 z-10"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 60%)' }}>
              <tr>
                <th className="px-3 py-2.5 text-right font-semibold w-10">#</th>
                {current.columns.map((c, i) => (
                  <th key={i} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr><td colSpan={current.columns.length + 1} className="p-10 text-center text-muted">جارٍ التحميل...</td></tr>
              )}
              {!loading && current.rows.length === 0 && (
                <tr>
                  <td colSpan={current.columns.length + 1} className="p-10 text-center">
                    <TableIcon size={30} className="mx-auto text-muted/30 mb-2" />
                    <p className="text-muted text-sm">لا سجلات مطابقة</p>
                  </td>
                </tr>
              )}
              {/* Capped: a preview exists to confirm the selection is right, and
                  painting ten thousand rows to prove it would freeze the tab.
                  The export always carries every matching row. */}
              {current.rows.slice(0, 200).map((r, i) => (
                <tr key={i} className="hover:bg-background transition-colors">
                  <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
                  {r.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-ink max-w-[240px] truncate" title={cell}>
                      {cell || <span className="text-muted/40">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {current.rows.length > 200 && (
          <div className="px-4 py-2.5 border-t border-line text-[11px] text-muted text-center">
            تُعرض أول ٢٠٠ سطر — التصدير يشمل الـ {AR_NUM(current.rows.length)} كاملة.
          </div>
        )}
      </section>
    </div>
  );
}
