import { useEffect, useMemo, useRef, useState } from 'react';
import { db, uploadFile, STORAGE_BUCKETS } from '../../lib/db.js';
import { compressImage } from '../../lib/imageCompression.js';
import {
  ShieldCheck,
  Mountains as Mountain,
  CaretRight as ChevronRight,
  CheckCircle as CheckCircle2,
  XCircle,
  Sparkle as Sparkles,
  WarningCircle as AlertCircle,
  User,
  CalendarBlank as Calendar,
  Buildings as Building2,
  X,
  MagnifyingGlass as Search,
  Medal as Award,
  TrendUp as TrendingUp,
  ClipboardText as ClipboardList,
  Trash as Trash2,
  ListChecks,
  Sun,
  Hourglass,
  UserGear as UserCog,
  ChartBar as BarChart3,
  Pencil,
  FloppyDisk as Save,
  Camera,
  Image as ImageIcon,
  ArrowCounterClockwise as RotateCcw,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { CENTERS, getCaterer } from '../../config/centers.js';
import { MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';
import { ARAFAT_ALL_CRITERIA } from '../../config/arafatQuestions.js';
import { computeReadinessTotals } from '../../config/readinessScore.js';

const MINA_Qs   = MINA_ALL_CRITERIA;
const ARAFAT_Qs = ARAFAT_ALL_CRITERIA;

const TABS = [
  {
    key:  'mina',
    label: 'مشعر منى',
    short: 'منى',
    col:  'mina_readiness',
    color: 'rgb(var(--c-success))',
    bg:    '#F0FDF4',
    border:'#86EFAC',
    icon:  Mountain,
    allQs: MINA_Qs,
    gradient: 'linear-gradient(135deg, #4F8856, rgb(var(--c-success)))',
  },
  {
    key:  'arafat',
    label: 'مشعر عرفة',
    short: 'عرفة',
    col:  'arafat_readiness',
    color: '#2F5580',
    bg:    '#EFF6FF',
    border:'#BFDBFE',
    icon:  Mountain,
    allQs: ARAFAT_Qs,
    gradient: 'linear-gradient(135deg, #6595C4, #2F5580)',
  },
];

/* ── Helpers ── */
function fullDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return '—'; }
}
function timeAgo(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60)    return 'الآن';
    if (s < 3600)  return `منذ ${Math.floor(s / 60)} دقيقة`;
    if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
    return `منذ ${Math.floor(s / 86400)} يوم`;
  } catch { return '—'; }
}
function getScore(doc) {
  if (!doc) return null;
  if (doc.scoreOutOf10 != null) return Number(doc.scoreOutOf10);
  const max = Number(doc.maxScore);
  const tot = Number(doc.totalScore);
  if (max > 0 && !isNaN(tot)) return parseFloat(((tot / max) * 10).toFixed(2));
  const pct = parseFloat(doc.percentage);
  if (!isNaN(pct)) return parseFloat((pct / 10).toFixed(2));
  return null;
}
function scoreStyle(score) {
  if (score == null) return { color: 'rgb(var(--c-muted))', bg: 'rgb(var(--c-primary-50))', border: 'rgb(var(--c-line))' };
  if (score >= 8)    return { color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' };
  if (score >= 5)    return { color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' };
  return                     { color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' };
}
const getObserver = d => d.observer || d.observerName || '—';
const getCenter   = d => d.center   || d.centerId     || '—';
const isSupervisorDoc = d => d?.role === 'supervisor';

/* Returns the UTC timestamp (ms) for 00:00 Riyadh of today.
   Riyadh = UTC+3 (no DST), so 00:00 Riyadh = 21:00 UTC the previous day. */
function todayRiyadhStartMs() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parseInt(parts.find(p => p.type === 'year').value, 10);
  const m = parseInt(parts.find(p => p.type === 'month').value, 10);
  const d = parseInt(parts.find(p => p.type === 'day').value, 10);
  /* 00:00 Riyadh = -3:00 UTC (i.e., 21:00 UTC previous calendar day). */
  return Date.UTC(y, m - 1, d, -3, 0, 0, 0);
}
const docTimestampMs = d =>
  d?.timestamp?.toMillis?.()
    ?? (d?.timestamp ? new Date(d.timestamp).getTime() : 0);

/**
 * `site` pins the page to one mash'ar, which is how the sidebar now presents
 * it: جاهزية منى and جاهزية عرفة are separate destinations. Passing a prop
 * rather than forking the file keeps one implementation of the loading,
 * realtime and scoring logic — two copies would diverge on the first fix.
 * Called with no prop, the two-tab view still works.
 */
export default function AdminAnalytics({ site }) {
  const [activeTab, setActiveTab] = useState(site || 'mina');
  useEffect(() => { if (site) setActiveTab(site); }, [site]);
  const [data,      setData]      = useState({ mina: null, arafat: null });
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  /* 'all' | 'uploaded' (any eval ever) | 'today' | 'remaining' (no eval today) */
  const [dateFilter, setDateFilter] = useState('all');

  /* Tick every 60s so "today" boundary auto-refreshes if the page stays open
     across midnight Riyadh time. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /* Track docs that just arrived via Realtime — they get a pulsing red dot
     for 10 seconds to draw attention. The first payload of each table is
     treated as "already seen" so we don't flash everything on page load. */
  const [recentDocIds, setRecentDocIds] = useState(() => new Set());
  const seenIdsRef = useRef({ mina: null, arafat: null });

  useEffect(() => {
    const cleanupTimers = new Map();
    const unsubs = TABS.map(t =>
      db[t.col].subscribe(rows => {
        const docs = [...rows].sort((a, b) =>
          (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
        setData(prev => ({ ...prev, [t.key]: docs }));

        const incomingIds = new Set(rows.map(r => r.id));
        const prevSeen = seenIdsRef.current[t.key];
        if (prevSeen === null) {
          seenIdsRef.current[t.key] = incomingIds;
          return;
        }
        /* Detect newly-arrived docs */
        const newIds = rows.filter(r => !prevSeen.has(r.id)).map(r => r.id);
        seenIdsRef.current[t.key] = incomingIds;
        if (newIds.length === 0) return;
        setRecentDocIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.add(id));
          return next;
        });
        /* Auto-clear after 10 seconds */
        newIds.forEach(id => {
          if (cleanupTimers.has(id)) clearTimeout(cleanupTimers.get(id));
          const tid = setTimeout(() => {
            setRecentDocIds(prev => {
              if (!prev.has(id)) return prev;
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            cleanupTimers.delete(id);
          }, 10_000);
          cleanupTimers.set(id, tid);
        });
      })
    );
    return () => {
      unsubs.forEach(u => u?.());
      cleanupTimers.forEach(t => clearTimeout(t));
    };
  }, []);

  const tab  = TABS.find(t => t.key === activeTab);
  const docs = data[activeTab] ?? [];

  const handleDeleteEval = async (id) => {
    if (!id || !tab) return;
    const ok = window.confirm('هل أنت متأكد من حذف هذا التقييم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.');
    if (!ok) return;
    try {
      await db[tab.col].delete(id);
      /* Realtime subscribe will update the list automatically */
    } catch (e) {
      console.error('[AdminAnalytics delete]', e);
      alert(`فشل الحذف: ${e?.message || e}`);
    }
  };

  /* Today's start (Riyadh local). Re-evaluated on each tick. */
  const todayStartMs = useMemo(() => todayRiyadhStartMs(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Docs scoped by the date filter:
       - 'today' / 'remaining' → restrict to today's docs
       - 'all' / 'uploaded'    → use the full lifetime set */
  const scopedDocs = useMemo(() => {
    if (dateFilter === 'today' || dateFilter === 'remaining') {
      return docs.filter(d => docTimestampMs(d) >= todayStartMs);
    }
    return docs;
  }, [docs, dateFilter, todayStartMs]);

  /* Aggregate per center using scoped docs */
  const centerSummaries = useMemo(() => {
    const map = new Map();
    scopedDocs.forEach(d => {
      const c = getCenter(d);
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(d);
    });
    /* Build summary for every center (even those without evaluations in scope) */
    const all = CENTERS.map(c => {
      const list = map.get(c.id) || [];
      const scores = list.map(getScore).filter(s => s != null);
      const avgScore = scores.length
        ? parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1))
        : null;
      const latestDoc = list[0]; // already sorted desc
      const latestScore = latestDoc ? getScore(latestDoc) : null;
      let totalViolations = 0;
      list.forEach(d => {
        if (d.answers) totalViolations += Object.values(d.answers).filter(v => v === 'لا').length;
      });
      const supervisorCount = list.filter(isSupervisorDoc).length;
      return {
        center:  c.id,
        caterer: c.caterer,
        count:   list.length,
        avgScore,
        latestScore,
        latestDoc,
        totalViolations,
        evaluations: list,
        supervisorCount,
      };
    });
    return all;
  }, [scopedDocs]);

  /* Counts for filter buttons — always computed across the full lifetime set
     so badges stay accurate regardless of which filter is currently active. */
  const uploadedCenterSet = useMemo(() => {
    const set = new Set();
    docs.forEach(d => set.add(getCenter(d)));
    return set;
  }, [docs]);
  const todayCenterSet = useMemo(() => {
    const set = new Set();
    docs.forEach(d => {
      if (docTimestampMs(d) >= todayStartMs) set.add(getCenter(d));
    });
    return set;
  }, [docs, todayStartMs]);
  const uploadedCount  = uploadedCenterSet.size;
  const todayCount     = todayCenterSet.size;
  const remainingCount = CENTERS.length - todayCount;

  /* Filtered by search term + (remaining / uploaded) filter.
     For 'today' & 'uploaded', sort by latest submission time (newest first)
     so the most recently uploaded reports surface immediately. */
  const filteredSummaries = useMemo(() => {
    let list = centerSummaries;
    if (dateFilter === 'remaining') {
      list = list.filter(s => s.count === 0);
    } else if (dateFilter === 'uploaded') {
      list = list.filter(s => s.count > 0);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(s =>
        s.center.toLowerCase().includes(q) ||
        (s.caterer || '').toLowerCase().includes(q)
      );
    }
    if (dateFilter === 'today' || dateFilter === 'uploaded') {
      list = [...list].sort((a, b) => {
        const ta = a.latestDoc ? docTimestampMs(a.latestDoc) : 0;
        const tb = b.latestDoc ? docTimestampMs(b.latestDoc) : 0;
        return tb - ta;
      });
    }
    return list;
  }, [centerSummaries, searchTerm, dateFilter]);

  /* Stats */
  const evaluated   = centerSummaries.filter(s => s.count > 0).length;
  const scored      = centerSummaries.filter(s => s.avgScore != null);
  const overallAvg  = scored.length
    ? (scored.reduce((s, v) => s + v.avgScore, 0) / scored.length).toFixed(1)
    : null;
  const totalViols  = centerSummaries.reduce((s, v) => s + v.totalViolations, 0);
  const perfectCnt  = centerSummaries.filter(s => s.avgScore != null && s.avgScore >= 8).length;

  const activeSummary = selectedCenter
    ? centerSummaries.find(s => s.center === selectedCenter)
    : null;

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      <PageHeader
        Icon={ShieldCheck}
        title={site ? `جاهزية ${tab?.short}` : 'الجاهزية'}
        subtitle={site ? `تقييمات مشعر ${tab?.short}` : 'جاهزية مشعر منى ومشعر عرفة'}
        gradient={site ? { from: tab?.color, to: tab?.color } : undefined}
      />

      {/* Hidden when the route already names the mash'ar — a selector with one
          reachable option is just noise. */}
      <div className={`grid grid-cols-2 gap-3 ${site ? 'hidden' : ''}`}>
        {TABS.map(t => {
          const Icon  = t.icon;
          const active = activeTab === t.key;
          const count  = data[t.key]?.length ?? 0;
          return (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key); setSelectedCenter(null); setSearchTerm(''); }}
              className={`group/tab relative overflow-hidden flex items-center gap-3 px-4 py-4 rounded-3xl border-2 transition-all duration-300 ${
                active
                  ? 'shadow-[0_8px_32px_rgb(var(--c-ink)/0.18)] scale-[1.02]'
                  : 'bg-white border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.04)] hover:shadow-[0_4px_20px_rgb(var(--c-ink)/0.08)] hover:scale-[1.01]'
              }`}
              style={active
                ? { background: t.gradient, borderColor: t.color }
                : { borderColor: 'rgb(var(--c-line))' }}
            >
              {active && (
                <>
                  <Sparkles className="absolute top-2 right-2 text-white/30 animate-pulse" size={12} />
                  <Sparkles className="absolute bottom-3 left-3 text-white/20" size={9} />
                </>
              )}
              <div className="relative shrink-0">
                {active && (
                  <div className="absolute inset-0 rounded-2xl blur-md opacity-50 bg-white" />
                )}
                <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover/tab:scale-110"
                  style={active
                    ? { background: 'rgba(255,255,255,0.22)', border: '1.5px solid rgba(255,255,255,0.4)' }
                    : { background: `${t.color}13`, border: `1.5px solid ${t.color}25` }}>
                  <Icon
                    size={22}
                    style={{ color: active ? '#fff' : t.color }}
                    weight={active ? 'bold' : 'regular'}
                  />
                </div>
              </div>
              <div className="flex-1 text-right">
                <p className="text-base font-black leading-snug"
                  style={{ color: active ? '#fff' : 'rgb(var(--c-ink))' }}>
                  جاهزية {t.short}
                </p>
                <p className="text-[11px] font-bold mt-0.5"
                  style={{ color: active ? 'rgba(255,255,255,0.85)' : 'rgb(var(--c-muted))' }}>
                  {count} تقييم · {evaluated} مركز مُقيَّم
                </p>
              </div>
              {active && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/40 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {data[activeTab] === null ? (
        <div className="bg-white rounded-3xl border border-line py-16 text-center shadow-[0_2px_20px_rgb(var(--c-ink)/0.06)]">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted text-sm">جارٍ التحميل...</p>
        </div>
      ) : selectedCenter && activeSummary ? (
        /* ─── Center Detail View ─── */
        <CenterDetail
          tab={tab}
          summary={activeSummary}
          onBack={() => setSelectedCenter(null)}
          onDelete={handleDeleteEval}
          recentDocIds={recentDocIds}
        />
      ) : (
        <>
          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'مراكز مُقيَّمة',  value: `${evaluated}/${CENTERS.length}`, color: tab.color, icon: ClipboardList },
              { label: 'متوسط الدرجات',  value: overallAvg ? `${overallAvg}/10` : '—', color: 'rgb(var(--c-primary))', icon: TrendingUp },
              { label: 'تقييمات ممتازة', value: perfectCnt,                      color: '#15803D', icon: Award },
              { label: 'إجمالي مخالفات', value: totalViols,                      color: totalViols > 0 ? '#B91C1C' : '#15803D', icon: AlertCircle },
            ].map(c => (
              <div key={c.label}
                className="bg-white rounded-2xl p-4 border border-line shadow-[0_2px_8px_rgb(var(--c-ink)/0.07)] flex items-center gap-3"
                style={{ borderRight: `3px solid ${c.color}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted mb-0.5">{c.label}</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.color}18` }}>
                  <c.icon size={18} style={{ color: c.color }} weight="regular" />
                </div>
              </div>
            ))}
          </div>

          {/* ── Stages report button ── */}
          <button
            onClick={() => window.open(`/admin/stages-report?tab=${activeTab}`, '_blank', 'noopener')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white text-sm font-black transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
            style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)) 60%, rgb(var(--c-primary-700)))' }}
          >
            <BarChart3 size={16} weight="bold" />
            تقرير مراحل — قارن مع التقييمات السابقة
            <ChevronRight size={15} weight="bold" className="opacity-70" />
          </button>

          {/* ── Date filter chips ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'all',       label: 'الكل',      Icon: ListChecks,  count: CENTERS.length, color: 'rgb(var(--c-muted))' },
              { key: 'uploaded',  label: 'تم رفعها',  Icon: CheckCircle2, count: uploadedCount,  color: '#15803D' },
              { key: 'today',     label: 'اليوم',     Icon: Sun,         count: todayCount,     color: '#5E9070' },
              { key: 'remaining', label: 'المتبقي',   Icon: Hourglass,   count: remainingCount, color: '#B91C1C' },
            ].map(f => {
              const active = dateFilter === f.key;
              const FIcon = f.Icon;
              return (
                <button key={f.key}
                  onClick={() => setDateFilter(f.key)}
                  className={`group/flt flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border-2 text-xs font-black transition-all ${
                    active ? 'shadow-md scale-[1.02] text-white' : 'bg-white text-muted border-line hover:border-primary/50'
                  }`}
                  style={active
                    ? { background: `linear-gradient(135deg, ${f.color}, ${f.color}D0)`, borderColor: f.color }
                    : undefined}
                >
                  <FIcon size={13} weight="bold" />
                  <span>{f.label}</span>
                  <span className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-white/25' : 'text-muted'
                  }`}
                    style={!active ? { background: `${f.color}15` } : undefined}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Search bar ── */}
          <div className="relative">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted" weight="regular" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالمركز أو المتعهد..."
              className="w-full pr-11 pl-4 py-3 rounded-2xl border-2 border-line bg-white text-sm font-medium text-ink placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-[0_2px_8px_rgb(var(--c-ink)/0.05)]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-[rgb(var(--c-primary-50))] transition-colors">
                <X size={14} weight="bold" />
              </button>
            )}
          </div>

          {/* ── Centers grid ── */}
          {filteredSummaries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-line py-16 text-center shadow-[0_2px_20px_rgb(var(--c-ink)/0.06)]">
              <div className="relative w-fit mx-auto mb-3 group">
                <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 group-hover:opacity-60 transition-opacity"
                  style={{ background: tab.color }} />
                <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: `${tab.color}1A` }}>
                  {dateFilter === 'remaining'
                    ? <CheckCircle2 size={22} style={{ color: '#15803D' }} weight="regular" />
                    : <Search size={22} style={{ color: tab.color }} weight="regular" />}
                </div>
              </div>
              <p className="text-muted font-medium">
                {dateFilter === 'remaining'
                  ? '🎉 جميع المراكز رُفعت لها تقييمات اليوم'
                  : dateFilter === 'today'
                    ? 'لم تُرفع تقييمات اليوم بعد'
                    : dateFilter === 'uploaded'
                      ? 'لم يُرفع أي تقييم بعد'
                      : 'لا توجد مراكز تطابق البحث'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSummaries.map(s => (
                <CenterCard key={s.center} summary={s} tab={tab}
                  isRecent={s.latestDoc?.id ? recentDocIds.has(s.latestDoc.id) : false}
                  onSelect={() => setSelectedCenter(s.center)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CenterCard({ summary, tab, onSelect, isRecent }) {
  const sst = scoreStyle(summary.avgScore);
  const hasData = summary.count > 0;
  const centerNum = (summary.center.match(/\d+\S*/) || ['—'])[0];

  return (
    <button
      onClick={onSelect}
      disabled={!hasData}
      className={`relative text-right group bg-white rounded-2xl border-2 p-4 transition-all ${
        hasData
          ? 'border-line shadow-[0_2px_8px_rgb(var(--c-ink)/0.07)] hover:shadow-[0_6px_24px_rgb(var(--c-primary)/0.18)] hover:border-line hover:-translate-y-0.5 cursor-pointer'
          : 'border-dashed border-line bg-bg opacity-70 cursor-not-allowed'
      }`}
    >
      {/* Pulsing red dot for newly-arrived evaluations */}
      {isRecent && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 border-2 border-white badge-pulse-red z-10" />
      )}
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="relative shrink-0">
          {hasData && (
            <div className="absolute inset-0 rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity"
              style={{ background: tab.color }} />
          )}
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-md"
            style={hasData
              ? { background: tab.gradient }
              : { background: 'rgb(var(--c-primary-50))', border: '1px dashed rgb(var(--c-line))' }}>
            <span className="text-sm font-black tabular-nums"
              style={{ color: hasData ? '#fff' : 'rgb(var(--c-muted))' }}>
              {centerNum}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-black text-ink truncate">{summary.center}</p>
            {summary.supervisorCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[8.5px] font-black px-1.5 py-0.5 rounded-md text-white"
                title={`${summary.supervisorCount} تقييم من المشرف`}
                style={{ background: 'linear-gradient(135deg, #9E5741, #7F4534)' }}>
                <UserCog size={9} weight="bold" />
                مشرف
                {summary.supervisorCount > 1 && (
                  <span className="bg-white/20 rounded px-1 tabular-nums">{summary.supervisorCount}</span>
                )}
              </span>
            )}
          </div>
          <p className="text-[10px] text-primary font-bold truncate mt-0.5">{summary.caterer || '—'}</p>
          {hasData && summary.latestDoc?.timestamp && (
            <p className="text-[9px] text-muted font-bold mt-1 flex items-center gap-1">
              <Calendar size={9} weight="bold" />
              {timeAgo(summary.latestDoc.timestamp)}
            </p>
          )}
        </div>
        {hasData && (
          <ChevronRight size={16} className="text-muted group-hover:text-primary transition-colors shrink-0 mt-1"
            weight="bold" />
        )}
      </div>

      {/* Body */}
      {hasData ? (
        <>
          {/* Score chip */}
          <div className="rounded-xl p-3 border-2 flex items-center justify-between mb-2.5"
            style={{ background: sst.bg, borderColor: sst.border }}>
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: sst.color }} weight="bold" />
              <div>
                <p className="text-[9px] font-bold" style={{ color: sst.color, opacity: 0.85 }}>متوسط الدرجة</p>
                <p className="text-xl font-black tabular-nums leading-tight" style={{ color: sst.color }}>
                  {summary.avgScore != null ? summary.avgScore.toFixed(1) : '—'}
                  <span className="text-[10px] opacity-70">/10</span>
                </p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold" style={{ color: sst.color, opacity: 0.85 }}>تقييمات</p>
              <p className="text-xl font-black tabular-nums leading-tight" style={{ color: sst.color }}>{summary.count}</p>
            </div>
          </div>

          {/* Sub stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line bg-bg p-2">
              <div className="flex items-center gap-1 text-primary mb-0.5">
                <User size={9} weight="bold" />
                <span className="text-[9px] font-bold">المراقب</span>
              </div>
              <p className="text-[10px] font-bold text-ink truncate">
                {getObserver(summary.latestDoc)}
              </p>
            </div>
            <div className="rounded-lg border p-2"
              style={summary.totalViolations > 0
                ? { background: '#FEF2F2', borderColor: '#FCA5A5' }
                : { background: '#F0FDF4', borderColor: '#86EFAC' }}>
              <div className="flex items-center gap-1 mb-0.5"
                style={{ color: summary.totalViolations > 0 ? '#B91C1C' : '#15803D' }}>
                <AlertCircle size={9} weight="bold" />
                <span className="text-[9px] font-bold">مخالفات</span>
              </div>
              <p className="text-[10px] font-black tabular-nums"
                style={{ color: summary.totalViolations > 0 ? '#B91C1C' : '#15803D' }}>
                {summary.totalViolations}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-white p-3 text-center">
          <div className="w-8 h-8 rounded-full bg-[rgb(var(--c-primary-50))] flex items-center justify-center mx-auto mb-1.5">
            <ClipboardList size={14} className="text-muted" weight="regular" />
          </div>
          <p className="text-[10px] font-bold text-muted">لم يُقيَّم بعد</p>
        </div>
      )}
    </button>
  );
}

function CenterDetail({ tab, summary, onBack, onDelete, recentDocIds }) {
  const [openEval, setOpenEval] = useState(summary.evaluations[0]?.id || null);
  const centerNum = (summary.center.match(/\d+\S*/) || ['—'])[0];
  const sst = scoreStyle(summary.avgScore);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-background border border-line rounded-2xl p-4 flex items-center gap-3 shadow-[0_2px_8px_rgb(var(--c-ink)/0.07)]">
        <button onClick={onBack}
          className="min-w-[40px] min-h-[40px] rounded-xl border border-line bg-white text-primary flex items-center justify-center hover:bg-background hover:border-primary transition-all shrink-0"
          title="رجوع">
          <X size={16} weight="bold" />
        </button>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl blur-md opacity-50" style={{ background: tab.color }} />
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
            style={{ background: tab.gradient }}>
            <span className="text-white text-sm font-black tabular-nums">{centerNum}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-black text-ink truncate">{summary.center}</p>
            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border"
              style={{ background: tab.bg, borderColor: tab.border, color: tab.color }}>
              <tab.icon size={9} weight="bold" />
              {tab.label}
            </span>
          </div>
          <p className="text-[11px] text-primary font-bold mt-0.5 truncate">{summary.caterer || '—'}</p>
        </div>
        {/* Avg score chip */}
        <div className="rounded-xl border-2 px-3 py-1.5 text-center shrink-0"
          style={{ background: sst.bg, borderColor: sst.border }}>
          <p className="text-[8px] font-bold opacity-80" style={{ color: sst.color }}>متوسط</p>
          <p className="text-base font-black tabular-nums leading-tight" style={{ color: sst.color }}>
            {summary.avgScore != null ? summary.avgScore.toFixed(1) : '—'}
            <span className="text-[9px] opacity-70">/10</span>
          </p>
        </div>
      </div>

      {/* Evaluations list */}
      <div className="space-y-3">
        {summary.evaluations.map((ev, idx) => (
          <EvaluationCard key={ev.id}
            evalDoc={ev} tab={tab} index={idx + 1}
            isOpen={openEval === ev.id}
            isRecent={recentDocIds?.has(ev.id) || false}
            onToggle={() => setOpenEval(openEval === ev.id ? null : ev.id)}
            onDelete={() => onDelete?.(ev.id)} />
        ))}
      </div>
    </div>
  );
}

function EvaluationCard({ evalDoc, tab, index, isOpen, onToggle, onDelete, isRecent }) {
  /* Edit-mode state. When `isEditing` is true, the user can toggle answers
     and replace photos. Changes accumulate locally until "Save". */
  const [isEditing,    setIsEditing]    = useState(false);
  const [savingEdit,   setSavingEdit]   = useState(false);
  const [draftAns,     setDraftAns]     = useState(null);
  const [draftDetails, setDraftDetails] = useState(null);
  const [draftPhotos,  setDraftPhotos]  = useState(null);
  const [uploadingQ,   setUploadingQ]   = useState(null);
  const fileInputRefs = useRef({});

  const score = getScore(evalDoc);
  const sst   = scoreStyle(score);
  /* When editing, the "current" values come from draft; otherwise from doc */
  const savedAns      = evalDoc.answers || {};
  const ans           = isEditing ? draftAns     : savedAns;
  const photos        = isEditing ? draftPhotos  : (savedAns.__photos  || {});
  const detailsMap    = isEditing ? draftDetails : (savedAns.__details || {});
  const yes     = tab.allQs.filter(q => ans[q.id] === 'نعم').length;
  const no      = tab.allQs.filter(q => ans[q.id] === 'لا').length;
  const noQs    = tab.allQs.filter(q => ans[q.id] === 'لا');

  const startEdit = (e) => {
    e?.stopPropagation();
    setDraftAns({ ...savedAns });
    setDraftDetails({ ...(savedAns.__details || {}) });
    setDraftPhotos({ ...(savedAns.__photos  || {}) });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraftAns(null);
    setDraftDetails(null);
    setDraftPhotos(null);
  };

  const setAnswer = (qid, value) => {
    setDraftAns(prev => ({ ...prev, [qid]: value }));
  };

  const setDetail = (qid, text) => {
    setDraftDetails(prev => ({ ...prev, [qid]: text }));
  };

  const handlePhotoUpload = async (qid, file) => {
    if (!file) return;
    setUploadingQ(qid);
    try {
      const compressed = await compressImage(file);
      const folder = tab.key === 'mina' ? 'mina' : 'arafat';
      const center = evalDoc.center || 'unknown';
      const url = await uploadFile(
        STORAGE_BUCKETS.phases,
        `readiness/${folder}/${center}/edited/q${qid}_${Date.now()}.jpg`,
        compressed,
      );
      setDraftPhotos(prev => ({ ...prev, [qid]: url }));
    } catch (err) {
      console.error('[EvaluationCard photo upload]', err);
      alert(`فشل رفع الصورة: ${err?.message || err}`);
    } finally {
      setUploadingQ(null);
    }
  };

  const removePhoto = (qid) => {
    setDraftPhotos(prev => {
      const next = { ...prev };
      delete next[qid];
      return next;
    });
  };

  const saveEdit = async () => {
    if (!window.confirm('هل تريد حفظ التعديلات على هذا التقييم؟')) return;
    setSavingEdit(true);
    try {
      /* Strip special keys before scoring, then rebuild final answers */
      const cleanAns = {};
      Object.keys(draftAns).forEach(k => {
        if (!String(k).startsWith('__')) cleanAns[k] = draftAns[k];
      });
      const scoring = computeReadinessTotals(tab.allQs, cleanAns);
      const newAnswers = {
        ...cleanAns,
        __details: draftDetails,
        __photos:  draftPhotos,
      };
      await db[tab.col].update(evalDoc.id, {
        answers: newAnswers,
        ...scoring,
      });
      setIsEditing(false);
      setDraftAns(null);
      setDraftDetails(null);
      setDraftPhotos(null);
    } catch (err) {
      console.error('[EvaluationCard save]', err);
      alert(`فشل حفظ التعديلات: ${err?.message || err}`);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="relative bg-white rounded-2xl border-2 overflow-hidden shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)]"
      style={{ borderColor: isOpen ? sst.border : 'rgb(var(--c-line))' }}>
      {/* Pulsing red dot for newly-arrived evaluations */}
      {isRecent && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 border-2 border-white badge-pulse-red z-10" />
      )}
      {/* Header row — always visible */}
      <div className="relative flex items-center hover:bg-[#FDFAF7] transition-colors">
      <button onClick={onToggle}
        className="flex-1 min-w-0 text-right px-4 sm:px-5 py-3.5 flex items-center gap-3">
        {/* Score badge */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl blur-md opacity-40" style={{ background: sst.color }} />
          <div className="relative w-14 h-14 rounded-2xl flex flex-col items-center justify-center border-2"
            style={{ background: sst.bg, borderColor: sst.border }}>
            <span className="text-base font-black tabular-nums leading-none" style={{ color: sst.color }}>
              {score != null ? score.toFixed(1) : '—'}
            </span>
            <span className="text-[8px] font-bold opacity-70 mt-0.5" style={{ color: sst.color }}>/10</span>
          </div>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums"
              style={{ background: `${tab.color}15`, color: tab.color, border: `1px solid ${tab.color}30` }}>
              تقييم #{index}
            </span>
            {isSupervisorDoc(evalDoc) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md text-white"
                style={{ background: 'linear-gradient(135deg, #9E5741, #7F4534)' }}>
                <UserCog size={10} weight="bold" />
                مشرف
              </span>
            )}
            {no > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700">
                <AlertCircle size={10} weight="bold" />
                {no} مخالفة
              </span>
            )}
            {no === 0 && score != null && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-green-50 border border-green-200 text-green-700">
                <CheckCircle2 size={10} weight="bold" />
                بدون مخالفات
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <User size={11} weight="bold" className="text-primary" />
              <span className="font-bold text-ink">{getObserver(evalDoc)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={11} weight="bold" className="text-primary" />
              <span className="font-bold">{fullDate(evalDoc.timestamp)}</span>
            </span>
          </div>
        </div>
        {/* Chevron stays inside the toggle button */}
        <div className="w-8 h-8 rounded-lg border border-line flex items-center justify-center transition-transform shrink-0"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <ChevronRight size={14} className="text-primary" weight="bold" />
        </div>
      </button>

      {/* Edit + Delete buttons — siblings of toggle so their clicks never collide */}
      <div className="flex items-center gap-1.5 ml-2 sm:ml-3 mr-1 shrink-0">
        {!isEditing && (
          <button onClick={startEdit}
            title="تعديل التقييم"
            style={{ borderColor: `${tab.color}40`, background: `${tab.color}10`, color: tab.color }}
            className="w-9 h-9 rounded-lg border-2 flex items-center justify-center hover:scale-105 transition-transform">
            <Pencil size={14} weight="bold" />
          </button>
        )}
        <button onClick={onDelete}
          title="حذف التقييم"
          className="w-9 h-9 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-500 hover:border-red-500 group/del transition-colors">
          <Trash2 size={14} className="text-red-500 group-hover/del:text-white" weight="bold" />
        </button>
      </div>
      </div>

      {/* Expanded details */}
      {isOpen && (
        <div className="border-t border-line bg-background px-4 sm:px-5 py-4 space-y-4">
          {/* Edit-mode toolbar */}
          {isEditing && (
            <div className="rounded-2xl border-2 p-3 flex items-center justify-between gap-3"
              style={{ background: `${tab.color}08`, borderColor: `${tab.color}60` }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: tab.gradient }}>
                  <Pencil size={15} className="text-white" weight="bold" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-ink">وضع التعديل</p>
                  <p className="text-[11px] text-muted font-bold">اضغط نعم/لا لتبديل الإجابات وضع/استبدل الصور</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={cancelEdit} disabled={savingEdit}
                  className="px-3 py-2 rounded-xl border border-line text-muted text-xs font-bold hover:bg-[rgb(var(--c-primary-50))] transition-colors disabled:opacity-60">
                  إلغاء
                </button>
                <button onClick={saveEdit} disabled={savingEdit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: tab.gradient }}>
                  {savingEdit ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save size={13} weight="bold" />
                      حفظ التعديلات
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border-2 p-3 text-center"
              style={{ background: sst.bg, borderColor: sst.border }}>
              <p className="text-[10px] font-bold opacity-80" style={{ color: sst.color }}>الدرجة</p>
              <p className="text-xl font-black tabular-nums" style={{ color: sst.color }}>
                {score != null ? score.toFixed(1) : '—'}
                <span className="text-[10px] opacity-70">/10</span>
              </p>
            </div>
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-3 text-center">
              <p className="text-[10px] font-bold text-green-700 opacity-80">إجابة «نعم»</p>
              <p className="text-xl font-black tabular-nums text-green-700">{yes}</p>
            </div>
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-center">
              <p className="text-[10px] font-bold text-red-700 opacity-80">إجابة «لا»</p>
              <p className="text-xl font-black tabular-nums text-red-700">{no}</p>
            </div>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { label: 'المراقب',  val: getObserver(evalDoc),                                 Icon: User,     color: 'rgb(var(--c-primary))' },
              { label: 'المركز',   val: getCenter(evalDoc),                                   Icon: Building2,color: tab.color },
              { label: 'الوقت',    val: fullDate(evalDoc.timestamp),                          Icon: Calendar, color: 'rgb(var(--c-muted))' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-xl border border-line p-2.5 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${m.color}15` }}>
                  <m.Icon size={12} style={{ color: m.color }} weight="bold" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-muted font-bold">{m.label}</p>
                  <p className="text-[11px] font-bold text-ink truncate">{m.val || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Score progress bar */}
          {score != null && (
            <div className="bg-white rounded-xl border border-line p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted font-bold">الدرجة الإجمالية</span>
                <span className="font-black tabular-nums" style={{ color: sst.color }}>{score.toFixed(2)} / 10</span>
              </div>
              <div className="h-2 bg-[rgb(var(--c-primary-50))] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(score * 10, 100)}%`, background: sst.color }} />
              </div>
            </div>
          )}

          {/* Violations */}
          {noQs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-1.5 h-5 rounded-full bg-red-500" />
                <p className="text-sm font-black text-red-700">المخالفات</p>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 tabular-nums">
                  {noQs.length}
                </span>
              </div>
              <ul className="space-y-1.5">
                {noQs.map(q => (
                  <li key={q.id} className="bg-red-50/60 border border-red-200/70 rounded-xl p-3 flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-red-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {q.id}
                    </span>
                    <p className="text-sm text-ink font-medium leading-relaxed flex-1">{q.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All answers */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-1.5 h-5 rounded-full" style={{ background: tab.color }} />
              <p className="text-sm font-black text-ink">جميع الإجابات</p>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full tabular-nums"
                style={{ background: tab.bg, color: tab.color, border: `1px solid ${tab.border}` }}>
                {tab.allQs.filter(q => ans[q.id]).length} سؤال
              </span>
            </div>
            <div className="space-y-1.5">
              {tab.allQs.map(q => {
                const a = ans[q.id];
                /* In edit mode, show ALL questions (so admin can add answers).
                   In view mode, hide unanswered ones. */
                if (!a && !isEditing) return null;
                const isYes = a === 'نعم';
                const isNo  = a === 'لا';
                const photoUrl = photos[q.id];
                const detail   = detailsMap[q.id];
                const isChoice = q.type === 'choice';
                const isUploadingThis = uploadingQ === q.id;
                return (
                  <div key={q.id}
                    className={`rounded-xl px-3 py-2 border ${
                      isYes ? 'bg-green-50/60 border-green-200/70'
                      : isNo ? 'bg-red-50/60 border-red-200/70'
                      :        'bg-white border-line'
                    }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black flex-shrink-0 tabular-nums"
                        style={{ color: isYes ? '#15803D' : isNo ? '#B91C1C' : 'rgb(var(--c-muted))' }}>
                        #{q.id}
                      </span>
                      <p className="text-xs flex-1 min-w-[180px] leading-relaxed"
                        style={{ color: isYes ? '#166534' : isNo ? '#991B1B' : 'rgb(var(--c-ink))' }}>
                        {q.text}
                      </p>
                      {isEditing ? (
                        isChoice ? (
                          <select value={a || ''} onChange={(e) => setAnswer(q.id, e.target.value)}
                            className="text-[11px] font-black px-2 py-1 rounded-md border-2 bg-white outline-none focus:border-primary"
                            style={{ borderColor: 'rgb(var(--c-line))' }}>
                            <option value="">—</option>
                            {(q.choices || []).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setAnswer(q.id, 'نعم')}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-black border-2 transition-all ${
                                isYes ? 'bg-green-600 border-green-600 text-white shadow-sm'
                                      : 'bg-white border-line text-muted hover:border-green-400'
                              }`}>
                              نعم
                            </button>
                            <button onClick={() => setAnswer(q.id, 'لا')}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-black border-2 transition-all ${
                                isNo ? 'bg-red-600 border-red-600 text-white shadow-sm'
                                     : 'bg-white border-line text-muted hover:border-red-400'
                              }`}>
                              لا
                            </button>
                          </div>
                        )
                      ) : (
                        <span className={`text-[10px] font-black flex-shrink-0 flex items-center gap-0.5 ${
                          isYes ? 'text-green-700' : isNo ? 'text-red-700' : 'text-muted'
                        }`}>
                          {isYes
                            ? <CheckCircle2 size={12} weight="bold" />
                            : isNo ? <XCircle size={12} weight="bold" /> : null}
                          {a || '—'}
                        </span>
                      )}
                    </div>
                    {/* Details — single text (yesno_detail) */}
                    {q.type === 'yesno_detail' && (
                      isEditing ? (
                        <input type="text" value={detail || ''}
                          onChange={(e) => setDetail(q.id, e.target.value)}
                          placeholder={q.detailLabel || 'تفاصيل...'}
                          className="mt-1.5 w-full text-[11px] px-2 py-1 rounded border border-line outline-none focus:border-primary" />
                      ) : (
                        detail && (
                          <p className="mt-1.5 text-[11px] text-muted bg-white border border-line rounded px-2 py-1 leading-snug">
                            {detail}
                          </p>
                        )
                      )
                    )}
                    {/* Details — multi-field (yesno_multi_detail). Stored as
                        detailsMap[`${qid}_${fieldKey}`]. Only relevant when answer is 'نعم'. */}
                    {q.type === 'yesno_multi_detail' && a === 'نعم' && (
                      <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {(q.fields || []).map(field => {
                          const fieldKey = `${q.id}_${field.key}`;
                          const fieldVal = detailsMap[fieldKey];
                          if (isEditing) {
                            return (
                              <div key={field.key} className="flex flex-col gap-0.5">
                                <label className="text-[9px] font-bold text-muted">{field.label}</label>
                                <input type={field.type === 'number' ? 'number' : 'text'}
                                  value={fieldVal || ''}
                                  onChange={(e) => setDetail(fieldKey, e.target.value)}
                                  placeholder={field.label}
                                  className="w-full text-[11px] px-2 py-1 rounded border border-line outline-none focus:border-primary" />
                              </div>
                            );
                          }
                          return (
                            <div key={field.key}
                              className="bg-white border border-line rounded px-2 py-1 flex items-baseline gap-1.5 min-w-0">
                              <span className="text-[9px] font-bold text-muted shrink-0">{field.label}:</span>
                              <span className="text-[11px] font-bold text-ink truncate tabular-nums">
                                {fieldVal != null && fieldVal !== '' ? fieldVal : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Photo */}
                    {(photoUrl || (isEditing && (q.requiresPhoto || photoUrl))) && (
                      <div className="mt-2 space-y-1.5">
                        {photoUrl ? (
                          <a href={photoUrl} target="_blank" rel="noreferrer" className="block">
                            <img src={photoUrl} alt={`q${q.id}`}
                              className="rounded-lg border border-line max-h-44 object-cover hover:opacity-90 transition-opacity" />
                          </a>
                        ) : isEditing && (
                          <div className="rounded-lg border-2 border-dashed border-line bg-bg p-3 text-center">
                            <ImageIcon size={20} className="text-primary mx-auto mb-1" weight="regular" />
                            <p className="text-[10px] text-muted font-bold">لا توجد صورة بعد</p>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex items-center gap-1.5">
                            <input type="file" accept="image/*" hidden
                              ref={el => fileInputRefs.current[q.id] = el}
                              onChange={(e) => handlePhotoUpload(q.id, e.target.files?.[0])} />
                            <button onClick={() => fileInputRefs.current[q.id]?.click()}
                              disabled={isUploadingThis}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black border-2 transition-colors disabled:opacity-60"
                              style={{ borderColor: `${tab.color}40`, background: `${tab.color}10`, color: tab.color }}>
                              {isUploadingThis ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  جاري الرفع
                                </>
                              ) : (
                                <>
                                  <Camera size={11} weight="bold" />
                                  {photoUrl ? 'استبدال الصورة' : 'إضافة صورة'}
                                </>
                              )}
                            </button>
                            {photoUrl && (
                              <button onClick={() => removePhoto(q.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                                <X size={11} weight="bold" />
                                حذف الصورة
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
