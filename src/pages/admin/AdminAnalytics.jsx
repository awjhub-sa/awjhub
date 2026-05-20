import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db.js';
import {
  ShieldCheck, Mountain, ChevronRight, CheckCircle2, XCircle,
  Sparkles, AlertCircle, User, Calendar, Building2, X, Search, Award,
  TrendingUp, ClipboardList, Trash2,
} from 'lucide-react';
import PageHeader from '../../components/PageHeader.jsx';
import { CENTERS, getCaterer } from '../../config/centers.js';
import { MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';
import { ARAFAT_ALL_CRITERIA } from '../../config/arafatQuestions.js';

const MINA_Qs   = MINA_ALL_CRITERIA;
const ARAFAT_Qs = ARAFAT_ALL_CRITERIA;

const TABS = [
  {
    key:  'mina',
    label: 'مشعر منى',
    short: 'منى',
    col:  'mina_readiness',
    color: '#386B41',
    bg:    '#F0FDF4',
    border:'#86EFAC',
    icon:  Mountain,
    allQs: MINA_Qs,
    gradient: 'linear-gradient(135deg, #4F8856, #386B41)',
  },
  {
    key:  'arafat',
    label: 'مشعر عرفة',
    short: 'عرفة',
    col:  'arafat_readiness',
    color: '#1D6FA4',
    bg:    '#EFF6FF',
    border:'#BFDBFE',
    icon:  Mountain,
    allQs: ARAFAT_Qs,
    gradient: 'linear-gradient(135deg, #2D87C2, #1D6FA4)',
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
  if (score == null) return { color: '#9D8F85', bg: '#F5F0EB', border: '#E8DDD4' };
  if (score >= 8)    return { color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' };
  if (score >= 5)    return { color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' };
  return                     { color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' };
}
const getObserver = d => d.observer || d.observerName || '—';
const getCenter   = d => d.center   || d.centerId     || '—';

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState('mina');
  const [data,      setData]      = useState({ mina: null, arafat: null });
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubs = TABS.map(t =>
      db[t.col].subscribe(rows => {
        const docs = [...rows].sort((a, b) =>
          (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
        setData(prev => ({ ...prev, [t.key]: docs }));
      })
    );
    return () => unsubs.forEach(u => u?.());
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

  /* Aggregate per center */
  const centerSummaries = useMemo(() => {
    const map = new Map();
    docs.forEach(d => {
      const c = getCenter(d);
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(d);
    });
    /* Build summary for every center (even those without evaluations) */
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
      return {
        center:  c.id,
        caterer: c.caterer,
        count:   list.length,
        avgScore,
        latestScore,
        latestDoc,
        totalViolations,
        evaluations: list,
      };
    });
    return all;
  }, [docs]);

  /* Filtered by search term */
  const filteredSummaries = useMemo(() => {
    if (!searchTerm.trim()) return centerSummaries;
    const q = searchTerm.trim().toLowerCase();
    return centerSummaries.filter(s =>
      s.center.toLowerCase().includes(q) ||
      (s.caterer || '').toLowerCase().includes(q)
    );
  }, [centerSummaries, searchTerm]);

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
        title="الجاهزية"
        subtitle="جاهزية مشعر منى ومشعر عرفة — موسم الحج ١٤٤٧ هـ"
      />

      {/* ── Mash'ar tab selector ── */}
      <div className="grid grid-cols-2 gap-3">
        {TABS.map(t => {
          const Icon  = t.icon;
          const active = activeTab === t.key;
          const count  = data[t.key]?.length ?? 0;
          return (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key); setSelectedCenter(null); setSearchTerm(''); }}
              className={`group/tab relative overflow-hidden flex items-center gap-3 px-4 py-4 rounded-3xl border-2 transition-all duration-300 ${
                active
                  ? 'shadow-[0_8px_32px_rgba(45,41,38,0.18)] scale-[1.02]'
                  : 'bg-white border-[#E8E0D8] shadow-[0_2px_12px_rgba(45,41,38,0.04)] hover:shadow-[0_4px_20px_rgba(45,41,38,0.08)] hover:scale-[1.01]'
              }`}
              style={active
                ? { background: t.gradient, borderColor: t.color }
                : { borderColor: '#E8E0D8' }}
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
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </div>
              </div>
              <div className="flex-1 text-right">
                <p className="text-base font-black leading-snug"
                  style={{ color: active ? '#fff' : '#2D2926' }}>
                  جاهزية {t.short}
                </p>
                <p className="text-[11px] font-bold mt-0.5"
                  style={{ color: active ? 'rgba(255,255,255,0.85)' : '#6D6E71' }}>
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
        <div className="bg-white rounded-3xl border border-[#E8E0D8] py-16 text-center shadow-[0_2px_20px_rgba(45,41,38,0.06)]">
          <div className="w-6 h-6 border-2 border-[#A98159]/30 border-t-[#A98159] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#6D6E71] text-sm">جارٍ التحميل...</p>
        </div>
      ) : selectedCenter && activeSummary ? (
        /* ─── Center Detail View ─── */
        <CenterDetail
          tab={tab}
          summary={activeSummary}
          onBack={() => setSelectedCenter(null)}
        />
      ) : (
        <>
          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'مراكز مُقيَّمة',  value: `${evaluated}/${CENTERS.length}`, color: tab.color, icon: ClipboardList },
              { label: 'متوسط الدرجات',  value: overallAvg ? `${overallAvg}/10` : '—', color: '#A98159', icon: TrendingUp },
              { label: 'تقييمات ممتازة', value: perfectCnt,                      color: '#15803D', icon: Award },
              { label: 'إجمالي مخالفات', value: totalViols,                      color: totalViols > 0 ? '#B91C1C' : '#15803D', icon: AlertCircle },
            ].map(c => (
              <div key={c.label}
                className="bg-white rounded-2xl p-4 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)] flex items-center gap-3"
                style={{ borderRight: `3px solid ${c.color}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-[#9D8F85] mb-0.5">{c.label}</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.color}18` }}>
                  <c.icon size={18} style={{ color: c.color }} strokeWidth={1.75} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Search bar ── */}
          <div className="relative">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9D8F85]" strokeWidth={2} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالمركز أو المتعهد..."
              className="w-full pr-11 pl-4 py-3 rounded-2xl border-2 border-[#EDE5DC] bg-white text-sm font-medium text-[#2D2926] placeholder:text-[#C9B8A8] focus:border-[#A98159] focus:outline-none transition-colors shadow-[0_2px_8px_rgba(45,41,38,0.05)]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-[#9D8F85] hover:bg-[#F5F0EB] transition-colors">
                <X size={14} strokeWidth={2.25} />
              </button>
            )}
          </div>

          {/* ── Centers grid ── */}
          {filteredSummaries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#E8E0D8] py-16 text-center shadow-[0_2px_20px_rgba(45,41,38,0.06)]">
              <div className="relative w-fit mx-auto mb-3 group">
                <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 group-hover:opacity-60 transition-opacity"
                  style={{ background: tab.color }} />
                <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: `${tab.color}1A` }}>
                  <Search size={22} style={{ color: tab.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-[#6D6E71] font-medium">لا توجد مراكز تطابق البحث</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSummaries.map(s => (
                <CenterCard key={s.center} summary={s} tab={tab}
                  onSelect={() => setSelectedCenter(s.center)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CenterCard({ summary, tab, onSelect }) {
  const sst = scoreStyle(summary.avgScore);
  const hasData = summary.count > 0;
  const centerNum = (summary.center.match(/\d+\S*/) || ['—'])[0];

  return (
    <button
      onClick={onSelect}
      disabled={!hasData}
      className={`text-right group bg-white rounded-2xl border-2 p-4 transition-all ${
        hasData
          ? 'border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)] hover:shadow-[0_6px_24px_rgba(169,129,89,0.18)] hover:border-[#D9CEBC] hover:-translate-y-0.5 cursor-pointer'
          : 'border-dashed border-[#EDE5DC] bg-[#FAFAF8] opacity-70 cursor-not-allowed'
      }`}
    >
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
              : { background: '#F5F0EB', border: '1px dashed #D9CEBC' }}>
            <span className="text-sm font-black tabular-nums"
              style={{ color: hasData ? '#fff' : '#9D8F85' }}>
              {centerNum}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#2D2926] truncate">{summary.center}</p>
          <p className="text-[10px] text-[#A98159] font-bold truncate mt-0.5">{summary.caterer || '—'}</p>
          {hasData && summary.latestDoc?.timestamp && (
            <p className="text-[9px] text-[#9D8F85] font-bold mt-1 flex items-center gap-1">
              <Calendar size={9} strokeWidth={2.25} />
              {timeAgo(summary.latestDoc.timestamp)}
            </p>
          )}
        </div>
        {hasData && (
          <ChevronRight size={16} className="text-[#C9B8A8] group-hover:text-[#A98159] transition-colors shrink-0 mt-1"
            strokeWidth={2.25} />
        )}
      </div>

      {/* Body */}
      {hasData ? (
        <>
          {/* Score chip */}
          <div className="rounded-xl p-3 border-2 flex items-center justify-between mb-2.5"
            style={{ background: sst.bg, borderColor: sst.border }}>
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: sst.color }} strokeWidth={2.25} />
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
            <div className="rounded-lg border border-[#EDE5DC] bg-[#FAFAF8] p-2">
              <div className="flex items-center gap-1 text-[#A98159] mb-0.5">
                <User size={9} strokeWidth={2.5} />
                <span className="text-[9px] font-bold">المراقب</span>
              </div>
              <p className="text-[10px] font-bold text-[#2D2926] truncate">
                {getObserver(summary.latestDoc)}
              </p>
            </div>
            <div className="rounded-lg border p-2"
              style={summary.totalViolations > 0
                ? { background: '#FEF2F2', borderColor: '#FCA5A5' }
                : { background: '#F0FDF4', borderColor: '#86EFAC' }}>
              <div className="flex items-center gap-1 mb-0.5"
                style={{ color: summary.totalViolations > 0 ? '#B91C1C' : '#15803D' }}>
                <AlertCircle size={9} strokeWidth={2.5} />
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
        <div className="rounded-xl border border-dashed border-[#E8DDD4] bg-white p-3 text-center">
          <div className="w-8 h-8 rounded-full bg-[#F5F0EB] flex items-center justify-center mx-auto mb-1.5">
            <ClipboardList size={14} className="text-[#C9B8A8]" strokeWidth={2} />
          </div>
          <p className="text-[10px] font-bold text-[#9D8F85]">لم يُقيَّم بعد</p>
        </div>
      )}
    </button>
  );
}

function CenterDetail({ tab, summary, onBack }) {
  const [openEval, setOpenEval] = useState(summary.evaluations[0]?.id || null);
  const centerNum = (summary.center.match(/\d+\S*/) || ['—'])[0];
  const sst = scoreStyle(summary.avgScore);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-[#FDF8F0] border border-[#E8DDD4] rounded-2xl p-4 flex items-center gap-3 shadow-[0_2px_8px_rgba(45,41,38,0.07)]">
        <button onClick={onBack}
          className="min-w-[40px] min-h-[40px] rounded-xl border border-[#D9CEBC] bg-white text-[#A98159] flex items-center justify-center hover:bg-[#FDF8F0] hover:border-[#A98159] transition-all shrink-0"
          title="رجوع">
          <X size={16} strokeWidth={2.25} />
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
            <p className="text-base font-black text-[#2D2926] truncate">{summary.center}</p>
            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border"
              style={{ background: tab.bg, borderColor: tab.border, color: tab.color }}>
              <tab.icon size={9} strokeWidth={2.5} />
              {tab.label}
            </span>
          </div>
          <p className="text-[11px] text-[#A98159] font-bold mt-0.5 truncate">{summary.caterer || '—'}</p>
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
            onToggle={() => setOpenEval(openEval === ev.id ? null : ev.id)}
            onDelete={() => handleDeleteEval(ev.id)} />
        ))}
      </div>
    </div>
  );
}

