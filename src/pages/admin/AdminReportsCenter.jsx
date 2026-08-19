import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db.js';
import {
  REPORT_SOURCES, SOURCE_BY_KEY, SOURCE_GROUPS, DHU_DAYS,
} from '../../config/reportSources.js';
import {
  AR_NUM, buildLookups, buildTable, describeFilters,
  stashReportRequest, pruneReportRequests,
} from '../../lib/reportQuery.js';
import PageHeader from '../../components/PageHeader.jsx';
import {
  FileArrowDown, ArrowSquareOut, MagnifyingGlass as Search, X, Warning,
  Columns, Funnel, Table as TableIcon, CalendarBlank, ListChecks,
  ProjectorScreenChart, Siren, Stack as Boxes, ForkKnife, Gauge,
  Buildings, MapPinArea, FileText, UsersThree, FlowArrow, CheckSquare,
  Eye, ShieldCheck,
} from '@phosphor-icons/react';

/* A face per section. A grid of identical rectangles is a list you read; a
   grid of marked cards is one you recognise. */
const SOURCE_ICON = {
  reports: Siren, logistics: Boxes, meals: ForkKnife, mina: Gauge, arafat: Gauge,
  caterers: Buildings, centers: MapPinArea, forms: FileText,
  observers: Eye, supervisors: ShieldCheck, staffUsers: UsersThree,
  phases: FlowArrow, taskCompletions: CheckSquare,
};

const inputCls =
  'w-full px-3 py-2 border border-line rounded-xl text-sm text-ink outline-none focus:border-primary transition placeholder-muted/40 bg-white';

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-medium text-muted mb-1">{label}</label>
    {children}
  </div>
);

