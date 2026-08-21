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
import {
  Surface,
  IconTile,
  Pill,
  StatTile,
  EmptyState,
} from '../../components/ui/index.jsx';
import { CENTERS, getCaterer } from '../../config/centers.js';
import { MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';
import { ARAFAT_ALL_CRITERIA } from '../../config/arafatQuestions.js';
import { computeReadinessTotals, readDetails } from '../../config/readinessScore.js';

const MINA_Qs   = MINA_ALL_CRITERIA;
const ARAFAT_Qs = ARAFAT_ALL_CRITERIA;

const TABS = [
  {
    key:  'mina',
    label: 'مشعر منى',
    short: 'منى',
    col:  'mina_readiness',
    color: '#16A34A',
    bg:    '#F0FDF4',
    border:'#86EFAC',
    icon:  Mountain,
    allQs: MINA_Qs,
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
        kicker="جاهزية المشاعر"
        Icon={ShieldCheck}
        title={site ? `جاهزية ${tab?.short}` : 'الجاهزية'}
        subtitle={site ? `تقييمات مشعر ${tab?.short} — آخر درجة لكل مركز` : 'جاهزية مشعر منى ومشعر عرفة'}
        stats={[
          { value: `${evaluated}/${CENTERS.length}`, label: 'مركز مقيّم' },
          { value: overallAvg ? `${overallAvg}` : '—', label: 'متوسط الجاهزية', tone: 'gold' },
          { value: totalViols, label: 'مخالفة', tone: totalViols > 0 ? 'alert' : undefined },
        ]}
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
              className="group/tab relative overflow-hidden flex items-center gap-3 px-4 ps-5 py-4 rounded-[14px] border
                         shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                         hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
              style={active
                ? {
                    background: `color-mix(in srgb, ${t.color} 12%, #fff)`,
                    borderColor: t.color,
                  }
                : { background: '#fff', borderColor: 'rgb(var(--c-line))' }}
            >
              {active && (
                <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: t.color }} />
              )}
              <IconTile Icon={Icon} color={t.color} size="lg" />
              <div className="flex-1 text-start min-w-0">
                <p className="text-[15px] font-bold leading-snug"
                  style={{ color: active ? t.color : 'rgb(var(--c-ink))' }}>
                  جاهزية {t.short}
                </p>
                <p className="text-[11.5px] font-medium text-muted mt-1">
                  {count} تقييم · {evaluated} مركز مُقيَّم
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {data[activeTab] === null ? (
        <Surface className="py-16 text-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted text-[13px] font-semibold">جارٍ التحميل...</p>
        </Surface>
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
              /* The evaluated count is the same set the "تم رفعها" chip below
                 selects, so the tile drives that filter instead of leaving the
                 reader to find the chip. The other three summarise the scores
                 themselves — no screen and no filter holds those lists, so they
                 stay plain figures rather than pretending to lead somewhere. */
              { label: 'مراكز مُقيَّمة',  value: `${evaluated}/${CENTERS.length}`, color: tab.color, Icon: ClipboardList,
                onClick: () => setDateFilter('uploaded'), active: dateFilter === 'uploaded' },
              { label: 'متوسط الدرجات',  value: overallAvg ? `${overallAvg}/10` : '—', color: 'rgb(var(--c-primary))', Icon: TrendingUp },
              { label: 'تقييمات ممتازة', value: perfectCnt,                      color: '#15803D', Icon: Award },
              { label: 'إجمالي مخالفات', value: totalViols,                      color: totalViols > 0 ? '#B91C1C' : '#15803D', Icon: AlertCircle },
            ].map(c => (
              /* The shared StatTile: same figure row as the dashboard and the
                 phases screen, so the three read as one system. */
              <StatTile key={c.label} label={c.label} value={c.value} Icon={c.Icon} color={c.color}
                onClick={c.onClick} active={c.active} />
            ))}
          </div>

          {/* ── Stages report button ── */}
          <button
            onClick={() => window.open(`/admin/stages-report?tab=${activeTab}`, '_blank')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[14px] text-white text-[13px] font-bold
                       shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                       hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
            style={{ background: 'rgb(var(--c-primary))' }}
          >
            <BarChart3 size={16} weight="bold" />
            تقرير مراحل
            <ChevronRight size={15} weight="bold" className="opacity-70" />
          </button>

          {/* ── Date filter chips ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'all',       label: 'الكل',      Icon: ListChecks,  count: CENTERS.length, color: '#2F5580' },
              { key: 'uploaded',  label: 'تم رفعها',  Icon: CheckCircle2, count: uploadedCount,  color: '#15803D' },
              { key: 'today',     label: 'اليوم',     Icon: Sun,         count: todayCount,     color: '#5E9070' },
              { key: 'remaining', label: 'المتبقي',   Icon: Hourglass,   count: remainingCount, color: '#B91C1C' },
            ].map(f => {
              const active = dateFilter === f.key;
              const FIcon = f.Icon;
              return (
                <button key={f.key}
                  onClick={() => setDateFilter(f.key)}
                  className={`group/flt flex items-center justify-center gap-2 px-3 py-2.5 rounded-[10px] border text-[12px] font-bold transition-colors ${
                    active ? '' : 'bg-white text-muted border-line hover:border-primary/50'
                  }`}
                  style={active
                    ? {
                        background: `color-mix(in srgb, ${f.color} 12%, #fff)`,
                        borderColor: f.color,
                        color: f.color,
                      }
                    : undefined}
                >
                  <FIcon size={13} weight="duotone" style={{ color: f.color }} />
                  <span>{f.label}</span>
                  <span className="tabular-nums text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none"
                    style={{ background: `color-mix(in srgb, ${f.color} 11%, #fff)`, color: f.color }}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Search bar ── */}
          <div className="relative">
            <Search size={16} className="absolute start-4 top-1/2 -translate-y-1/2 text-muted" weight="regular" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالمركز أو المتعهد..."
              className="w-full ps-11 pe-4 py-3 rounded-[14px] border border-line bg-white text-[13px] font-medium text-ink placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-muted hover:bg-[rgb(var(--c-primary-50))] transition-colors">
                <X size={14} weight="bold" />
              </button>
            )}
          </div>

          {/* ── Centers grid ── */}
          {filteredSummaries.length === 0 ? (
            <Surface>
              <EmptyState
                Icon={dateFilter === 'remaining' ? CheckCircle2 : Search}
                title={
                  dateFilter === 'remaining'
                    ? '🎉 جميع المراكز رُفعت لها تقييمات اليوم'
                    : dateFilter === 'today'
                      ? 'لم تُرفع تقييمات اليوم بعد'
                      : dateFilter === 'uploaded'
                        ? 'لم يُرفع أي تقييم بعد'
                        : 'لا توجد مراكز تطابق البحث'
                }
              />
            </Surface>
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

/* A centre, led by its score.
 *
 * The card used to give the score a two-tone chip, the centre number a glowing
 * gradient tile, and the observer and the violations a tile each — four boxes
 * for four facts, and the one that decides whether anyone visits the centre was
 * no louder than the rest. Now the band colour is a rail on the leading edge,
 * the score is the largest thing on the card, and everything else is a line of
 * quiet meta beneath it. */
function CenterCard({ summary, tab, onSelect, isRecent }) {
  const sst = scoreStyle(summary.avgScore);
  const hasData = summary.count > 0;
  const centerNum = (summary.center.match(/\d+\S*/) || ['—'])[0];
  const tone = hasData ? sst.color : 'rgb(var(--c-muted))';

  return (
    <button
      onClick={onSelect}
      disabled={!hasData}
      className={`relative text-start group bg-white rounded-[14px] border overflow-hidden p-4 ps-5
                  shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200 ${
        hasData
          ? 'border-line hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)] cursor-pointer'
          : 'border-dashed border-line bg-[rgb(var(--c-bg))] opacity-70 cursor-not-allowed'
      }`}
    >
      {hasData && <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: tone }} />}

      {isRecent && (
        <span className="absolute top-2.5 end-2.5 w-2.5 h-2.5 rounded-full bg-red-500 badge-pulse-red z-10" />
      )}

      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0 border"
          style={hasData
            ? { background: `color-mix(in srgb, ${tone} 9%, #fff)`, borderColor: `color-mix(in srgb, ${tone} 22%, #fff)` }
            : { background: 'rgb(var(--c-primary-50))', borderStyle: 'dashed', borderColor: 'rgb(var(--c-line))' }}>
          <span className="text-[14px] font-extrabold tabular-nums" style={{ color: tone }}>{centerNum}</span>
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[13.5px] font-bold text-ink truncate">{summary.center}</p>
            {summary.supervisorCount > 0 && (
              <span title={`${summary.supervisorCount} تقييم من المشرف`} className="inline-flex">
                <Pill color="#9E5741" Icon={UserCog}>
                  مشرف
                  {summary.supervisorCount > 1 && (
                    <span className="tabular-nums">{summary.supervisorCount}</span>
                  )}
                </Pill>
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-primary font-medium truncate mt-1">{summary.caterer || '—'}</p>
        </div>

        {/* The score, and nothing competing with it. */}
        {hasData ? (
          <div className="text-end flex-shrink-0">
            <p className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color: tone }}>
              {summary.avgScore != null ? summary.avgScore.toFixed(1) : '—'}
            </p>
            <p className="text-[10.5px] font-medium text-muted mt-1.5">من ١٠</p>
          </div>
        ) : (
          <ClipboardList size={16} className="text-muted flex-shrink-0" weight="regular" />
        )}
      </div>

      {hasData ? (
        <div className="mt-3 pt-3 border-t border-line flex items-center gap-x-3 gap-y-1 flex-wrap text-[11.5px] font-medium">
          <span className="flex items-center gap-1.5 text-muted">
            <Sparkles size={12} weight="bold" style={{ color: tone }} />
            {summary.count} تقييم
          </span>
          <span className="flex items-center gap-1.5 text-muted min-w-0">
            <User size={12} weight="bold" className="text-muted/60 flex-shrink-0" />
            <span className="truncate max-w-[7rem] text-ink/75">{getObserver(summary.latestDoc)}</span>
          </span>
          <span className="flex items-center gap-1.5 font-semibold"
            style={{ color: summary.totalViolations > 0 ? '#B91C1C' : '#15803D' }}>
            <AlertCircle size={12} weight="bold" />
            {summary.totalViolations} مخالفة
          </span>
          {summary.latestDoc?.timestamp && (
            <span className="flex items-center gap-1.5 text-muted/70 ms-auto">
              <Calendar size={12} weight="bold" />
              {timeAgo(summary.latestDoc.timestamp)}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-3 pt-3 border-t border-dashed border-line text-[11.5px] font-medium text-muted text-center">
          لم يُقيَّم بعد
        </p>
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
      <Surface className="p-4 flex items-center gap-3">
        <button onClick={onBack}
          className="min-w-[40px] min-h-[40px] rounded-[10px] border border-line bg-white text-primary flex items-center justify-center hover:bg-background hover:border-primary transition-colors shrink-0"
          title="رجوع">
          <X size={16} weight="bold" />
        </button>
        <span className="w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0 border"
          style={{
            background: `color-mix(in srgb, ${tab.color} 9%, #fff)`,
            borderColor: `color-mix(in srgb, ${tab.color} 22%, #fff)`,
          }}>
          <span className="text-[16px] font-extrabold tabular-nums" style={{ color: tab.color }}>{centerNum}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[16px] font-bold text-ink truncate">{summary.center}</p>
            <Pill color={tab.color} Icon={tab.icon}>{tab.label}</Pill>
          </div>
          <p className="text-[11.5px] text-primary font-medium mt-1 truncate">{summary.caterer || '—'}</p>
        </div>
        {/* Avg score chip */}
        <div className="rounded-[10px] border px-3 py-1.5 text-center shrink-0"
          style={{
            background: `color-mix(in srgb, ${sst.color} 12%, #fff)`,
            borderColor: `color-mix(in srgb, ${sst.color} 28%, #fff)`,
          }}>
          <p className="text-[10px] font-semibold opacity-80" style={{ color: sst.color }}>متوسط</p>
          <p className="text-[18px] font-extrabold tabular-nums leading-tight mt-0.5" style={{ color: sst.color }}>
            {summary.avgScore != null ? summary.avgScore.toFixed(1) : '—'}
            <span className="text-[10px] font-semibold opacity-70">/10</span>
          </p>
        </div>
      </Surface>

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
  const detailsMap    = isEditing ? draftDetails : readDetails(savedAns);
  const yes     = tab.allQs.filter(q => ans[q.id] === 'نعم').length;
  const no      = tab.allQs.filter(q => ans[q.id] === 'لا').length;
  const noQs    = tab.allQs.filter(q => ans[q.id] === 'لا');

  const startEdit = (e) => {
    e?.stopPropagation();
    setDraftAns({ ...savedAns });
    setDraftDetails(readDetails(savedAns));
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
    <div className="relative bg-white rounded-[14px] border overflow-hidden shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
      style={{ borderColor: isOpen ? `color-mix(in srgb, ${sst.color} 28%, #fff)` : 'rgb(var(--c-line))' }}>
      {/* Pulsing red dot for newly-arrived evaluations */}
      {isRecent && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 border border-white badge-pulse-red z-10" />
      )}
      {/* Header row — always visible */}
      <div className="relative flex items-center hover:bg-[rgb(var(--c-bg))] transition-colors">
      <button onClick={onToggle}
        className="flex-1 min-w-0 text-start px-4 sm:px-5 py-3.5 flex items-center gap-3">
        {/* Score badge */}
        <div className="w-14 h-14 rounded-[10px] flex flex-col items-center justify-center border shrink-0"
          style={{
            background: `color-mix(in srgb, ${sst.color} 12%, #fff)`,
            borderColor: `color-mix(in srgb, ${sst.color} 28%, #fff)`,
          }}>
          <span className="text-[21px] font-extrabold tabular-nums leading-none" style={{ color: sst.color }}>
            {score != null ? score.toFixed(1) : '—'}
          </span>
          <span className="text-[10px] font-semibold opacity-70 mt-1" style={{ color: sst.color }}>/10</span>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Pill color={tab.color}>تقييم #{index}</Pill>
            {isSupervisorDoc(evalDoc) && (
              <Pill color="#9E5741" Icon={UserCog}>مشرف</Pill>
            )}
            {no > 0 && (
              <Pill color="#B91C1C" Icon={AlertCircle}>{no} مخالفة</Pill>
            )}
            {no === 0 && score != null && (
              <Pill color="#15803D" Icon={CheckCircle2}>بدون مخالفات</Pill>
            )}
          </div>
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <User size={12} weight="bold" className="text-muted/60" />
              <span className="font-medium text-ink/75">{getObserver(evalDoc)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={12} weight="bold" className="text-muted/60" />
              <span className="font-medium text-ink/75">{fullDate(evalDoc.timestamp)}</span>
            </span>
          </div>
        </div>
        {/* Chevron stays inside the toggle button */}
        <div className="w-8 h-8 rounded-md border border-line flex items-center justify-center transition-transform shrink-0"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <ChevronRight size={14} className="text-primary" weight="bold" />
        </div>
      </button>

      {/* Edit + Delete buttons — siblings of toggle so their clicks never collide */}
      <div className="flex items-center gap-1.5 me-2 sm:me-3 ms-1 shrink-0">
        {!isEditing && (
          <button onClick={startEdit}
            title="تعديل التقييم"
            style={{
              borderColor: `color-mix(in srgb, ${tab.color} 28%, #fff)`,
              background: `color-mix(in srgb, ${tab.color} 12%, #fff)`,
              color: tab.color,
            }}
            className="w-9 h-9 rounded-[10px] border flex items-center justify-center transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]">
            <Pencil size={14} weight="bold" />
          </button>
        )}
        <button onClick={onDelete}
          title="حذف التقييم"
          className="w-9 h-9 rounded-[10px] border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-500 hover:border-red-500 group/del transition-colors">
          <Trash2 size={14} className="text-red-500 group-hover/del:text-white" weight="bold" />
        </button>
      </div>
      </div>

      {/* Expanded details */}
      {isOpen && (
        <div className="border-t border-line bg-background px-4 sm:px-5 py-4 space-y-4">
          {/* Edit-mode toolbar */}
          {isEditing && (
            <div className="rounded-[14px] border p-3 flex items-center justify-between gap-3"
              style={{
                background: `color-mix(in srgb, ${tab.color} 12%, #fff)`,
                borderColor: `color-mix(in srgb, ${tab.color} 28%, #fff)`,
              }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <IconTile Icon={Pencil} color={tab.color} size="sm" />
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-ink">وضع التعديل</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={cancelEdit} disabled={savingEdit}
                  className="px-3 py-2 rounded-[10px] border border-line text-muted text-[12px] font-semibold hover:bg-[rgb(var(--c-primary-50))] transition-colors disabled:opacity-60">
                  إلغاء
                </button>
                <button onClick={saveEdit} disabled={savingEdit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-white text-[12px] font-bold transition-opacity disabled:opacity-60"
                  style={{ background: tab.color }}>
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
            <div className="rounded-[14px] border p-3 text-center"
              style={{
                background: `color-mix(in srgb, ${sst.color} 12%, #fff)`,
                borderColor: `color-mix(in srgb, ${sst.color} 28%, #fff)`,
              }}>
              <p className="text-[10.5px] font-semibold opacity-80" style={{ color: sst.color }}>الدرجة</p>
              <p className="text-[21px] font-extrabold tabular-nums leading-none mt-2" style={{ color: sst.color }}>
                {score != null ? score.toFixed(1) : '—'}
                <span className="text-[10.5px] font-semibold opacity-70">/10</span>
              </p>
            </div>
            <div className="rounded-[14px] border p-3 text-center"
              style={{
                background: 'color-mix(in srgb, #15803D 12%, #fff)',
                borderColor: 'color-mix(in srgb, #15803D 28%, #fff)',
              }}>
              <p className="text-[10.5px] font-semibold text-green-700 opacity-80">إجابة «نعم»</p>
              <p className="text-[21px] font-extrabold tabular-nums leading-none mt-2 text-green-700">{yes}</p>
            </div>
            <div className="rounded-[14px] border p-3 text-center"
              style={{
                background: 'color-mix(in srgb, #B91C1C 12%, #fff)',
                borderColor: 'color-mix(in srgb, #B91C1C 28%, #fff)',
              }}>
              <p className="text-[10.5px] font-semibold text-red-700 opacity-80">إجابة «لا»</p>
              <p className="text-[21px] font-extrabold tabular-nums leading-none mt-2 text-red-700">{no}</p>
            </div>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { label: 'المراقب',  val: getObserver(evalDoc),                                 Icon: User,     color: 'rgb(var(--c-primary))' },
              { label: 'المركز',   val: getCenter(evalDoc),                                   Icon: Building2,color: tab.color },
              { label: 'الوقت',    val: fullDate(evalDoc.timestamp),                          Icon: Calendar, color: 'rgb(var(--c-muted))' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-[10px] border border-line p-2.5 flex items-center gap-2.5">
                <IconTile Icon={m.Icon} color={m.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted font-semibold">{m.label}</p>
                  <p className="text-[11.5px] font-semibold text-ink truncate mt-0.5">{m.val || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Score progress bar */}
          {score != null && (
            <div className="bg-white rounded-[10px] border border-line p-3">
              <div className="flex justify-between text-[11.5px] mb-2">
                <span className="text-muted font-semibold">الدرجة الإجمالية</span>
                <span className="font-bold tabular-nums" style={{ color: sst.color }}>{score.toFixed(2)} / 10</span>
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
                <div className="w-1 h-4 rounded-full bg-red-500" />
                <p className="text-[14px] font-bold text-red-700">المخالفات</p>
                <Pill color="#B91C1C">{noQs.length}</Pill>
              </div>
              <ul className="space-y-1.5">
                {noQs.map(q => (
                  <li key={q.id} className="rounded-[10px] border p-3 flex items-start gap-2.5"
                    style={{
                      background: 'color-mix(in srgb, #B91C1C 7%, #fff)',
                      borderColor: 'color-mix(in srgb, #B91C1C 22%, #fff)',
                    }}>
                    <span className="w-6 h-6 rounded-md bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {q.id}
                    </span>
                    <p className="text-[13.5px] text-ink font-medium leading-relaxed flex-1">{q.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All answers */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-1 h-4 rounded-full" style={{ background: tab.color }} />
              <p className="text-[14px] font-bold text-ink">جميع الإجابات</p>
              <Pill color={tab.color}>{tab.allQs.filter(q => ans[q.id]).length} سؤال</Pill>
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
                    className="rounded-[10px] px-3 py-2 border"
                    style={
                      isYes
                        ? { background: 'color-mix(in srgb, #15803D 7%, #fff)', borderColor: 'color-mix(in srgb, #15803D 22%, #fff)' }
                        : isNo
                          ? { background: 'color-mix(in srgb, #B91C1C 7%, #fff)', borderColor: 'color-mix(in srgb, #B91C1C 22%, #fff)' }
                          : { background: '#fff', borderColor: 'rgb(var(--c-line))' }
                    }>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10.5px] font-bold flex-shrink-0 tabular-nums"
                        style={{ color: isYes ? '#15803D' : isNo ? '#B91C1C' : 'rgb(var(--c-muted))' }}>
                        #{q.id}
                      </span>
                      <p className="text-[12.5px] flex-1 min-w-[180px] leading-relaxed"
                        style={{ color: isYes ? '#166534' : isNo ? '#991B1B' : 'rgb(var(--c-ink))' }}>
                        {q.text}
                      </p>
                      {isEditing ? (
                        isChoice ? (
                          <select value={a || ''} onChange={(e) => setAnswer(q.id, e.target.value)}
                            className="text-[11.5px] font-semibold px-2 py-1 rounded-md border bg-white outline-none focus:border-primary"
                            style={{ borderColor: 'rgb(var(--c-line))' }}>
                            <option value="">—</option>
                            {(q.choices || []).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setAnswer(q.id, 'نعم')}
                              className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold border transition-colors ${
                                isYes ? 'bg-green-600 border-green-600 text-white'
                                      : 'bg-white border-line text-muted hover:border-green-400'
                              }`}>
                              نعم
                            </button>
                            <button onClick={() => setAnswer(q.id, 'لا')}
                              className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold border transition-colors ${
                                isNo ? 'bg-red-600 border-red-600 text-white'
                                     : 'bg-white border-line text-muted hover:border-red-400'
                              }`}>
                              لا
                            </button>
                          </div>
                        )
                      ) : (
                        <span className={`text-[10.5px] font-bold flex-shrink-0 flex items-center gap-1 ${
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
                          <p className="mt-1.5 text-[11.5px] font-medium text-muted bg-white border border-line rounded-md px-2 py-1 leading-snug">
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
                                <label className="text-[10px] font-semibold text-muted">{field.label}</label>
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
                              className="bg-white border border-line rounded-md px-2 py-1 flex items-baseline gap-1.5 min-w-0">
                              <span className="text-[10px] font-semibold text-muted shrink-0">{field.label}:</span>
                              <span className="text-[11.5px] font-semibold text-ink truncate tabular-nums">
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
                          <div className="rounded-[10px] border border-dashed border-line bg-[rgb(var(--c-bg))] p-3 text-center">
                            <ImageIcon size={22} className="text-muted/35 mx-auto mb-1.5" weight="duotone" />
                            <p className="text-[11.5px] text-muted font-medium">لا توجد صورة بعد</p>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex items-center gap-1.5">
                            <input type="file" accept="image/*" hidden
                              ref={el => fileInputRefs.current[q.id] = el}
                              onChange={(e) => handlePhotoUpload(q.id, e.target.files?.[0])} />
                            <button onClick={() => fileInputRefs.current[q.id]?.click()}
                              disabled={isUploadingThis}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold border transition-colors disabled:opacity-60"
                              style={{
                                borderColor: `color-mix(in srgb, ${tab.color} 28%, #fff)`,
                                background: `color-mix(in srgb, ${tab.color} 12%, #fff)`,
                                color: tab.color,
                              }}>
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
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
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
