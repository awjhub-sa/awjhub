import { useEffect, useState, useMemo } from 'react';
import { db } from '../../lib/db.js';
import PageHeader from '../../components/PageHeader.jsx';
import {
  REPORT_STATUS_LOOKUP, LOGISTICS_STATUS_LOOKUP, SEVERITY_MAP, SUPPORT_LOOKUP,
  MEAL_LABEL, MEAL_COLOR, HOLY_SITE_LABEL, HOLY_SITE_COLOR, HOLY_SITE_ICON,
  reportType, isNewRecord,
} from '../../config/fieldRecords.js';
import ReportDrawer from '../../components/details/ReportDrawer.jsx';
import LogisticsDrawer from '../../components/details/LogisticsDrawer.jsx';
import MediaLightbox from '../../components/MediaLightbox.jsx';
import {
  SquaresFour as LayoutDashboard,
  Warning as AlertTriangle,
  Truck,
  ClipboardText as ClipboardList,
  Mountains as Mountain,
  Clock,
  Trash as Trash2,
  X,
  ArrowLeft,
  CheckCircle as CheckCircle2,
  CaretDown as ChevronDown,
  Funnel as Filter,
  MagnifyingGlass as Search,
  Sparkle as Sparkles,
  User,
  Buildings as Building2,
  CalendarBlank as Calendar,
  CaretRight as ChevronRight,
  Pulse as Activity,
  ThumbsUp,
  XCircle,
  ShieldCheck,
  ForkKnife as Utensils,
  Drop as Droplets,
  Factory,
  ArrowRight,
  Stack as Layers,
  Package,
  MapPin,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import NotificationBadge from '../../components/NotificationBadge.jsx';
import { getCaterer } from '../../config/centers.js';
import {
  computeStatusUpdate, TERMINAL_REPORT_STATUSES, TERMINAL_LOGISTICS_STATUSES,
} from '../../lib/statusTracking.js';
import { StatusTimerChip, StatusTimeline } from '../../components/StatusTimeline.jsx';
import { NATIONALITIES } from '../../config/nationalities.js';
import CenterNotesPanel from '../../components/CenterNotesPanel.jsx';

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
function clockTime(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function openImageTab(src) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>صورة البلاغ</title>
    <style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head>
    <body><img src="${src}"/></body></html>`);
  win.document.close();
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

/* ─── Stat Card ─── */
/* The two queues, stated as a sentence rather than a number in a box.
   A queue that is empty says so in green; a queue that is not shouts its size.
   Same shape either way, so the page does not jump when one clears. */
function ActionCard({ n, label, done, Icon, color, onClick }) {
  const live = n > 0;
  const tone = live ? color : '#15803D';
  return (
    <button onClick={onClick}
      className="group w-full text-right rounded-2xl border p-4 flex items-center gap-4 transition-all hover:-translate-y-0.5"
      style={{
        borderColor: `color-mix(in srgb, ${tone} 28%, #fff)`,
        background: live
          ? `linear-gradient(135deg, color-mix(in srgb, ${tone} 9%, #fff), #fff)`
          : '#fff',
        boxShadow: live ? `0 6px 20px color-mix(in srgb, ${tone} 18%, transparent)` : undefined,
      }}>
      <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${tone} 14%, #fff)` }}>
        {live
          ? <Icon size={22} weight="bold" style={{ color: tone }} />
          : <CheckCircle2 size={22} weight="bold" style={{ color: tone }} />}
      </span>
      <span className="min-w-0 flex-1">
        {live ? (
          <>
            <span className="block text-3xl font-black tabular-nums leading-none" style={{ color: tone }}>{n}</span>
            <span className="block text-[12px] font-bold text-muted mt-1.5">{label}</span>
          </>
        ) : (
          <>
            <span className="block text-[15px] font-black" style={{ color: tone }}>{done}</span>
            <span className="block text-[11px] font-bold text-muted mt-1">لا شيء ينتظر هنا</span>
          </>
        )}
      </span>
      <ArrowLeft size={16} weight="bold"
        className="flex-shrink-0 text-muted/40 group-hover:text-muted transition-colors" />
    </button>
  );
}