const StepNo = ({ n }) => (
  <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
    style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
    {n}
  </span>
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
    from: '', to: '', dhuDay: '', center: '', caterer: '', status: '', season: '',
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
    const tables = [...new Set(missing.map(k => SOURCE_BY_KEY[k].table))];
    Promise.all(tables.map(t => db[t].list().then(rows => [t, rows])))
      .then(pairs => {
        const byTable = Object.fromEntries(pairs);
        setData(d => ({
          ...d,
          ...Object.fromEntries(missing.map(k => [k, byTable[SOURCE_BY_KEY[k].table]])),
        }));
      })
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

  /* Two destinations, one selection. The document is for reading and filing;
     the deck is for standing in front of people. Both open in their own tab
     and carry every way of taking them away — print to PDF, download Excel —
     next to what they export. */
  const openIn = (route) => {
    if (!totalRows) return setError('لا توجد سجلات مطابقة — عدّل الفلاتر أولاً.');
    const id = stashReportRequest({
      title: docTitle, picked, cols, filters, search, detailed, photos,
    });
    pruneReportRequests(id);
    window.open(`${route}?k=${id}`, '_blank');
  };
  const openReport = () => openIn('/admin/reports-view');
  const openDeck   = () => openIn('/admin/reports-deck');

  /* The filters actually in force, as removable tokens. A row of empty selects
     does not tell you what is narrowing the result; a row of chips does. */
  const activeFilters = [
    filters.from    && { key: 'from',    label: `من ${filters.from}` },
    filters.to      && { key: 'to',      label: `إلى ${filters.to}` },
    filters.dhuDay  && { key: 'dhuDay',  label: `${AR_NUM(filters.dhuDay)} ذو الحجة` },
    filters.season  && { key: 'season',  label: seasons.find(s => s.id === filters.season)?.name },
    filters.center  && { key: 'center',  label: filters.center },
    filters.caterer && { key: 'caterer', label: filters.caterer },
    filters.status  && { key: 'status',  label: source.statuses?.[filters.status] ?? filters.status },
    search.trim()   && { key: '__search', label: `بحث: ${search.trim()}` },
  ].filter(Boolean);

  const clearFilter = (key) => {
    if (key === '__search') return setSearch('');
    setFilters(f => ({ ...f, [key]: '' }));
  };
  const clearAll = () => {
    setSearch('');
    setFilters({ from: '', to: '', dhuDay: '', center: '', caterer: '', status: '', role: '', season: '' });
  };

  /* A readiness inspection is a record, not a row: in detailed mode each centre
     gets a page carrying its data, every criterion with the answer given, the
     inspector's notes and the photographs taken on site. */
  const canDossier = !!source.criteriaSections;

  const anyHas = (f) => sources.some(s => has(s, f));

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* The two things the screen exists for used to sit at the bottom, under
          four sections of form, so they were the last things you found. */}
      <PageHeader
        kicker="مركز التقارير"
        Icon={FileArrowDown}
        title={docTitle}
        subtitle={filterSummary}
        stats={[
          { value: AR_NUM(picked.length), label: 'قسم' },
          { value: AR_NUM(totalRows), label: 'سجل', tone: 'gold' },
        ]}
        heroActions={
          <>
            <button onClick={openReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black transition hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-600)))',
                color: 'rgb(var(--c-primary-900))',
                boxShadow: '0 4px 16px rgb(var(--c-accent)/0.35), inset 0 1px 0 rgb(255 255 255 / 0.28)',
              }}>
              <ArrowSquareOut size={16} weight="bold" /> عرض التقرير
            </button>
            <button onClick={openDeck}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-black text-white border border-white/25 hover:border-white/50 hover:bg-white/10 transition">
              <ProjectorScreenChart size={16} weight="bold" /> عرض تقديمي
            </button>
          </>
        }
      />

      {/* ── 1. Sections ── */}
      <section className="bg-white rounded-2xl border border-line p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <StepNo n="١" />
            <h2 className="text-sm font-black text-ink">الأقسام</h2>
            <span className="text-[11px] font-bold text-accent-600 bg-accent/12 px-2 py-0.5 rounded-full">
              {AR_NUM(picked.length)} مختار
            </span>
          </div>
        </div>

        {SOURCE_GROUPS.map(group => (
          <div key={group}>
            <p className="text-[10px] font-black text-muted/70 tracking-widest mb-2">{group}</p>
            {/* Cards, not pills: an icon and a count make a section
                recognisable at a glance, and the row of identical rounded
                rectangles gave neither. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {REPORT_SOURCES.filter(s => s.group === group).map(s => {
                const on = picked.includes(s.key);
                const Icon = SOURCE_ICON[s.key] || TableIcon;
                const n = tables[s.key]?.rows.length;
                return (
                  <button
                    key={s.key}
                    onClick={() => togglePick(s.key)}
                    className={`group flex items-center gap-2.5 p-2.5 rounded-xl border text-right transition-all ${
                      on
                        ? 'border-primary bg-primary/[0.06] shadow-[0_3px_12px_rgb(var(--c-primary)/0.14)]'
                        : 'border-line bg-white hover:border-primary/40 hover:bg-background'
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      on ? 'text-white' : 'bg-background text-muted group-hover:text-primary'
                    }`}
                      style={on ? { background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' } : undefined}>
                      <Icon size={17} weight={on ? 'fill' : 'regular'} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[12px] font-black truncate ${on ? 'text-primary' : 'text-ink'}`}>
                        {s.label}
                      </span>
                      <span className="block text-[10px] font-bold text-muted mt-0.5">
                        {on && n != null ? `${AR_NUM(n)} سجل` : s.group}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── 2. Filters ── */}
      <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <StepNo n="٢" />
            <h2 className="text-sm font-black text-ink">التصفية</h2>
          </div>
          {activeFilters.length > 0 && (
            <button onClick={clearAll}
              className="text-[11px] font-bold text-muted hover:text-red-600 transition-colors">
              مسح الكل
            </button>
          )}
        </div>

        {/* What is actually narrowing the result, as tokens you can pull off
            one at a time. A row of empty selects never said this. */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map(f => (
              <span key={f.key}
                className="inline-flex items-center gap-1.5 pr-2.5 pl-1.5 py-1 rounded-full text-[11px] font-bold bg-accent/12 text-accent-600 border border-accent/25">
                {f.label}
                <button onClick={() => clearFilter(f.key)}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-accent/25 transition-colors"
                  aria-label={`إزالة ${f.label}`}>
                  <X size={9} weight="bold" />
                </button>
              </span>
            ))}
          </div>
        )}

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
          {/* The role dropdown is gone: each user section now IS a role, so
              the control could only ever have contradicted the section it sat
              under. */}
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
              <StepNo n="٣" />
              <h2 className="text-sm font-black text-ink">
                أعمدة «{source.label}»
              </h2>
              <span className="text-[11px] font-bold text-accent-600 bg-accent/12 px-2 py-0.5 rounded-full">
                {AR_NUM((cols[source.key] || []).length)}
              </span>
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
          <div className="flex items-center gap-2">
            <StepNo n={detailed ? '٣' : '٤'} />
            <h2 className="text-sm font-black text-ink">المعاينة</h2>
            <span className="text-[11px] font-bold text-muted flex items-center gap-1.5">
              <CalendarBlank size={11} /> {filterSummary}
            </span>
          </div>
          {canDossier && detailed && (
            <label className="flex items-center gap-2 text-[11px] font-bold text-muted cursor-pointer">
              <input type="checkbox" checked={photos} onChange={e => setPhotos(e.target.checked)}
                className="accent-primary w-3.5 h-3.5" />
              تضمين الصور الميدانية
            </label>
          )}
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

              </section>
    </div>
  );
}
