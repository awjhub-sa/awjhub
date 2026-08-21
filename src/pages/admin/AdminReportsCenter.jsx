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
import { seasonLabel } from '../../lib/hijri.js';
import DataTable from '../../components/DataTable.jsx';
import { Surface, IconTile, Pill, EmptyState } from '../../components/ui/index.jsx';
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

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/* Two colours carry the page: navy for what is being reported on, gold for the
   controls that narrow it. */
const NAVY = 'rgb(var(--c-primary))';
const GOLD = 'rgb(var(--c-accent-600))';
const WARN = '#B45309';

const inputCls =
  'w-full px-3 py-2.5 border border-line rounded-[10px] text-[13px] font-medium text-ink outline-none focus:border-primary transition-colors placeholder-muted/50 bg-white';

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[11.5px] font-semibold text-muted mb-1.5">{label}</label>
    {children}
  </div>
);

/* The step badge doubles as the section's tile — a numbered square beside a
   pictogram square would say the same thing twice. */
const StepNo = ({ n, color = NAVY }) => (
  <span className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[14px] font-extrabold shrink-0 border tabular-nums"
    style={{ background: tint(color, 9), borderColor: tint(color, 22), color }}>
    {n}
  </span>
);

/* Every section wears the same tinted band, so the four steps read as one form
   rather than four unrelated cards. */
