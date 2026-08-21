import { useEffect, useState, useMemo } from 'react';
import { db } from '../../lib/db.js';
import {
  REPORT_STATUS_LOOKUP, LOGISTICS_STATUS_LOOKUP, SEVERITY_MAP, SUPPORT_LOOKUP,
  MEAL_LABEL, MEAL_COLOR, HOLY_SITE_LABEL, HOLY_SITE_COLOR, HOLY_SITE_ICON,
  reportType,
} from '../../config/fieldRecords.js';
import ReportDrawer from '../../components/details/ReportDrawer.jsx';
import LogisticsDrawer from '../../components/details/LogisticsDrawer.jsx';
import MediaLightbox from '../../components/MediaLightbox.jsx';
import {
  SquaresFour as LayoutDashboard,
  Warning as AlertTriangle,
  Truck,
  ClipboardText as ClipboardList,
  Clock,
  X,
  CheckCircle as CheckCircle2,
  CaretDown as ChevronDown,
  Funnel as Filter,
  MagnifyingGlass as Search,
  User,
  Buildings as Building2,
  Pulse as Activity,
  ShieldCheck,
  ForkKnife as Utensils,
  Package,
  ChartBar,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import {
  computeStatusUpdate, TERMINAL_REPORT_STATUSES, TERMINAL_LOGISTICS_STATUSES,
} from '../../lib/statusTracking.js';
import { StatusTimerChip } from '../../components/StatusTimeline.jsx';
import { NATIONALITIES } from '../../config/nationalities.js';
import CenterNotesPanel from '../../components/CenterNotesPanel.jsx';
import {
  Panel, IconTile, QueueCard, ListRow, RowTitle, RowMeta, Pill, EmptyState,
} from '../../components/ui/index.jsx';

/* A season figure as it appears in the rail: a row, not a tile. Five tiles need
   a full-width band; five rows need a card. */
function RailFigure({ label, value, Icon, color, sub, onClick, last }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-start flex items-center gap-3 px-4 py-3 transition-colors
                  hover:bg-[rgb(var(--c-bg))] ${last ? '' : 'border-b border-line'}`}
    >
      <IconTile Icon={Icon} color={color} size="sm" />
      <span className="flex-1 min-w-0">
        <span className="block text-[12.5px] font-bold text-ink truncate">{label}</span>
        {sub && <span className="block text-[10.5px] font-medium text-muted mt-0.5 truncate">{sub}</span>}
      </span>
      <span className="text-[22px] font-extrabold tabular-nums leading-none shrink-0" style={{ color }}>
        {value ?? '—'}
      </span>
    </button>
  );
}

/* The vocabulary lives in config/fieldRecords — three copies of it had already
   drifted, so the same report wore one colour in a list and another in a modal. */
const STATUS = REPORT_STATUS_LOOKUP;
const LOGISTICS_STATUS = LOGISTICS_STATUS_LOOKUP;
const SEV = SEVERITY_MAP;
const SUPPORT = SUPPORT_LOOKUP;

/* Newly-arrived helpers */
const NEW_THRESHOLD_MS = 10 * 60 * 1000;
const isNewReport = r => {
  if (r.status && r.status !== 'pending') return false;
  const ts = r.timestamp?.toMillis?.() ?? 0;
  return ts > 0 && (Date.now() - ts) < NEW_THRESHOLD_MS;
};
const isNewLogistics = r => {
  if (r.status && r.status !== 'pending') return false;
  const ts = r.timestamp?.toMillis?.() ?? r.createdAt?.toMillis?.() ?? 0;
  return ts > 0 && (Date.now() - ts) < NEW_THRESHOLD_MS;
};

/* ─── Helpers ─── */
function timeAgo(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60)    return 'الآن';
    if (s < 3600)  return `${Math.floor(s / 60)}د`;
    if (s < 86400) return `${Math.floor(s / 3600)}س`;
    return `${Math.floor(s / 86400)} يوم`;
  } catch { return '—'; }
}

const getActivityCenter   = i => i.center || i.centerId || '—';
const getActivityObserver = i => i.observer || i.observerName || '—';
function getActivityScore(item) {
  if (item._col === 'meal') {
    const pct = parseFloat(item.percentage);
    return isNaN(pct) ? null : parseFloat((pct / 10).toFixed(1));
  }
  if (item.scoreOutOf10 != null) return Number(item.scoreOutOf10);
  return null;
}

/* The record number, set in the row as data rather than as another coloured
   chip. Tabular figures so a column of them aligns. */
function RecordNo({ children }) {
  return (
    <span className="text-[11px] font-bold tabular-nums text-muted/80 tracking-wide">#{children}</span>
  );
}

/* A new arrival is announced by one small dot, not by the whole row glowing.
   The dot keeps the pulse because that is the part the eye catches from across
   a room; the full-row glow was what made the register look cheap. */
function NewDot({ variant = 'red' }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
        variant === 'red' ? 'badge-pulse-red bg-red-500' : 'badge-pulse-blue bg-blue-500'
      }`}
    />
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [counts,            setCounts]            = useState({ reports: 0, evals: 0, logistics: 0, mina: 0, arafat: 0 });
  const [reports,           setReports]           = useState([]);
  const [pendingReports,    setPendingReports]    = useState(0);
  const [logisticsFeed,     setLogisticsFeed]     = useState([]);
  const [pendingLogistics,  setPendingLogistics]  = useState(0);
  const [activityFeed,      setActivityFeed]      = useState([]);
  const [selectedReport,    setSelectedReport]    = useState(null);
  const [selectedLogistics, setSelectedLogistics] = useState(null);
  const [lightbox,          setLightbox]          = useState(null);
  const [centerFilter,      setCenterFilter]      = useState('');
  const [searchQuery,       setSearchQuery]       = useState('');

  const handleDeleteReport = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا البلاغ؟')) return;
    await db.reports.delete(id);
    setSelectedReport(null);
  };
  const handleStatusChange = async (id, status) => {
    const current = reports.find(r => r.id === id) || selectedReport || {};
    const update  = computeStatusUpdate(current, status, TERMINAL_REPORT_STATUSES) || { status };
    await db.reports.update(id, update);
    setSelectedReport(prev => prev?.id === id ? { ...prev, ...update, status } : prev);
  };
  const handleLogisticsStatusChange = async (id, status) => {
    const current = logisticsFeed.find(i => i.id === id) || selectedLogistics || {};
    const update  = computeStatusUpdate(current, status, TERMINAL_LOGISTICS_STATUSES) || { status };
    await db.logistics_requests.update(id, update);
    setLogisticsFeed(prev => prev.map(i => i.id === id ? { ...i, ...update, status } : i));
    setSelectedLogistics(prev => prev?.id === id ? { ...prev, ...update, status } : prev);
  };
  const handleDeleteLogistics = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    await db.logistics_requests.delete(id);
    setSelectedLogistics(null);
  };
  const handleSaveReportNotes = async (id, adminNotes) => {
    await db.reports.update(id, { adminNotes });
    setSelectedReport(prev => prev?.id === id ? { ...prev, adminNotes } : prev);
  };
  const handleSaveLogisticsNotes = async (id, adminNotes) => {
    await db.logistics_requests.update(id, { adminNotes });
    setSelectedLogistics(prev => prev?.id === id ? { ...prev, adminNotes } : prev);
  };

  useEffect(() => {
    const byTime = arr => [...arr].sort((a, b) =>
      (b.timestamp?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0) -
      (a.timestamp?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
    );

    const unsubs = [
      db.reports.subscribe(items => {
        const sorted = byTime(items);
        setCounts(p => ({ ...p, reports: sorted.length }));
        setReports(sorted);
        setPendingReports(sorted.filter(i => (i.status || 'pending') === 'pending').length);
      }),
      db.logistics_requests.subscribe(items => {
        const sorted = byTime(items);
        setCounts(p => ({ ...p, logistics: sorted.length }));
        setLogisticsFeed(sorted);
        setPendingLogistics(sorted.filter(i => (i.status || 'pending') === 'pending').length);
      }),
      db.meal_evaluations.subscribe(items => {
        const tagged = items.map(i => ({ ...i, _col: 'meal' }));
        setCounts(p => ({ ...p, evals: tagged.length }));
        setActivityFeed(p => byTime([...p.filter(i => i._col !== 'meal'), ...tagged]));
      }),
      db.mina_readiness.subscribe(items => {
        const tagged = items.map(i => ({ ...i, _col: 'mina' }));
        setCounts(p => ({ ...p, mina: tagged.length }));
        setActivityFeed(p => byTime([...p.filter(i => i._col !== 'mina'), ...tagged]));
      }),
      db.arafat_readiness.subscribe(items => {
        const tagged = items.map(i => ({ ...i, _col: 'arafat' }));
        setCounts(p => ({ ...p, arafat: tagged.length }));
        setActivityFeed(p => byTime([...p.filter(i => i._col !== 'arafat'), ...tagged]));
      }),
    ];
    return () => unsubs.forEach(u => u?.());
  }, []);

  const centerOptions = useMemo(() => {
    const set = new Set();
    activityFeed.forEach(i => {
      const c = getActivityCenter(i);
      if (c && c !== '—') set.add(c);
    });
    return [...set].sort((a, b) => {
      const na = parseInt(a.replace(/[^0-9]/g, '')) || 0;
      const nb = parseInt(b.replace(/[^0-9]/g, '')) || 0;
      return na - nb;
    });
  }, [activityFeed]);

  const filteredActivity = useMemo(() =>
    centerFilter
      ? activityFeed.filter(i => getActivityCenter(i) === centerFilter)
      : activityFeed,
    [activityFeed, centerFilter]
  );

  const STATS = [
    { label: 'البلاغات الميدانية', value: counts.reports,   Icon: AlertTriangle, color: '#DC2626',               sub: 'بلاغات نشطة',   nav: '/admin/reports'   },
    { label: 'تقييم الوجبات',      value: counts.evals,     Icon: Utensils,      color: '#B45309',               sub: 'جودة الوجبات',  nav: '/admin/phases'    },
    { label: 'طلبات الإسناد',      value: counts.logistics, Icon: Truck,         color: '#3D6795',               sub: 'طلبات لوجستية', nav: '/admin/logistics' },
    { label: 'جاهزية منى',         value: counts.mina,      Icon: ShieldCheck,   color: '#5E9070',               sub: 'تقييمات منى',   nav: '/admin/analytics' },
    { label: 'جاهزية عرفة',        value: counts.arafat,    Icon: ShieldCheck,   color: 'rgb(var(--c-primary))', sub: 'تقييمات عرفة',  nav: '/admin/analytics' },
  ];

  const q = searchQuery.trim().toLowerCase();

  return (
    <div className="pb-8" dir="rtl">

      {/* ── Page head ──
          A slim row on the canvas rather than a second navy band: the topbar
          above is already the dark frame, and stacking another one pushed every
          figure below the fold. Title leads, search sits beside it. */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <IconTile Icon={LayoutDashboard} size="lg" />
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold text-ink leading-tight">نظرة عامة</h1>
            <p className="text-[12px] font-medium text-muted mt-0.5">حالة الموسم لحظة بلحظة</p>
          </div>
        </div>

        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search size={15} weight="bold" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث برقم البلاغ، المركز، أو المراقب…"
            className="w-full pr-10 pl-4 py-2.5 rounded-[11px] border border-line bg-white text-[12.5px] font-medium text-ink
                       placeholder:text-muted/70 placeholder:font-normal transition-shadow
                       focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.10)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center
                         text-muted hover:text-ink hover:bg-[rgb(var(--c-bg))] transition-colors"
            >
              <X size={13} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* ── Two tracks ──
          The registers an admin reads down the wide column; the figures and the
          feed they glance at sit in a rail that follows the scroll. One long
          column meant the activity feed was four screens below the queues. */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">

        {/* ── Main track ── */}
        <div className="xl:col-span-8 space-y-4 min-w-0">

        {/* The two queues an operations lead opens this page to check. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <QueueCard
            n={pendingReports}
            label="بلاغ ينتظر المعالجة"
            done="لا بلاغات معلّقة"
            Icon={AlertTriangle}
            DoneIcon={CheckCircle2}
            color="#DC2626"
            onClick={() => navigate('/admin/reports')}
          />
          <QueueCard
            n={pendingLogistics}
            label="طلب إسناد ينتظر الاعتماد"
            done="لا طلبات معلّقة"
            Icon={Truck}
            DoneIcon={CheckCircle2}
            color="#B45309"
            onClick={() => navigate('/admin/logistics')}
          />
        </div>

        {/* ── Field reports ── */}
        <Panel
          Icon={AlertTriangle}
          color="#DC2626"
          title="البلاغات الميدانية"
          subtitle={`${counts.reports} بلاغ${pendingReports > 0 ? ` · ${pendingReports} قيد الانتظار` : ''}`}
          action={() => navigate('/admin/reports')}
        >
          {(() => {
            const displayed = q
              ? reports.filter(r =>
                  (r.reportNumber || '').toString().toLowerCase().includes(q) ||
                  (r.center        || '').toLowerCase().includes(q) ||
                  (r.observer      || '').toLowerCase().includes(q))
              : reports.slice(0, 6);

            if (displayed.length === 0) return (
              <EmptyState
                Icon={q ? Search : AlertTriangle}
                title={q ? 'لا توجد نتائج' : 'لا توجد بلاغات بعد'}
                hint={q ? 'جرّب رقم بلاغ أو اسم مركز آخر' : undefined}
              />
            );

            return displayed.map((r, idx) => {
              const rt    = reportType(r);
              const sv    = SEV[r.severity];
              const sb    = STATUS[r.status] || STATUS.pending;
              const SIcon = sb.Icon;
              const isNew = isNewReport(r);
              const HSIcon = r.holySite ? HOLY_SITE_ICON[r.holySite] : null;

              return (
                <ListRow
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  rail={rt.color}
                  flagged={isNew}
                  last={idx === displayed.length - 1}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isNew && <NewDot variant="red" />}
                      <RowTitle>{rt.label}</RowTitle>
                      {r.reportNumber && <RecordNo>{r.reportNumber}</RecordNo>}
                      {sv && <Pill color={sv.bar}>{sv.label}</Pill>}
                      {r.mealType && MEAL_LABEL[r.mealType] && (
                        <Pill color={MEAL_COLOR[r.mealType] || 'rgb(var(--c-primary))'}>
                          {MEAL_LABEL[r.mealType]}
                        </Pill>
                      )}
                      {HSIcon && (
                        <Pill color={HOLY_SITE_COLOR[r.holySite]} Icon={HSIcon}>
                          {HOLY_SITE_LABEL[r.holySite]}
                        </Pill>
                      )}
                    </div>

                    <RowMeta items={[
                      { Icon: User,      value: r.observer },
                      { Icon: Building2, value: r.center },
                    ]} />

                    <div className="mt-2">
                      <StatusTimerChip doc={r} terminalStatuses={TERMINAL_REPORT_STATUSES} statusMeta={STATUS} compact />
                    </div>
                    <CenterNotesPanel centerId={r.center} variant="compact" />
                  </div>

                  <Pill color={sb.text} Icon={SIcon} className="shrink-0">{sb.label}</Pill>
                </ListRow>
              );
            });
          })()}
        </Panel>

        {/* ── Logistics requests ── */}
        <Panel
          Icon={Truck}
          color="#3D6795"
          title="طلبات الإسناد"
          subtitle={`${counts.logistics} طلب${pendingLogistics > 0 ? ` · ${pendingLogistics} قيد الانتظار` : ''}`}
          action={() => navigate('/admin/logistics')}
        >
          {(() => {
            const displayed = q
              ? logisticsFeed.filter(r =>
                  (r.requestNumber || '').toString().toLowerCase().includes(q) ||
                  (r.reportNumber  || '').toString().toLowerCase().includes(q) ||
                  (r.center        || '').toLowerCase().includes(q) ||
                  (r.observer      || '').toLowerCase().includes(q))
              : logisticsFeed.slice(0, 6);

            if (displayed.length === 0) return (
              <EmptyState
                Icon={q ? Search : Package}
                title={q ? 'لا توجد نتائج' : 'لا توجد طلبات إسناد بعد'}
                hint={q ? 'جرّب رقم طلب أو اسم مركز آخر' : undefined}
              />
            );

            return displayed.map((item, idx) => {
              const sb    = LOGISTICS_STATUS[item.status] || LOGISTICS_STATUS.pending;
              const SIcon = sb.Icon;
              const st    = SUPPORT[item.supportType] || SUPPORT.internal;
              const SupportIcon = st.Icon;
              const isNew = isNewLogistics(item);
              const HSIcon = item.holySite ? HOLY_SITE_ICON[item.holySite] : null;

              return (
                <ListRow
                  key={item.id}
                  onClick={() => setSelectedLogistics(item)}
                  rail={st.color}
                  flagged={isNew}
                  last={idx === displayed.length - 1}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isNew && <NewDot variant="blue" />}
                      <RowTitle>طلب إسناد</RowTitle>
                      {item.requestNumber && <RecordNo>{item.requestNumber}</RecordNo>}
                      <Pill color={st.color} Icon={SupportIcon}>{st.short}</Pill>
                      {HSIcon && (
                        <Pill color={HOLY_SITE_COLOR[item.holySite]} Icon={HSIcon}>
                          {HOLY_SITE_LABEL[item.holySite]}
                        </Pill>
                      )}
                      {item.reportNumber && (
                        <Pill color="#B45309" Icon={AlertTriangle}>بلاغ #{item.reportNumber}</Pill>
                      )}
                    </div>

                    <RowMeta items={[
                      { Icon: User,      value: item.observer },
                      { Icon: Building2, value: item.center },
                    ]} />

                    <div className="mt-2">
                      <StatusTimerChip doc={item} terminalStatuses={TERMINAL_LOGISTICS_STATUSES} statusMeta={LOGISTICS_STATUS} compact />
                    </div>
                    <CenterNotesPanel centerId={item.center} variant="compact" />
                  </div>

                  <Pill color={sb.text} Icon={SIcon} className="shrink-0">{sb.label}</Pill>
                </ListRow>
              );
            });
          })()}
        </Panel>

        {/* Today's menu — coverage per nationality */}
        <MenuOverview navigate={navigate} />
        </div>

        {/* ── Rail ──
            Figures and the live feed. Sticky, because these are the things you
            keep an eye on while reading the registers beside them. */}
        <div className="xl:col-span-4 space-y-4 min-w-0 xl:sticky xl:top-4">

        {/* Season figures — a compact register rather than five wide tiles, so
            the whole set fits the rail without pushing the feed off-screen. */}
        <Panel
          Icon={ChartBar}
          color="rgb(var(--c-accent))"
          title="أرقام الموسم"
          subtitle="إجماليات حتى اللحظة"
        >
          {STATS.map((c, i) => (
            <RailFigure key={c.label} {...c} last={i === STATS.length - 1}
              onClick={() => navigate(c.nav)} />
          ))}
        </Panel>

        {/* ── Field activities ── */}
        <Panel
        Icon={ClipboardList}
        color="rgb(var(--c-primary))"
        title="النشاطات الميدانية"
        subtitle="تقييمات الوجبات وجاهزية المشاعر"
        right={centerOptions.length > 0 && (
          <div className="relative">
            <Filter size={11} weight="bold" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <select
              value={centerFilter}
              onChange={e => setCenterFilter(e.target.value)}
              className="appearance-none text-[11.5px] font-semibold border border-line rounded-lg ps-7 pe-7 py-1.5
                         bg-white text-ink outline-none cursor-pointer transition-colors
                         hover:border-primary focus:border-primary"
            >
              <option value="">جميع المراكز</option>
              {centerOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={11} weight="bold" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        )}
      >
        {filteredActivity.length === 0 ? (
          <EmptyState
            Icon={Activity}
            title={centerFilter ? `لا توجد نشاطات لـ ${centerFilter}` : 'لا توجد نشاطات بعد'}
          />
        ) : (
          filteredActivity.slice(0, 8).map((item, i) => {
            const isMina = item._col === 'mina';
            const isMeal = item._col === 'meal';
            const score  = getActivityScore(item);
            const scoreColor = score == null ? null
              : score >= 8 ? '#15803D'
              : score >= 5 ? '#B45309'
              :              '#DC2626';

            const meta = isMeal
              ? { Icon: Utensils,    color: '#B45309',               label: 'تقييم جودة الوجبات', nav: '/admin/phases'    }
              : isMina
              ? { Icon: ShieldCheck, color: '#5E9070',               label: 'جاهزية مشعر منى',    nav: '/admin/analytics' }
              : { Icon: ShieldCheck, color: 'rgb(var(--c-primary))', label: 'جاهزية مشعر عرفة',   nav: '/admin/analytics' };

            return (
              <ListRow
                key={`${item._col}-${item.id}`}
                onClick={() => navigate(meta.nav)}
                rail={meta.color}
                last={i === Math.min(filteredActivity.length, 8) - 1}
              >
                <div className="flex-1 min-w-0">
                  <RowTitle>{meta.label}</RowTitle>
                  <RowMeta items={[
                    { Icon: User,      value: getActivityObserver(item) },
                    { Icon: Building2, value: getActivityCenter(item) },
                    { Icon: Clock,     value: timeAgo(item.timestamp) },
                  ]} />
                </div>

                {score != null && (
                  <span className="shrink-0 text-end">
                    <span className="block text-[19px] font-extrabold tabular-nums leading-none" style={{ color: scoreColor }}>
                      {score.toFixed(1)}
                    </span>
                    <span className="block text-[10px] font-medium text-muted mt-1">من ١٠</span>
                  </span>
                )}
              </ListRow>
            );
          })
        )}
        </Panel>
        </div>
      </div>

      {lightbox && (
        <MediaLightbox src={lightbox.src} type={lightbox.type} onClose={() => setLightbox(null)} />
      )}

      <ReportDrawer
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onStatus={handleStatusChange}
        onEdit={() => navigate(`/admin/reports`)}
        onDelete={() => { handleDeleteReport(selectedReport.id); setSelectedReport(null); }}
        onMedia={(m) => setLightbox(m)}
        onSaveNotes={handleSaveReportNotes}
      />

      <LogisticsDrawer
        request={selectedLogistics}
        onClose={() => setSelectedLogistics(null)}
        onStatus={handleLogisticsStatusChange}
        onEdit={() => navigate(`/admin/logistics`)}
        onDelete={() => { handleDeleteLogistics(selectedLogistics.id); setSelectedLogistics(null); }}
        onSaveNotes={handleSaveLogisticsNotes}
      />
    </div>
  );
}

/* The nationality strip. The flag is the only colour a tile needs, so the
   gradient plate it used to sit on is gone — a neutral square reads it better
   anyway. */
function MenuOverview({ navigate }) {
  return (
    <Panel
      Icon={Utensils}
      color="#B45309"
      title="منيو الجنسيات"
      subtitle="تغطية المنيو حسب الجنسية ليوم ذي الحجة والوجبة"
      action={() => navigate('/admin/menu')}
      actionLabel="إدارة المنيو"
    >
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {NATIONALITIES.map(s => (
          <button
            key={s.key}
            onClick={() => navigate('/admin/menu')}
            className="group text-start bg-white rounded-[12px] border border-line p-3 flex items-center gap-3
                       transition-all duration-200 hover:border-[rgb(var(--c-primary)/0.35)]
                       hover:shadow-[0_4px_14px_-6px_rgb(var(--c-ink)/0.20)]"
          >
            <span className="w-9 h-9 rounded-[9px] flex items-center justify-center text-lg shrink-0 bg-[rgb(var(--c-bg))] border border-line">
              {s.flag}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-ink truncate">{s.label}</span>
              <span className="block text-[10.5px] font-medium text-muted mt-0.5">{s.centers.length} مركز</span>
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