/* Numbers that describe the season rather than demand action: the accent is a
   bar on the top edge, matching the tiles in the analytics section, so the two
   screens read as one system. */
function StatCard({ label, value, Icon, color, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl p-4 pt-5 border border-line overflow-hidden flex items-center gap-3 w-full text-right transition-all hover:shadow-[0_8px_24px_rgb(var(--c-ink)/0.10)] hover:-translate-y-0.5"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted mb-1 truncate">{label}</p>
        <p className="text-2xl font-black tabular-nums leading-none" style={{ color }}>{value ?? '—'}</p>
        {sub && <p className="text-[10px] text-muted mt-1.5 font-bold truncate">{sub}</p>}
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
        style={{ background: `color-mix(in srgb, ${color} 12%, #fff)` }}>
        <Icon size={19} weight="bold" style={{ color }} />
      </div>
    </button>
  );
}

/* Details open in the same drawers the reports and logistics screens use —
   see components/details. A record should read the same wherever it is
   opened from, and three copies of one modal had already drifted apart. */
function PanelHeader({ title, subtitle, count, gradient, Icon, onViewAll, viewAllColor, badge, badgeVariant }) {
  return (
    <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-3.5 border-b border-line gap-2">
      <div className="flex items-center gap-3 min-w-0">
        {/* A tinted square, not a glowing gradient. Five glowing tiles down one
            page competed with the rows they were introducing. */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
            style={{
              background: `color-mix(in srgb, ${gradient.to} 12%, #fff)`,
              borderColor: `color-mix(in srgb, ${gradient.to} 28%, #fff)`,
            }}>
            <Icon size={17} weight="bold" style={{ color: gradient.to }} />
          </div>
          {badge != null && badge > 0 && (
            <NotificationBadge count={badge} variant={badgeVariant} floating />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-black text-ink text-sm truncate">{title}</p>
          <p className="text-[11px] text-muted mt-0.5 font-bold truncate">{subtitle}</p>
        </div>
      </div>
      <button onClick={onViewAll}
        className="flex items-center gap-1.5 text-[11px] font-black transition-all px-3 py-1.5 rounded-xl shrink-0"
        style={{ color: viewAllColor, background: `${viewAllColor}10`, border: `1px solid ${viewAllColor}30` }}>
        عرض الكل
        <ArrowLeft size={11} weight="bold" />
      </button>
    </div>
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
  /* The clock moved to the header, where it is visible on every screen rather
     than only this one — and where its per-second tick no longer re-renders a
     dashboard holding several live feeds. */

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
    { label: 'البلاغات الميدانية', value: counts.reports,   Icon: AlertTriangle,  color: '#EF4444', sub: 'بلاغات نشطة',    nav: '/admin/reports'   },
    { label: 'تقييم الوجبات',       value: counts.evals,     Icon: Utensils,       color: 'rgb(var(--c-primary))', sub: 'جودة الوجبات',   nav: '/admin/phases'    },
    { label: 'طلبات الإسناد',       value: counts.logistics, Icon: Truck,          color: '#4E7CB0', sub: 'طلبات لوجستية',  nav: '/admin/logistics' },
    { label: 'جاهزية منى',          value: counts.mina,      Icon: ShieldCheck,    color: '#5E9070', sub: 'تقييمات منى',    nav: '/admin/analytics' },
    { label: 'جاهزية عرفة',         value: counts.arafat,    Icon: ShieldCheck,    color: '#2F5580', sub: 'تقييمات عرفة',   nav: '/admin/analytics' },
  ];

  return (
    <div className="space-y-5 pb-6" dir="rtl">

      {/* The dashboard was the one admin screen without a masthead, so it read
          as a loose pile of cards rather than a section of the system. */}
      <PageHeader
        kicker="لوحة الإدارة"
        Icon={LayoutDashboard}
        title="نظرة عامة"
        subtitle="حالة الموسم الآن — وما يحتاج قرارك قبل غيره"
        stats={[
          { value: pendingReports, label: 'بلاغ معلّق', tone: pendingReports > 0 ? 'alert' : undefined },
          { value: pendingLogistics, label: 'إسناد معلّق', tone: pendingLogistics > 0 ? 'alert' : undefined },
          { value: counts.mina + counts.arafat, label: 'تقييم جاهزية', tone: 'gold' },
        ]}
      />

      {/* ── What needs a decision ──
          The two queues an operations lead opens this page to check. Loud when
          they hold something, quiet and green when they do not — the page
          should be readable from across the room before it is read at all. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          n={pendingReports}
          label="بلاغ ينتظر المعالجة"
          done="لا بلاغات معلّقة"
          Icon={AlertTriangle}
          color="#B91C1C"
          onClick={() => navigate('/admin/reports')}
        />
        <ActionCard
          n={pendingLogistics}
          label="طلب إسناد ينتظر الاعتماد"
          done="لا طلبات معلّقة"
          Icon={Truck}
          color="#B45309"
          onClick={() => navigate('/admin/logistics')}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {STATS.map(c => (
          <StatCard key={c.label} {...c} onClick={() => navigate(c.nav)} />
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted" weight="regular" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="بحث برقم البلاغ، طلب الإسناد، المركز، أو المراقب..."
          className="w-full pr-11 pl-4 py-3 rounded-2xl border-2 border-line bg-white text-sm font-medium text-ink placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-[0_2px_8px_rgb(var(--c-ink)/0.05)]"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-[rgb(var(--c-primary-50))] transition-colors">
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

      {/* Reports + Logistics: stacked, full width */}
      <div className="space-y-4">

        {/* Field reports */}
        <div className="bg-white rounded-2xl border border-line shadow-[0_2px_10px_rgb(var(--c-ink)/0.06)] overflow-hidden">
          <PanelHeader
            title="البلاغات الميدانية"
            subtitle={`${counts.reports} بلاغ ${pendingReports > 0 ? `· ${pendingReports} قيد الانتظار` : ''}`}
            gradient={{ from: '#F87171', to: '#DC2626' }}
            Icon={AlertTriangle}
            onViewAll={() => navigate('/admin/reports')}
            viewAllColor="#DC2626"
            badge={pendingReports}
            badgeVariant="red"
          />

          {(() => {
            const q = searchQuery.trim().toLowerCase();
            const displayed = q
              ? reports.filter(r =>
                  (r.reportNumber || '').toString().toLowerCase().includes(q) ||
                  (r.center        || '').toLowerCase().includes(q) ||
                  (r.observer      || '').toLowerCase().includes(q))
              : reports.slice(0, 6);
            if (displayed.length === 0) return (
              <div className="py-12 text-center px-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, #FEE2E2, #FECACA)' }}>
                  <Search size={20} className="text-red-400" weight="regular" />
                </div>
                <p className="text-muted text-sm font-bold">
                  {q ? 'لا توجد نتائج' : 'لا توجد بلاغات بعد'}
                </p>
              </div>
            );
            return displayed.map((r, idx) => {
              const rt     = reportType(r);
              const label  = rt.label;
              const sv     = SEV[r.severity];
              const sb     = STATUS[r.status] || STATUS.pending;
              const SIcon  = sb.Icon;
              const isLast = idx === displayed.length - 1;
              const isNew  = isNewReport(r);
              return (
                <button key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className={`group relative w-full text-right flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-3.5 transition-colors ${!isLast ? 'border-b border-line' : ''} ${isNew ? 'row-pulse-red' : 'hover:bg-background'}`}>
                  {/* "جديد" pill on new rows */}
                  {isNew && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md text-white shadow-md tabular-nums tracking-wide"
                      style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      جديد
                    </span>
                  )}
                  {/* The tile carries the type: twelve kinds of report were
                      wearing one red gradient, so the list said nothing until
                      you had read every row. */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center border"
                      style={{
                        background: `color-mix(in srgb, ${rt.color} 12%, #fff)`,
                        borderColor: `color-mix(in srgb, ${rt.color} 30%, #fff)`,
                      }}>
                      <rt.Icon size={19} weight="bold" style={{ color: rt.color }} />
                    </div>
                    {isNew && (
                      <div className="absolute -top-1 -right-1 badge-pulse-red w-4 h-4 rounded-full bg-red-500 border-2 border-white" />
                    )}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <p className="text-sm font-black text-ink truncate">{label}</p>
                      {r.reportNumber && (
                        <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums tracking-wide ${
                          isNew ? 'badge-pulse-red text-white' : 'border'
                        }`}
                          style={isNew
                            ? { background: 'linear-gradient(135deg, #EF4444, #DC2626)' }
                            : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-ink))' }}>
                          #{r.reportNumber}
                        </span>
                      )}
                      {sv && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
                          style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: sv.bar }} />
                          {sv.label}
                        </span>
                      )}
                      {r.mealType && MEAL_LABEL[r.mealType] && (
                        <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                          style={{ background: MEAL_COLOR[r.mealType] || 'rgb(var(--c-primary))' }}>
                          {MEAL_LABEL[r.mealType]}
                        </span>
                      )}
                      {r.holySite && HOLY_SITE_LABEL[r.holySite] && (() => {
                        const HSIcon = HOLY_SITE_ICON[r.holySite];
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                            style={{ background: HOLY_SITE_COLOR[r.holySite] }}>
                            <HSIcon size={9} weight="bold" />
                            {HOLY_SITE_LABEL[r.holySite]}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <User size={10} weight="bold" className="text-primary" />
                        <span className="font-bold text-ink truncate max-w-[80px]">{r.observer || '—'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 size={10} weight="bold" className="text-primary" />
                        <span className="font-bold text-ink truncate max-w-[80px]">{r.center || '—'}</span>
                      </span>
                    </div>
                    <div className="mt-1">
                      <StatusTimerChip doc={r} terminalStatuses={TERMINAL_REPORT_STATUSES} statusMeta={STATUS} compact />
                    </div>
                    <CenterNotesPanel centerId={r.center} variant="compact" />
                  </div>
                  {/* Status pill */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border-2"
                      style={{ background: sb.bg, borderColor: sb.border, color: sb.text }}>
                      <SIcon size={10} weight="bold" />
                      {sb.label}
                    </span>
                    <ChevronRight size={12} className="text-muted group-hover:text-red-500 transition-colors" weight="bold" />
                  </div>
                </button>
              );
            });
          })()}
        </div>

        {/* Logistics requests */}
        <div className="bg-white rounded-2xl border border-line shadow-[0_2px_10px_rgb(var(--c-ink)/0.06)] overflow-hidden">
          <PanelHeader
            title="طلبات الإسناد"
            subtitle={`${counts.logistics} طلب ${pendingLogistics > 0 ? `· ${pendingLogistics} قيد الانتظار` : ''}`}
            gradient={{ from: '#84AAD4', to: '#3D6795' }}
            Icon={Truck}
            onViewAll={() => navigate('/admin/logistics')}
            viewAllColor="#3D6795"
            badge={pendingLogistics}
            badgeVariant="blue"
          />

          {(() => {
            const q = searchQuery.trim().toLowerCase();
            const displayed = q
              ? logisticsFeed.filter(r =>
                  (r.requestNumber || '').toString().toLowerCase().includes(q) ||
                  (r.reportNumber  || '').toString().toLowerCase().includes(q) ||
                  (r.center        || '').toLowerCase().includes(q) ||
                  (r.observer      || '').toLowerCase().includes(q))
              : logisticsFeed.slice(0, 6);
            if (displayed.length === 0) return (
              <div className="py-12 text-center px-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)' }}>
                  <Search size={20} className="text-blue-400" weight="regular" />
                </div>
                <p className="text-muted text-sm font-bold">
                  {q ? 'لا توجد نتائج' : 'لا توجد طلبات إسناد بعد'}
                </p>
              </div>
            );
            return displayed.map((item, idx) => {
              const sb = LOGISTICS_STATUS[item.status] || LOGISTICS_STATUS.pending;
              const SIcon = sb.Icon;
              const st = SUPPORT[item.supportType] || SUPPORT.internal;
              const SupportIcon = st.Icon;
              const isLast = idx === displayed.length - 1;
              const isNew  = isNewLogistics(item);
              return (
                <button key={item.id}
                  onClick={() => setSelectedLogistics(item)}
                  className={`group relative w-full text-right flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-3.5 transition-colors ${!isLast ? 'border-b border-line' : ''} ${isNew ? 'row-pulse-blue' : 'hover:bg-blue-50/30'}`}>
                  {/* "جديد" pill on new rows */}
                  {isNew && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md text-white shadow-md tabular-nums tracking-wide"
                      style={{ background: 'linear-gradient(135deg, #4E7CB0, #3D6795)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      جديد
                    </span>
                  )}
                  {/* Icon */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity"
                      style={{ background: st.color }} />
                    <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${st.color}, ${st.color}CC)` }}>
                      <Package size={18} className="text-white" weight="bold" />
                    </div>
                    {isNew && (
                      <div className="absolute -top-1 -right-1 badge-pulse-blue w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                    )}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <p className="text-sm font-black text-ink">طلب إسناد</p>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
                        style={{ background: `${st.color}15`, borderColor: `${st.color}40`, color: st.color }}>
                        <SupportIcon size={9} weight="bold" />
                        {st.short}
                      </span>
                      {item.requestNumber && (
                        <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums tracking-wide ${
                          isNew ? 'badge-pulse-blue text-white' : 'text-blue-700 border'
                        }`}
                          style={isNew
                            ? { background: 'linear-gradient(135deg, #4E7CB0, #3D6795)' }
                            : { background: '#EFF6FF', borderColor: '#BFDBFE' }}>
                          #{item.requestNumber}
                        </span>
                      )}
                      {item.holySite && HOLY_SITE_LABEL[item.holySite] && (() => {
                        const HSIcon = HOLY_SITE_ICON[item.holySite];
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                            style={{ background: HOLY_SITE_COLOR[item.holySite] }}>
                            <HSIcon size={9} weight="bold" />
                            {HOLY_SITE_LABEL[item.holySite]}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <User size={10} weight="bold" className="text-primary" />
                        <span className="font-bold text-ink truncate max-w-[80px]">{item.observer || '—'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 size={10} weight="bold" className="text-primary" />
                        <span className="font-bold text-ink truncate max-w-[80px]">{item.center || '—'}</span>
                      </span>
                    </div>
                    <div className="mt-1">
                      <StatusTimerChip doc={item} terminalStatuses={TERMINAL_LOGISTICS_STATUSES} statusMeta={LOGISTICS_STATUS} compact />
                    </div>
                    {item.reportNumber && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
                        <AlertTriangle size={9} weight="bold" className="text-amber-600" />
                        بلاغ
                        <span className="tabular-nums bg-white border border-amber-300 rounded px-1 text-amber-700">#{item.reportNumber}</span>
                      </div>
                    )}
                    <CenterNotesPanel centerId={item.center} variant="compact" />
                  </div>
                  {/* Status pill */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border-2"
                      style={{ background: sb.bg, borderColor: sb.border, color: sb.text }}>
                      <SIcon size={10} weight="bold" />
                      {sb.label}
                    </span>
                    <ChevronRight size={12} className="text-muted group-hover:text-blue-500 transition-colors" weight="bold" />
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Today's menu — coverage strip per nationality */}
      <MenuOverview navigate={navigate} />

      {/* Field activities */}
      <div className="bg-white rounded-2xl border border-line shadow-[0_2px_10px_rgb(var(--c-ink)/0.06)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl blur-md opacity-50 bg-primary" />
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                <ClipboardList size={17} className="text-white" weight="bold" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-black text-ink text-sm truncate">النشاطات الميدانية</p>
              <p className="text-[11px] text-muted mt-0.5 font-bold truncate">
                تقييمات الوجبات وجاهزية المشاعر
              </p>
            </div>
          </div>

          {centerOptions.length > 0 && (
            <div className="relative shrink-0">
              <Filter size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none" weight="bold" />
              <select
                value={centerFilter}
                onChange={e => setCenterFilter(e.target.value)}
                className="appearance-none text-[11px] font-black border-2 border-line rounded-xl pl-7 pr-7 py-1.5 outline-none cursor-pointer transition-all bg-background text-ink hover:border-primary focus:border-primary"
              >
                <option value="">جميع المراكز</option>
                {centerOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" weight="bold" />
            </div>
          )}
        </div>

        {filteredActivity.length === 0 ? (
          <div className="py-12 text-center px-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)), rgb(var(--c-primary-100)))' }}>
              <ClipboardList size={20} className="text-primary-400" weight="regular" />
            </div>
            <p className="text-muted text-sm font-bold">
              {centerFilter ? `لا توجد نشاطات لـ ${centerFilter}` : 'لا توجد نشاطات بعد'}
            </p>
          </div>
        ) : (
          filteredActivity.slice(0, 8).map((item, i) => {
            const isMina = item._col === 'mina';
            const isMeal = item._col === 'meal';
            const center   = getActivityCenter(item);
            const observer = getActivityObserver(item);
            const score    = getActivityScore(item);
            const scoreSt = score == null ? null
              : score >= 8 ? { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' }
              : score >= 5 ? { bg: '#FFFBEB', text: '#B45309', border: '#FCD34D' }
              :              { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' };
            const isLast = i === Math.min(filteredActivity.length, 8) - 1;

            const meta = isMeal
              ? { Icon: Utensils,    color: '#F59E0B', label: 'تقييم جودة الوجبات', nav: '/admin/phases'    }
              : isMina
              ? { Icon: ShieldCheck, color: '#5E9070', label: 'جاهزية مشعر منى',    nav: '/admin/analytics' }
              : { Icon: ShieldCheck, color: '#2F5580', label: 'جاهزية مشعر عرفة',   nav: '/admin/analytics' };

            return (
              <button key={`${item._col}-${item.id}`}
                onClick={() => navigate(meta.nav)}
                className={`group w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#FDFAF7] transition-colors text-right ${!isLast ? 'border-b border-line' : ''}`}>
                {/* Icon */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity"
                    style={{ background: meta.color }} />
                  <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)` }}>
                    <meta.Icon size={18} className="text-white" weight="bold" />
                  </div>
                </div>
                {/* Body */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-ink truncate mb-1">{meta.label}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap">
                    <span className="flex items-center gap-1">
                      <User size={10} weight="bold" className="text-primary" />
                      <span className="font-bold text-ink truncate max-w-[120px]">{observer}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 size={10} weight="bold" className="text-primary" />
                      <span className="font-bold text-ink truncate max-w-[120px]">{center}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} weight="bold" className="text-primary" />
                      <span className="font-bold">{timeAgo(item.timestamp)}</span>
                    </span>
                  </div>
                </div>
                {scoreSt && score != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border-2 tabular-nums shrink-0"
                    style={{ background: scoreSt.bg, color: scoreSt.text, borderColor: scoreSt.border }}>
                    <Sparkles size={10} weight="bold" />
                    {score.toFixed(1)}
                    <span className="text-[9px] opacity-70">/10</span>
                  </span>
                )}
                <ChevronRight size={12} className="text-muted group-hover:text-primary transition-colors shrink-0" weight="bold" />
              </button>
            );
          })
        )}
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

function MenuOverview({ navigate }) {
  return (
    <div className="bg-white rounded-2xl border border-line shadow-[0_2px_10px_rgb(var(--c-ink)/0.06)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50 bg-amber-500" />
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              <Utensils size={17} className="text-white" weight="bold" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-black text-ink text-sm truncate">منيو الجنسيات</p>
            <p className="text-[11px] text-muted mt-0.5 font-bold truncate">
              تغطية المنيو حسب الجنسية ليوم ذو الحجة والوجبة
            </p>
          </div>
        </div>
        <button onClick={() => navigate('/admin/menu')}
          className="flex items-center gap-1.5 text-[11px] font-black transition-all px-3 py-1.5 rounded-xl shrink-0"
          style={{ color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          إدارة المنيو
          <ArrowLeft size={11} weight="bold" />
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {NATIONALITIES.map(s => (
          <button key={s.key}
            onClick={() => navigate('/admin/menu')}
            className="group text-right bg-white rounded-xl border-2 border-line p-3 hover:shadow-md hover:border-line hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-lg blur-sm opacity-40"
                  style={{ background: s.color }} />
                <div className="relative w-9 h-9 rounded-lg flex items-center justify-center text-base shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}CC)` }}>
                  <span className="drop-shadow">{s.flag}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-ink truncate">{s.label}</p>
                <p className="text-[9px] text-muted font-bold mt-0.5">{s.centers.length} مركز</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