const SectionHead = ({ n, color = NAVY, title, children }) => (
  <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b flex-wrap"
    style={{ background: tint(color, 12), borderColor: tint(color, 28) }}>
    <div className="flex items-center gap-3 min-w-0">
      <StepNo n={n} color={color} />
      <h2 className="text-[14px] font-bold truncate leading-tight" style={{ color }}>{title}</h2>
    </div>
    <div className="flex items-center gap-2 shrink-0 flex-wrap">{children}</div>
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
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-[12.5px] font-bold text-white
                         bg-primary border border-primary hover:brightness-110 transition">
              <ArrowSquareOut size={15} weight="bold" /> عرض التقرير
            </button>
            <button onClick={openDeck}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-[12.5px] font-bold text-ink
                         bg-white border border-line hover:bg-[rgb(var(--c-bg))] transition">
              <ProjectorScreenChart size={15} weight="bold" /> عرض تقديمي
            </button>
          </>
        }
      />

      {/* ── 1. Sections ── */}
      <Surface className="overflow-hidden">
        <SectionHead n="١" title="الأقسام">
          <Pill color={GOLD}>{AR_NUM(picked.length)} مختار</Pill>
        </SectionHead>

        <div className="p-4 sm:p-5 space-y-4">
          {SOURCE_GROUPS.map(group => (
            <div key={group}>
              <p className="text-[10.5px] font-bold text-muted/80 tracking-[0.16em] mb-2">{group}</p>
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
                      className={`group relative flex items-center gap-2.5 p-2.5 rounded-[11px] border text-start overflow-hidden transition-colors ${
                        on ? '' : 'border-line bg-white hover:bg-[rgb(var(--c-bg))]'
                      }`}
                      style={on ? { background: tint(NAVY, 12), borderColor: tint(NAVY, 30) } : undefined}
                    >
                      {on && <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: NAVY }} />}
                      {on ? (
                        <IconTile Icon={Icon} color={NAVY} size="sm" />
                      ) : (
                        <span className="w-8 h-8 rounded-lg border border-line bg-[rgb(var(--c-bg))] flex items-center justify-center shrink-0 text-muted group-hover:text-primary transition-colors">
                          <Icon size={15} weight="duotone" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12px] font-bold truncate ${on ? 'text-primary' : 'text-ink'}`}>
                          {s.label}
                        </span>
                        <span className="block text-[10.5px] font-medium text-muted mt-0.5 truncate">
                          {on && n != null ? `${AR_NUM(n)} سجل` : s.group}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Surface>

      {/* ── 2. Filters ── */}
      <Surface className="overflow-hidden">
        <SectionHead n="٢" color={GOLD} title="التصفية">
          {activeFilters.length > 0 && (
            <button onClick={clearAll}
              className="text-[11.5px] font-bold text-muted hover:text-red-600 transition-colors px-2 py-1 rounded-lg">
              مسح الكل
            </button>
          )}
        </SectionHead>

        <div className="p-4 sm:p-5 space-y-3.5">
        {/* What is actually narrowing the result, as tokens you can pull off
            one at a time. A row of empty selects never said this. */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map(f => (
              <span key={f.key}
                className="inline-flex items-center gap-1.5 ps-2.5 pe-1.5 py-1 rounded-md text-[11px] font-bold border"
                style={{ background: tint(GOLD, 12), borderColor: tint(GOLD, 28), color: GOLD }}>
                {f.label}
                <button onClick={() => clearFilter(f.key)}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/70 transition-colors"
                  aria-label={`إزالة ${f.label}`}>
                  <X size={10} weight="bold" />
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
                  className={`min-w-[44px] px-3 py-1.5 rounded-[10px] text-[12px] font-bold border transition-colors tabular-nums ${
                    filters.dhuDay === v
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-ink border-line hover:bg-[rgb(var(--c-bg))]'
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
                {seasons.map(s => <option key={s.id} value={s.id}>{seasonLabel(s)}</option>)}
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
              <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                <Search size={14} className="text-muted/70" weight="bold" />
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="أي نص داخل السجل" className={`${inputCls} ps-9`} />
            </div>
          </Field>
        </div>

        {sources.some(s => s.questions?.length) && (
          <label className="flex items-start gap-2.5 px-3.5 py-3 rounded-[11px] border cursor-pointer transition-colors"
            style={{ background: tint(GOLD, 12), borderColor: tint(GOLD, 28) }}>
            <input type="checkbox" checked={detailed}
              onChange={e => setDetailed(e.target.checked)}
              className="accent-primary w-4 h-4 mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="text-[12.5px] font-bold flex items-center gap-1.5" style={{ color: GOLD }}>
                <ListChecks size={13} weight="bold" className="shrink-0" />
                {sources.some(s => s.criteriaSections)
                  ? 'محضر مفصّل — صفحة لكل مركز'
                  : 'عرض مفصّل — إجابة كل معيار'}
              </span>
              <span className="block text-[11.5px] font-medium text-muted mt-1 leading-relaxed">
                {sources.some(s => s.criteriaSections)
                  ? 'صفحة كاملة لكل مركز: بياناته وتاريخه وإجابة كل معيار وصوره وخانات التوقيع.'
                  : 'يفكّ كل تقييم إلى سطر لكل سؤال. الدرجة وحدها لا تقول أي معيار سقط.'}
              </span>
            </span>
          </label>
        )}
        </div>
      </Surface>

      {/* ── 3. Columns ── */}
      {!detailed && (
        <Surface className="overflow-hidden">
          <SectionHead n="٣" color={GOLD} title={`أعمدة «${source.label}»`}>
            <Pill color={GOLD} className="tabular-nums">{AR_NUM((cols[source.key] || []).length)}</Pill>
            <button onClick={() => setCols(c => ({ ...c, [source.key]: source.columns.map(x => x.key) }))}
              className="px-2.5 py-1 rounded-[10px] border border-line bg-white text-[11.5px] font-bold text-muted hover:text-primary transition-colors">
              الكل
            </button>
            <button onClick={() => setCols(c => ({ ...c, [source.key]: source.defaultColumns }))}
              className="px-2.5 py-1 rounded-[10px] border border-line bg-white text-[11.5px] font-bold text-muted hover:text-primary transition-colors">
              الافتراضي
            </button>
          </SectionHead>

          <div className="p-4 sm:p-5 flex flex-wrap gap-1.5">
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
                  className={`px-2.5 py-1.5 rounded-[10px] text-[11.5px] font-bold border transition-colors ${
                    on ? '' : 'bg-white border-line text-muted hover:bg-[rgb(var(--c-bg))]'
                  }`}
                  style={on ? { background: tint(GOLD, 12), borderColor: tint(GOLD, 30), color: GOLD } : undefined}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </Surface>
      )}

      {error && (
        <div className="rounded-[11px] border px-3.5 py-3 text-[12.5px] font-medium flex items-start gap-2.5"
          style={{ background: tint(WARN, 12), borderColor: tint(WARN, 28), color: WARN }}>
          <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"><X size={14} weight="bold" /></button>
        </div>
      )}

      {/* ── 4. Preview + export ── */}
      <Surface className="overflow-hidden">
        <SectionHead n={detailed ? '٣' : '٤'} title="المعاينة">
          <span className="text-[11.5px] font-medium text-muted flex items-center gap-1.5">
            <CalendarBlank size={12} weight="bold" className="text-muted/60 shrink-0" /> {filterSummary}
          </span>
          {canDossier && detailed && (
            <label className="flex items-center gap-2 text-[11.5px] font-bold text-muted cursor-pointer bg-white border border-line rounded-[10px] px-2.5 py-1.5">
              <input type="checkbox" checked={photos} onChange={e => setPhotos(e.target.checked)}
                className="accent-primary w-3.5 h-3.5" />
              تضمين الصور الميدانية
            </label>
          )}
        </SectionHead>

        {/* Section tabs — the PDF carries them all; the preview shows one. */}
        {sources.length > 1 && (
          <div className="px-4 sm:px-5 pt-3.5 flex flex-wrap gap-1.5">
            {sources.map(s => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`px-3 py-1.5 rounded-[10px] text-[11.5px] font-bold border transition-colors ${
                  active === s.key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-muted border-line hover:bg-[rgb(var(--c-bg))]'
                }`}
              >
                {s.label}
                <span className={`ms-1.5 px-1.5 py-0.5 rounded-md tabular-nums ${active === s.key ? 'bg-white/25' : 'bg-[rgb(var(--c-bg))]'}`}>
                  {AR_NUM(tables[s.key]?.rows.length ?? 0)}
                </span>
              </button>
            ))}
          </div>
        )}

        <DataTable className="max-h-[520px] overflow-y-auto mt-3">
          <table className="w-full text-[12px]">
            <thead className="text-muted border-b border-line sticky top-0 z-10 bg-[rgb(var(--c-bg))]">
              <tr>
                <th className="px-3 py-2.5 text-start font-bold text-[11px] w-10">#</th>
                {current.columns.map((c, i) => (
                  <th key={i} className="px-3 py-2.5 text-start font-bold text-[11px] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr><td colSpan={current.columns.length + 1} className="p-10 text-center text-[12.5px] font-semibold text-muted">جارٍ التحميل...</td></tr>
              )}
              {!loading && current.rows.length === 0 && (
                <tr>
                  <td colSpan={current.columns.length + 1}>
                    <EmptyState Icon={TableIcon} title="لا سجلات مطابقة" />
                  </td>
                </tr>
              )}
              {/* Capped: a preview exists to confirm the selection is right, and
                  painting ten thousand rows to prove it would freeze the tab.
                  The export always carries every matching row. */}
              {current.rows.slice(0, 200).map((r, i) => (
                <tr key={i} className="hover:bg-[rgb(var(--c-bg))] transition-colors">
                  <td className="px-3 py-2.5 text-muted tabular-nums">{i + 1}</td>
                  {r.map((cell, j) => (
                    <td key={j} className="px-3 py-2.5 text-ink/85 font-medium max-w-[240px] truncate" title={cell}>
                      {cell || <span className="text-muted/40">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </Surface>
    </div>
  );
}