function EvaluationCard({ evalDoc, tab, index, isOpen, onToggle, onDelete }) {
  const score = getScore(evalDoc);
  const sst   = scoreStyle(score);
  const ans     = evalDoc.answers || {};
  const photos  = ans.__photos || {};
  const detailsMap = ans.__details || {};
  const yes     = tab.allQs.filter(q => ans[q.id] === 'نعم').length;
  const no      = tab.allQs.filter(q => ans[q.id] === 'لا').length;
  const noQs    = tab.allQs.filter(q => ans[q.id] === 'لا');

  return (
    <div className="bg-white rounded-2xl border-2 overflow-hidden shadow-[0_2px_12px_rgba(45,41,38,0.07)]"
      style={{ borderColor: isOpen ? sst.border : '#EDE5DC' }}>
      {/* Header row — always visible */}
      <button onClick={onToggle}
        className="w-full text-right px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-[#FDFAF7] transition-colors">
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
            {no > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700">
                <AlertCircle size={10} strokeWidth={2.5} />
                {no} مخالفة
              </span>
            )}
            {no === 0 && score != null && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-green-50 border border-green-200 text-green-700">
                <CheckCircle2 size={10} strokeWidth={2.5} />
                بدون مخالفات
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-[#6D6E71]">
            <span className="flex items-center gap-1">
              <User size={11} strokeWidth={2.25} className="text-[#A98159]" />
              <span className="font-bold text-[#2D2926]">{getObserver(evalDoc)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={11} strokeWidth={2.25} className="text-[#A98159]" />
              <span className="font-bold">{fullDate(evalDoc.timestamp)}</span>
            </span>
          </div>
        </div>
        {/* Delete + Chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete?.(); } }}
            title="حذف التقييم"
            className="w-8 h-8 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center cursor-pointer hover:bg-red-500 hover:border-red-500 group/del transition-colors"
          >
            <Trash2 size={13} className="text-red-500 group-hover/del:text-white" strokeWidth={2.25} />
          </span>
          <div className="w-8 h-8 rounded-lg border border-[#EDE5DC] flex items-center justify-center transition-transform"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight size={14} className="text-[#A98159]" strokeWidth={2.25} />
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isOpen && (
        <div className="border-t border-[#EDE5DC] bg-[#FDFCFB] px-4 sm:px-5 py-4 space-y-4">
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
              { label: 'المراقب',  val: getObserver(evalDoc),                                 Icon: User,     color: '#A98159' },
              { label: 'المركز',   val: getCenter(evalDoc),                                   Icon: Building2,color: tab.color },
              { label: 'الوقت',    val: fullDate(evalDoc.timestamp),                          Icon: Calendar, color: '#6D6E71' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-xl border border-[#EDE5DC] p-2.5 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${m.color}15` }}>
                  <m.Icon size={12} style={{ color: m.color }} strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-[#9D8F85] font-bold">{m.label}</p>
                  <p className="text-[11px] font-bold text-[#2D2926] truncate">{m.val || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Score progress bar */}
          {score != null && (
            <div className="bg-white rounded-xl border border-[#EDE5DC] p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#6D6E71] font-bold">الدرجة الإجمالية</span>
                <span className="font-black tabular-nums" style={{ color: sst.color }}>{score.toFixed(2)} / 10</span>
              </div>
              <div className="h-2 bg-[#F5F0EB] rounded-full overflow-hidden">
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
                    <p className="text-sm text-[#2D2926] font-medium leading-relaxed flex-1">{q.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All answers */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-1.5 h-5 rounded-full" style={{ background: tab.color }} />
              <p className="text-sm font-black text-[#2D2926]">جميع الإجابات</p>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full tabular-nums"
                style={{ background: tab.bg, color: tab.color, border: `1px solid ${tab.border}` }}>
                {tab.allQs.filter(q => ans[q.id]).length} سؤال
              </span>
            </div>
            <div className="space-y-1.5">
              {tab.allQs.map(q => {
                const a = ans[q.id];
                if (!a) return null;
                const isYes = a === 'نعم';
                const isNo  = a === 'لا';
                const photoUrl = photos[q.id];
                const detail   = detailsMap[q.id];
                return (
                  <div key={q.id}
                    className={`rounded-xl px-3 py-2 border ${
                      isYes ? 'bg-green-50/60 border-green-200/70'
                      : isNo ? 'bg-red-50/60 border-red-200/70'
                      :        'bg-white border-[#EDE5DC]'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black flex-shrink-0 tabular-nums"
                        style={{ color: isYes ? '#15803D' : isNo ? '#B91C1C' : '#6D6E71' }}>
                        #{q.id}
                      </span>
                      <p className="text-xs flex-1 leading-relaxed"
                        style={{ color: isYes ? '#166534' : isNo ? '#991B1B' : '#2D2926' }}>
                        {q.text}
                      </p>
                      <span className={`text-[10px] font-black flex-shrink-0 flex items-center gap-0.5 ${
                        isYes ? 'text-green-700' : isNo ? 'text-red-700' : 'text-[#6D6E71]'
                      }`}>
                        {isYes
                          ? <CheckCircle2 size={12} strokeWidth={2.25} />
                          : isNo ? <XCircle size={12} strokeWidth={2.25} /> : null}
                        {a}
                      </span>
                    </div>
                    {detail && (
                      <p className="mt-1.5 text-[11px] text-[#6D6E71] bg-white border border-[#EDE5DC] rounded px-2 py-1 leading-snug">
                        {detail}
                      </p>
                    )}
                    {photoUrl && (
                      <a href={photoUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                        <img src={photoUrl} alt={`q${q.id}`}
                          className="rounded-lg border border-[#EDE5DC] max-h-44 object-cover hover:opacity-90 transition-opacity" />
                      </a>
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
