import { useEffect, useState, useMemo } from 'react';
import { db } from '../../lib/db.js';
import { CENTERS } from '../../config/centers.js';
import {
  Activity, CheckCircle2, Clock, Layers, RotateCcw, ImageIcon, X, Trash2,
  Flame, Package, ShieldCheck, Sparkles, AlertCircle, User,
} from 'lucide-react';
import { MEAL_QUESTIONS } from '../../config/mealQuestions.js';
import { Coffee, ForkKnife, Moon } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { extractCenterNum, extractDay } from '../../hooks/useAssignedTasks.js';

/* Meal category metadata — matches what's stored under assigned_tasks.mealCategories */
const MEAL_CATEGORY_META = {
  cooked:     { label: 'مطبوخة', Icon: Flame,       color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  dry:        { label: 'جافة',   Icon: Package,     color: '#A98159', bg: '#FDF8F0', border: '#E8DDD4' },
  sterilized: { label: 'معقمة',  Icon: ShieldCheck, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
};

/* Normalize a meal_evaluation record's score to /10 — same 3-way fallback
   used everywhere else in the app. */
function getEvalScore(rec) {
  if (!rec) return null;
  if (rec.scoreOutOf10 != null) return Number(rec.scoreOutOf10);
  const max = Number(rec.maxScore);
  const tot = Number(rec.totalScore);
  if (max > 0 && !isNaN(tot)) return parseFloat(((tot / max) * 10).toFixed(1));
  const pct = parseFloat(rec.percentage);
  if (!isNaN(pct)) return parseFloat((pct / 10).toFixed(1));
  return null;
}
function scoreStyle(score) {
  if (score == null) return { color: '#9D8F85', bg: '#F5F0EB', border: '#E8DDD4' };
  if (score >= 8)    return { color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' };
  if (score >= 5)    return { color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' };
  return                     { color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' };
}

const PHASES = [
  { id: 1, label: 'التجهيز',  short: 'تجهيز', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', glow: 'rgba(245,158,11,0.45)' },
  { id: 2, label: 'الطبخ',    short: 'طبخ',   color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5', glow: 'rgba(239,68,68,0.45)'  },
  { id: 3, label: 'التوزيع',  short: 'توزيع', color: '#10B981', bg: '#F0FDF4', border: '#6EE7B7', glow: 'rgba(16,185,129,0.45)' },
];

const MEALS = [
  { id: 'breakfast', label: 'الإفطار', icon: Coffee,    color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'lunch',     label: 'الغداء',  icon: ForkKnife, color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5' },
  { id: 'dinner',    label: 'العشاء',  icon: Moon,      color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
];

const DAYS = [
  { id: '7',  label: '٧ ذو الحجة'  },
  { id: '8',  label: '٨ ذو الحجة'  },
  { id: '9',  label: '٩ ذو الحجة'  },
  { id: '10', label: '١٠ ذو الحجة' },
  { id: '11', label: '١١ ذو الحجة' },
  { id: '12', label: '١٢ ذو الحجة' },
  { id: '13', label: '١٣ ذو الحجة' },
];

// دالة الوقت المحسنة لمنع الانهيار
function fmtTime(ts) {
  if (!ts) return null;
  try {
    const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return null;
  }
}

function PhotoLightbox({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
        <X size={20} strokeWidth={2} />
      </button>
      <div onClick={e => e.stopPropagation()}>
        <img src={src} alt="" className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl object-contain" />
      </div>
    </div>
  );
}

function PhaseDot({ done, phase, small, photoUrl, onViewPhoto }) {
  const size = small ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]';
  return (
    <div className="relative group">
      <div
        className={`${size} rounded-full flex items-center justify-center font-black transition-all cursor-default`}
        style={done
          ? { background: phase.color, color: '#fff', boxShadow: `0 0 8px ${phase.glow}` }
          : { background: '#F3F4F6', color: '#D1D5DB' }
        }
      >
        {done ? <CheckCircle2 size={small ? 11 : 13} strokeWidth={2.5} /> : phase.id}
      </div>
      {done && photoUrl && (
        <button
          onClick={() => onViewPhoto(photoUrl)}
          title="عرض الصورة"
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ background: phase.color }}>
          <ImageIcon size={8} strokeWidth={2.5} className="text-white" />
        </button>
      )}
    </div>
  );
}

export default function AdminPhases() {
  const [phasesData,   setPhasesData]   = useState({});
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [selectedDay,  setSelectedDay]  = useState('7');
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [sortBy,       setSortBy]       = useState('progress');
  const [lightboxSrc,  setLightboxSrc]  = useState(null);
  const [evalDetail,   setEvalDetail]   = useState(null);
  const [view,         setView]         = useState('phases');  // 'phases' | 'reports'
  const [reportCenter, setReportCenter] = useState(null);      // center selected in reports view
  
  // حالات المسح (التي كانت ناقصة وتسبب الخطأ)
  const [clearConfirm,    setClearConfirm]    = useState(false);
  const [clearing,        setClearing]        = useState(false);
  const [mealClearTarget, setMealClearTarget] = useState(null);
  const [mealClearing,    setMealClearing]    = useState(false);
  const [centerClearConfirm, setCenterClearConfirm] = useState(null);
  const [centerClearing,     setCenterClearing]     = useState(false);

  /* Reset confirm states whenever day or meal changes */
  useEffect(() => {
    setClearConfirm(false);
    setMealClearTarget(null);
    if (typeof setCenterClearConfirm === 'function') setCenterClearConfirm(null);
  }, [selectedDay, selectedMeal]);

  const handleClearDay = async () => {
    setClearing(true);
    try {
      const ids = [];
      CENTERS.forEach(c => {
        MEALS.forEach(m => {
          const docId = `${c.id}_d${selectedDay}_${m.id}`;
          if (phasesData[docId]) ids.push(docId);
        });
      });
      await db.meal_phases.deleteMany(ids);
    } catch {}
    setClearing(false);
    setClearConfirm(false);
  };

  const handleClearMeal = async () => {
    if (!mealClearTarget) return;
    setMealClearing(true);
    try {
      await db.meal_phases.delete(`${mealClearTarget.center}_d${selectedDay}_${mealClearTarget.mealId}`);
    } catch {}
    setMealClearing(false);
    setMealClearTarget(null);
  };

  const handleClearCenter = async (centerId) => {
    setCenterClearing(true);
    try {
      const ids = MEALS.map(m => `${centerId}_d${selectedDay}_${m.id}`);
      await db.meal_phases.deleteMany(ids);
    } catch(e) {}
    setCenterClearing(false);
    setCenterClearConfirm(null);
  };

  useEffect(() => {
    return db.meal_phases.subscribe(rows => {
      const map = {};
      rows.forEach(d => { map[d.id] = d; });
      setPhasesData(map);
    });
  }, []);

  useEffect(() => {
    return db.assigned_tasks.subscribe(rows => setAssignedTasks(rows));
  }, []);

  const [mealEvals, setMealEvals] = useState([]);
  useEffect(() => {
    return db.meal_evaluations.subscribe(rows => setMealEvals(rows));
  }, []);

  /* Map: centerNum → Set<category> for the selected day's meal-evaluation tasks. */
  const centerCategories = useMemo(() => {
    const map = new Map();
    assignedTasks.forEach(t => {
      const types = t.taskTypes || [];
      if (!types.includes('meal_evaluation')) return;
      if (extractDay(t.scheduledDate) !== String(selectedDay)) return;
      const cats = t.mealCategories || [];
      (t.targetCenters || []).forEach(cn => {
        const key = Number(cn);
        if (!map.has(key)) map.set(key, new Set());
        cats.forEach(c => map.get(key).add(c));
      });
    });
    return map;
  }, [assignedTasks, selectedDay]);

  const getCell = (center, day, mealId) =>
    phasesData[`${center}_d${day}_${mealId}`] || {};

  const cellDone = (data) => [1, 2, 3].filter(n => !!data[`phase${n}`]).length;

  /* Lookup: (center, day, mealType) → meal_evaluation doc */
  const evalLookup = useMemo(() => {
    const map = new Map();
    mealEvals.forEach(e => {
      const day = extractDay(e.scheduledDate ?? e.scheduledDate ?? '');
      const key = `${e.center}|${day}|${e.mealType}`;
      map.set(key, e);
    });
    return map;
  }, [mealEvals]);

  const rows = useMemo(() => {
    /* Each row reflects the SELECTED meal only — focused single-meal view */
    const list = CENTERS.map(c => {
      const data = getCell(c.id, selectedDay, selectedMeal);
      const total = cellDone(data);
      const evalDoc = evalLookup.get(`${c.id}|${selectedDay}|${selectedMeal}`);
      return { center: c.id, caterer: c.caterer, total, data, evalDoc };
    });
    if (sortBy === 'progress') return [...list].sort((a, b) => b.total - a.total);
    return list;
  }, [phasesData, selectedDay, selectedMeal, sortBy, evalLookup]);

  const maxDone = PHASES.length; // 3 phases for a single meal
  const fullyDone  = rows.filter(r => r.total === maxDone).length;
  const inProgress = rows.filter(r => r.total > 0 && r.total < maxDone).length;
  const notStarted = rows.filter(r => r.total === 0).length;
  const overallPct = Math.round((rows.reduce((s, r) => s + r.total, 0) / (rows.length * maxDone)) * 100) || 0;

  /* Selected-meal meta (label, icon, color) for the header strip + progress bar */
  const mealMeta = MEALS.find(m => m.id === selectedMeal) || MEALS[0];

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <PageHeader
        Icon={Activity}
        title="المراحل الميدانية"
        subtitle="متابعة مراحل تجهيز وطبخ وتوزيع الوجبات — تحديث فوري"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy(s => s === 'progress' ? 'center' : 'progress')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D9CEBC] bg-white text-[#2D2926] text-xs font-bold hover:border-[#A98159] hover:bg-[#FDF8F0] transition-all flex-shrink-0"
            >
              <RotateCcw size={13} strokeWidth={2} className="text-[#A98159]" />
              {sortBy === 'progress' ? 'ترتيب حسب التقدم' : 'ترتيب حسب المركز'}
            </button>
            {!clearConfirm ? (
              <button
                onClick={() => setClearConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-white text-red-500 text-xs font-bold hover:border-red-400 hover:bg-red-50 transition-all flex-shrink-0"
              >
                <Trash2 size={13} strokeWidth={2} />
                مسح بيانات اليوم
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearDay}
                  disabled={clearing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-all disabled:opacity-60 flex-shrink-0"
                >
                  <Trash2 size={12} strokeWidth={2} />
                  {clearing ? 'جاري...' : 'تأكيد'}
                </button>
                <button
                  onClick={() => setClearConfirm(false)}
                  className="px-3 py-2 rounded-xl border border-[#D9CEBC] bg-white text-[#6D6E71] text-xs font-bold hover:bg-[#F5F0EB] transition-all flex-shrink-0"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* View switcher: المتابعة (phases) vs التقارير (reports) */}
      <div className="bg-white border border-[#EDE5DC] rounded-2xl p-1.5 flex w-fit shadow-[0_2px_8px_rgba(45,41,38,0.05)]">
        {[
          { id: 'phases',  label: 'المتابعة الميدانية', Icon: Activity },
          { id: 'reports', label: 'التقارير',           Icon: ImageIcon },
        ].map(t => {
          const TIcon = t.Icon;
          const active = view === t.id;
          return (
            <button key={t.id}
              onClick={() => { setView(t.id); setReportCenter(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                active
                  ? 'text-white shadow-[0_3px_10px_rgba(169,129,89,0.4)]'
                  : 'text-[#6D6E71] hover:text-[#2D2926] hover:bg-[#FDF8F0]'
              }`}
              style={active ? { background: 'linear-gradient(135deg, #C4A46E, #A98159)' } : undefined}
            >
              <TIcon size={15} strokeWidth={2.25} className={active ? 'scale-110' : ''} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Day Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {DAYS.map(day => (
          <button
            key={day.id}
            onClick={() => setSelectedDay(day.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              selectedDay === day.id
                ? 'bg-[#2D2926] text-white border-[#2D2926] shadow-md'
                : 'bg-white text-[#6D6E71] border-[#D9CEBC] hover:border-[#A98159] hover:text-[#A98159]'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      {view === 'phases' && <>

      {/* Meal filter chips */}
      <div className="flex gap-2 flex-wrap">
        {MEALS.map(meal => {
          const MIcon = meal.icon;
          const active = selectedMeal === meal.id;
          /* Compute count of completed meals for this meal type across centers */
          const doneCount = CENTERS.filter(c =>
            cellDone(getCell(c.id, selectedDay, meal.id)) === PHASES.length
          ).length;
          return (
            <button
              key={meal.id}
              onClick={() => setSelectedMeal(meal.id)}
              className={`group/meal flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${
                active ? 'scale-[1.02] shadow-md' : 'bg-white hover:scale-[1.01]'
              }`}
              style={active
                ? {
                    background: `linear-gradient(135deg, ${meal.color}, ${meal.color}DD)`,
                    borderColor: meal.color,
                    color: '#fff',
                    boxShadow: `0 4px 16px ${meal.color}40`,
                  }
                : { borderColor: '#E8DDD4', color: '#6D6E71' }}
            >
              <MIcon
                size={18}
                weight={active ? 'fill' : 'bold'}
                className={`transition-transform ${active ? 'scale-110' : 'group-hover/meal:scale-110'}`}
                style={!active ? { color: meal.color } : undefined}
              />
              {meal.label}
              <span className={`tabular-nums px-2 py-0.5 rounded-full text-[10px] ${
                active ? 'bg-white/25 text-white' : ''
              }`}
                style={!active ? { background: `${meal.color}15`, color: meal.color } : undefined}>
                {doneCount}/{CENTERS.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المراكز',  value: rows.length, color: '#6366F1', icon: Layers       },
          { label: 'مكتمل الوجبات',   value: fullyDone,   color: '#10B981', icon: CheckCircle2 },
          { label: 'قيد التنفيذ',     value: inProgress,  color: '#F59E0B', icon: Activity     },
          { label: 'لم يبدأ',         value: notStarted,  color: '#9D8F85', icon: Clock        },
        ].map(c => (
          <div key={c.label}
            className="bg-white rounded-2xl p-4 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)] flex items-center gap-3"
            style={{ borderRight: `3px solid ${c.color}` }}>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-0.5">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${c.color}18` }}>
              <c.icon size={18} style={{ color: c.color }} strokeWidth={1.75} />
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl px-6 py-4 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)]"
        style={{ borderRight: `4px solid ${mealMeta.color}` }}>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${mealMeta.color}15` }}>
              <mealMeta.icon size={16} weight="bold" style={{ color: mealMeta.color }} />
            </div>
            <p className="text-sm font-bold text-[#2D2926]">
              {mealMeta.label} — {DAYS.find(d => d.id === selectedDay)?.label}
            </p>
          </div>
          <p className="text-lg font-black tabular-nums" style={{ color: mealMeta.color }}>{overallPct}%</p>
        </div>
        <div className="h-3 bg-[#F5F0EB] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${overallPct}%`,
              background: overallPct === 100 ? '#10B981' : overallPct > 50 ? '#F59E0B' : mealMeta.color,
            }}
          />
        </div>
      </div>

      {/* Table — one row per center, columns for each of the 3 phases of the selected meal */}
      <div className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgba(169,129,89,0.14)] overflow-hidden">
        <div className="grid gap-3 px-5 py-3 border-b border-[#EDE5DC] bg-[#FAFAF8]"
          style={{ gridTemplateColumns: '1.6fr repeat(3, 1fr) 0.7fr 0.9fr 0.5fr' }}>
          <p className="text-[11px] font-bold text-[#9D8F85]">المركز / المتعهد</p>
          {PHASES.map(phase => (
            <div key={phase.id} className="flex items-center justify-center gap-1.5">
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white"
                style={{ background: phase.color }}>
                {phase.id}
              </span>
              <p className="text-[11px] font-bold text-[#9D8F85]">{phase.label}</p>
            </div>
          ))}
          <p className="text-[11px] font-bold text-[#9D8F85] text-center">التقدم</p>
          <p className="text-[11px] font-bold text-[#9D8F85] text-center">تقييم الوجبة</p>
          <p className="text-[11px] font-bold text-[#9D8F85] text-center">إجراء</p>
        </div>

        {rows.map((row, idx) => {
          const isLast = idx === rows.length - 1;
          const pct = Math.round((row.total / maxDone) * 100);
          const data = row.data;
          const isTarget = mealClearTarget?.center === row.center && mealClearTarget?.mealId === selectedMeal;
          return (
            <div
              key={row.center}
              className={`grid gap-3 px-5 py-3.5 items-center group/row hover:bg-[#FDFAF7] transition-colors ${!isLast ? 'border-b border-[#EDE5DC]' : ''}`}
              style={{ gridTemplateColumns: '1.6fr repeat(3, 1fr) 0.7fr 0.9fr 0.5fr' }}
            >
              {/* Center info */}
              <div className="min-w-0 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${mealMeta.color}15`, border: `1px solid ${mealMeta.color}30` }}>
                  <span className="text-[11px] font-black tabular-nums" style={{ color: mealMeta.color }}>
                    {(row.center.match(/\d+/) || ['—'])[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-sm text-[#2D2926] truncate">{row.center}</p>
                    {/* Meal category chips for this center on this day */}
                    {[...(centerCategories.get(extractCenterNum(row.center)) || [])].map(cat => {
                      const meta = MEAL_CATEGORY_META[cat];
                      if (!meta) return null;
                      const CIcon = meta.Icon;
                      return (
                        <span key={cat}
                          className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border"
                          style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
                          title={`نوع الوجبة: ${meta.label}`}
                        >
                          <CIcon size={9} strokeWidth={2.5} />
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[#A98159] font-bold truncate">{row.caterer}</p>
                </div>
              </div>

              {/* Phase cells — one column per phase */}
              {PHASES.map(phase => {
                const done = !!data[`phase${phase.id}`];
                const time = fmtTime(data[`phase${phase.id}`]);
                const photoUrl = data[`phase${phase.id}Photo`] || null;
                return (
                  <div key={phase.id} className="flex flex-col items-center gap-1.5">
                    <PhaseDot
                      done={done}
                      phase={phase}
                      photoUrl={photoUrl}
                      onViewPhoto={setLightboxSrc}
                    />
                    {done ? (
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: phase.color }}>
                        {time}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#D1D5DB]">—</span>
                    )}
                    {done && photoUrl && (
                      <button
                        onClick={() => setLightboxSrc(photoUrl)}
                        className="text-[9px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md hover:bg-[#FDF8F0] transition-colors"
                        style={{ color: phase.color }}
                        title="عرض الصورة"
                      >
                        <ImageIcon size={9} strokeWidth={2.5} />
                        صورة
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Progress */}
              <div className="text-center">
                <p className="text-base font-black tabular-nums"
                  style={{ color: pct === 100 ? '#10B981' : pct > 0 ? '#F59E0B' : '#D1D5DB' }}>
                  {pct}%
                </p>
                <p className="text-[9px] text-[#9D8F85] mt-0.5">{row.total}/{maxDone}</p>
              </div>

              {/* Meal evaluation score */}
              <div className="flex justify-center">
                {(() => {
                  const score  = getEvalScore(row.evalDoc);
                  const style  = scoreStyle(score);
                  const noAns  = row.evalDoc?.answers
                    ? Object.values(row.evalDoc.answers).filter(v => v === 'لا').length
                    : 0;
                  if (!row.evalDoc) {
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border"
                        style={{ background: style.bg, borderColor: style.border, color: style.color }}>
                        لم يُقيَّم
                      </span>
                    );
                  }
                  return (
                    <button
                      onClick={() => setEvalDetail(row.evalDoc)}
                      className="group/eval flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95"
                      style={{ background: style.bg, borderColor: style.border }}
                      title="عرض تفاصيل التقييم"
                    >
                      <div className="flex items-center gap-1">
                        <Sparkles size={9} style={{ color: style.color }} />
                        <span className="text-[13px] font-black tabular-nums leading-none"
                          style={{ color: style.color }}>
                          {score != null ? score.toFixed(1) : '—'}
                          <span className="text-[9px] opacity-70">/10</span>
                        </span>
                      </div>
                      {noAns > 0 && (
                        <span className="text-[8px] font-bold text-red-600 mt-0.5">
                          {noAns} مخالفة
                        </span>
                      )}
                    </button>
                  );
                })()}
              </div>

              {/* Action — delete this meal for this center */}
              <div className="flex justify-center">
                {row.total > 0 ? (
                  isTarget ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleClearMeal}
                        disabled={mealClearing}
                        className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center disabled:opacity-60 transition-colors"
                        title="تأكيد الحذف"
                      >
                        <Trash2 size={11} className="text-white" strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => setMealClearTarget(null)}
                        className="w-7 h-7 rounded-lg border border-[#D9CEBC] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors"
                        title="إلغاء"
                      >
                        <X size={11} className="text-[#9D8F85]" strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setMealClearTarget({ center: row.center, mealId: selectedMeal })}
                      className="w-7 h-7 rounded-lg border border-[#EDE5DC] flex items-center justify-center hover:border-red-300 hover:bg-red-50 transition-colors"
                      title="حذف بيانات هذه الوجبة"
                    >
                      <Trash2 size={11} className="text-[#C9B8A8] hover:text-red-400 transition-colors" strokeWidth={2} />
                    </button>
                  )
                ) : (
                  <span className="text-[10px] text-[#D1D5DB]">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      </>}

      {}
      {view === 'reports' && !reportCenter && (
        <ReportsCenterList
          centers={CENTERS}
          selectedDay={selectedDay}
          phasesData={phasesData}
          evalLookup={evalLookup}
          centerCategories={centerCategories}
          onSelect={setReportCenter}
        />
      )}
      {view === 'reports' && reportCenter && (
        <CenterReport
          center={reportCenter}
          selectedDay={selectedDay}
          phasesData={phasesData}
          evalLookup={evalLookup}
          centerCategories={centerCategories}
          onBack={() => setReportCenter(null)}
          onViewPhoto={setLightboxSrc}
          onViewEval={setEvalDetail}
        />
      )}

      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {evalDetail && <EvalDetailModal record={evalDetail} onClose={() => setEvalDetail(null)} />}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

function EvalDetailModal({ record, onClose }) {
  if (!record) return null;
  const score = (() => {
    if (record.scoreOutOf10 != null) return Number(record.scoreOutOf10);
    const max = Number(record.maxScore);
    const tot = Number(record.totalScore);
    if (max > 0 && !isNaN(tot)) return parseFloat(((tot / max) * 10).toFixed(1));
    const pct = parseFloat(record.percentage);
    if (!isNaN(pct)) return parseFloat((pct / 10).toFixed(1));
    return null;
  })();

  const ans = record.answers || {};
  const photos = ans.__photos || {};
  const yes = MEAL_QUESTIONS.filter(q => ans[q.id] === 'نعم').length;
  const no  = MEAL_QUESTIONS.filter(q => ans[q.id] === 'لا').length;
  const qsById = new Map(MEAL_QUESTIONS.map(q => [String(q.id), q]));
  const noQs = Object.entries(ans)
    .filter(([k, v]) => v === 'لا' && !String(k).startsWith('__'))
    .map(([k]) => qsById.get(String(k)))
    .filter(Boolean);
  const mealLabel = MEALS.find(m => m.id === record.mealType)?.label || record.mealType;

  const style = (s) => {
    if (s == null) return { color: '#9D8F85', bg: '#F5F0EB' };
    if (s >= 8)    return { color: '#15803D', bg: '#F0FDF4' };
    if (s >= 5)    return { color: '#B45309', bg: '#FFFBEB' };
    return            { color: '#B91C1C', bg: '#FEF2F2' };
  };
  const st = style(score);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-[#FDF8F0] to-white px-6 py-4 border-b border-[#EDE5DC] flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl blur-md opacity-50"
                style={{ background: st.color }} />
              <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg tabular-nums shadow-md"
                style={{ background: st.bg, color: st.color, border: `2px solid ${st.color}40` }}>
                {score != null ? score.toFixed(1) : '—'}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#2D2926] truncate">تقييم الوجبة</h2>
              <p className="text-[11px] text-[#9D8F85] mt-0.5 truncate">
                {record.center} · {mealLabel} · {record.scheduledDate}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[#EDE5DC] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors shrink-0">
            <X size={15} className="text-[#6D6E71]" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border-2 p-3 text-center"
              style={{ background: st.bg, borderColor: `${st.color}40` }}>
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-1">الدرجة /10</p>
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: st.color }}>
                {score != null ? score.toFixed(1) : '—'}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-3 text-center">
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-1">إجابة «نعم»</p>
              <p className="text-2xl font-extrabold tabular-nums text-green-700">{yes}</p>
            </div>
            <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-center">
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-1">إجابة «لا»</p>
              <p className="text-2xl font-extrabold tabular-nums text-red-700">{no}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="bg-[#FDF8F0] border border-[#E8DDD4] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#A98159]/30 flex items-center justify-center shrink-0">
              <User size={15} className="text-[#A98159]" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-[#9D8F85] font-semibold">المراقب</p>
              <p className="text-sm font-bold text-[#2D2926] truncate">
                {record.observer || record.observerName || '—'}
              </p>
            </div>
            {record.caterer && (
              <div className="min-w-0 flex-1 hidden sm:block">
                <p className="text-[10px] text-[#9D8F85] font-semibold">المتعهد</p>
                <p className="text-sm font-bold text-[#A98159] truncate">{record.caterer}</p>
              </div>
            )}
          </div>

          {/* Violations list */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-1.5 h-5 rounded-full bg-red-500" />
              <p className="text-sm font-black text-red-700">
                المخالفات (الأسئلة المُجابة بـ «لا»)
              </p>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 tabular-nums">
                {noQs.length}
              </span>
            </div>
            {noQs.length === 0 ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50/40 border-2 border-green-200 rounded-2xl p-5 text-center">
                <CheckCircle2 size={26} className="mx-auto text-green-600 mb-2" strokeWidth={2} />
                <p className="text-green-700 font-bold text-sm">لا توجد مخالفات في هذا التقييم 🎉</p>
                <p className="text-green-600 text-xs mt-1">جميع الأسئلة أُجيب عنها بنعم</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {noQs.map(q => (
                  <li key={q.id} className="bg-red-50/60 border border-red-200/70 rounded-xl p-3 flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-red-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {q.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#2D2926] font-medium leading-relaxed">{q.text}</p>
                      {q.category && (
                        <p className="text-[10px] text-[#A98159] font-bold mt-1">{q.category}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* All answered questions with photos */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-1.5 h-5 rounded-full bg-[#A98159]" />
              <p className="text-sm font-black text-[#2D2926]">جميع الإجابات والصور</p>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FDF8F0] border border-[#E8DDD4] text-[#A98159] tabular-nums">
                {MEAL_QUESTIONS.filter(q => ans[q.id]).length} سؤال
              </span>
            </div>
            <div className="space-y-2">
              {MEAL_QUESTIONS.map(q => {
                const a = ans[q.id];
                if (!a) return null;
                const isYes = a === 'نعم';
                const isNo  = a === 'لا';
                const photoUrl = photos[q.id];
                return (
                  <div key={q.id}
                    className={`rounded-xl px-3 py-2.5 border ${
                      isYes ? 'bg-green-50/40 border-green-200/60'
                    : isNo  ? 'bg-red-50/40 border-red-200/60'
                    :         'bg-white border-[#EDE5DC]'
                    }`}>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md text-white tabular-nums shrink-0 mt-0.5"
                        style={{ background: '#A98159' }}>
                        {q.id}
                      </span>
                      <p className="text-[12px] text-[#2D2926] leading-relaxed flex-1">{q.text}</p>
                      <span className={`text-[10px] font-black flex-shrink-0 flex items-center gap-0.5 ${
                        isYes ? 'text-green-700' : isNo ? 'text-red-700' : 'text-[#6D6E71]'
                      }`}>
                        {a}
                      </span>
                    </div>
                    {photoUrl && (
                      <a href={photoUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                        <img src={photoUrl} alt={`q${q.id}`}
                          className="rounded-lg border border-[#EDE5DC] max-h-48 object-cover hover:opacity-90 transition-opacity" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsCenterList({ centers, selectedDay, phasesData, evalLookup, centerCategories, onSelect }) {
  /* For each center, count total phases done across all 3 meals + total evaluations */
  const summaries = useMemo(() => {
    return centers.map(c => {
      let phasesDone = 0;
      let photoCount = 0;
      let evalCount  = 0;
      let evalSum    = 0;
      let violations = 0;
      MEALS.forEach(m => {
        const cell = phasesData[`${c.id}_d${selectedDay}_${m.id}`] || {};
        PHASES.forEach(p => {
          if (cell[`phase${p.id}`]) phasesDone++;
          if (cell[`phase${p.id}Photo`]) photoCount++;
        });
        const ev = evalLookup.get(`${c.id}|${selectedDay}|${m.id}`);
        if (ev) {
          const s = getEvalScore(ev);
          if (s != null) { evalCount++; evalSum += s; }
          if (ev.answers) violations += Object.values(ev.answers).filter(v => v === 'لا').length;
        }
      });
      const avgScore = evalCount > 0 ? parseFloat((evalSum / evalCount).toFixed(1)) : null;
      const maxPhases = MEALS.length * PHASES.length; // 9
      return {
        center: c.id,
        caterer: c.caterer,
        phasesDone,
        maxPhases,
        photoCount,
        evalCount,
        avgScore,
        violations,
      };
    });
  }, [centers, selectedDay, phasesData, evalLookup]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#FDF8F0] to-white border border-[#E8DDD4] rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
          style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
          <ImageIcon size={18} className="text-white" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#2D2926]">تقارير المراكز — {DAYS.find(d => d.id === selectedDay)?.label}</p>
          <p className="text-[11px] text-[#6D6E71] mt-0.5">اختر مركزاً لعرض المراحل والصور والتقييمات الخاصة به</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map(s => {
          const pct  = Math.round((s.phasesDone / s.maxPhases) * 100);
          const sst  = scoreStyle(s.avgScore);
          const cats = [...(centerCategories.get(extractCenterNum(s.center)) || [])];
          return (
            <button
              key={s.center}
              onClick={() => onSelect(s.center)}
              className="text-right group bg-white rounded-2xl border border-[#EDE5DC] p-4 shadow-[0_2px_8px_rgba(45,41,38,0.07)] hover:shadow-[0_6px_24px_rgba(169,129,89,0.18)] hover:border-[#D9CEBC] hover:-translate-y-0.5 transition-all"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-xl blur-md opacity-40 bg-[#A98159] group-hover:opacity-60 transition-opacity" />
                  <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-md"
                    style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
                    <span className="text-white text-sm font-black tabular-nums">
                      {(s.center.match(/\d+/) || ['—'])[0]}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#2D2926] truncate">{s.center}</p>
                  <p className="text-[10px] text-[#A98159] font-bold truncate mt-0.5">{s.caterer}</p>
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {cats.map(cat => {
                      const meta = MEAL_CATEGORY_META[cat];
                      if (!meta) return null;
                      const CIcon = meta.Icon;
                      return (
                        <span key={cat}
                          className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border"
                          style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
                        >
                          <CIcon size={9} strokeWidth={2.5} />
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Phase progress per meal */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {MEALS.map(m => {
                  const MIcon = m.icon;
                  const cell  = phasesData[`${s.center}_d${selectedDay}_${m.id}`] || {};
                  const done  = PHASES.filter(p => cell[`phase${p.id}`]).length;
                  const pPct  = Math.round((done / PHASES.length) * 100);
                  return (
                    <div key={m.id} className="rounded-xl p-2 border text-center"
                      style={{ background: m.bg, borderColor: m.border }}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <MIcon size={11} weight="bold" style={{ color: m.color }} />
                        <span className="text-[9px] font-bold" style={{ color: m.color }}>{m.label}</span>
                      </div>
                      <p className="text-[11px] font-black tabular-nums" style={{ color: m.color }}>
                        {done}/{PHASES.length}
                        <span className="text-[8px] opacity-70 ms-0.5">· {pPct}%</span>
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-lg border border-[#EDE5DC] bg-[#FAFAF8] p-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[#A98159]">
                    <ImageIcon size={10} strokeWidth={2.5} />
                    <span className="text-[8px] font-bold">صور</span>
                  </div>
                  <p className="text-sm font-black text-[#2D2926] tabular-nums mt-0.5">{s.photoCount}</p>
                </div>
                <div className="rounded-lg border p-1.5 text-center"
                  style={{ background: sst.bg, borderColor: sst.border }}>
                  <div className="flex items-center justify-center gap-1" style={{ color: sst.color }}>
                    <Sparkles size={10} strokeWidth={2.5} />
                    <span className="text-[8px] font-bold">متوسط</span>
                  </div>
                  <p className="text-sm font-black tabular-nums mt-0.5" style={{ color: sst.color }}>
                    {s.avgScore != null ? s.avgScore.toFixed(1) : '—'}
                  </p>
                </div>
                <div className="rounded-lg border p-1.5 text-center"
                  style={s.violations > 0
                    ? { background: '#FEF2F2', borderColor: '#FCA5A5' }
                    : { background: '#F0FDF4', borderColor: '#86EFAC' }}>
                  <div className="flex items-center justify-center gap-1"
                    style={{ color: s.violations > 0 ? '#B91C1C' : '#15803D' }}>
                    <AlertCircle size={10} strokeWidth={2.5} />
                    <span className="text-[8px] font-bold">مخالفات</span>
                  </div>
                  <p className="text-sm font-black tabular-nums mt-0.5"
                    style={{ color: s.violations > 0 ? '#B91C1C' : '#15803D' }}>
                    {s.violations}
                  </p>
                </div>
              </div>

              {/* Overall progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-[#9D8F85]">إجمالي المراحل</span>
                  <span className="text-[10px] font-black tabular-nums"
                    style={{ color: pct === 100 ? '#10B981' : pct > 0 ? '#F59E0B' : '#9D8F85' }}>
                    {s.phasesDone}/{s.maxPhases} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#F5F0EB] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: pct === 100 ? '#10B981' : pct > 0 ? '#F59E0B' : '#E8DDD4',
                    }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CenterReport({ center, selectedDay, phasesData, evalLookup, centerCategories, onBack, onViewPhoto, onViewEval }) {
  const centerObj = CENTERS.find(c => c.id === center) || { id: center, caterer: '' };
  const cats = [...(centerCategories.get(extractCenterNum(center)) || [])];

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-gradient-to-br from-white to-[#FDF8F0] border border-[#E8DDD4] rounded-2xl p-4 flex items-center gap-3 shadow-[0_2px_8px_rgba(45,41,38,0.07)]">
        <button onClick={onBack}
          className="min-w-[40px] min-h-[40px] rounded-xl border border-[#D9CEBC] bg-white text-[#A98159] flex items-center justify-center hover:bg-[#FDF8F0] hover:border-[#A98159] transition-all shrink-0"
          title="رجوع"
        >
          <X size={16} strokeWidth={2.25} />
        </button>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl blur-md opacity-50 bg-[#A98159]" />
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
            <span className="text-white text-sm font-black tabular-nums">
              {(center.match(/\d+/) || ['—'])[0]}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-black text-[#2D2926] truncate">{center}</p>
            {cats.map(cat => {
              const meta = MEAL_CATEGORY_META[cat];
              if (!meta) return null;
              const CIcon = meta.Icon;
              return (
                <span key={cat}
                  className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border"
                  style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
                >
                  <CIcon size={9} strokeWidth={2.5} />
                  {meta.label}
                </span>
              );
            })}
          </div>
          <p className="text-[11px] text-[#A98159] font-bold mt-0.5 truncate">
            {centerObj.caterer} · {DAYS.find(d => d.id === selectedDay)?.label}
          </p>
        </div>
      </div>

      {/* Per-meal sections */}
      <div className="space-y-4">
        {MEALS.map(m => {
          const MIcon   = m.icon;
          const cell    = phasesData[`${center}_d${selectedDay}_${m.id}`] || {};
          const done    = PHASES.filter(p => cell[`phase${p.id}`]).length;
          const evalDoc = evalLookup.get(`${center}|${selectedDay}|${m.id}`);
          const score   = getEvalScore(evalDoc);
          const sst     = scoreStyle(score);
          const noAns   = evalDoc?.answers
            ? Object.values(evalDoc.answers).filter(v => v === 'لا').length
            : 0;

          return (
            <div key={m.id}
              className="bg-white rounded-2xl border-2 overflow-hidden shadow-[0_2px_12px_rgba(45,41,38,0.07)]"
              style={{ borderColor: m.border }}
            >
              {/* Meal header */}
              <div className="px-4 sm:px-5 py-3 flex items-center gap-3 border-b"
                style={{ background: m.bg, borderColor: m.border }}>
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0"
                  style={{ border: `1.5px solid ${m.border}` }}>
                  <MIcon size={18} weight="bold" style={{ color: m.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black" style={{ color: m.color }}>{m.label}</p>
                  <p className="text-[10px] font-bold text-[#6D6E71] mt-0.5">
                    {done}/{PHASES.length} مراحل مكتملة
                  </p>
                </div>
                {/* Eval score chip */}
                {evalDoc ? (
                  <button onClick={() => onViewEval(evalDoc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 hover:scale-105 active:scale-95 transition-transform shrink-0"
                    style={{ background: sst.bg, borderColor: sst.border }}
                    title="عرض تفاصيل التقييم"
                  >
                    <Sparkles size={11} style={{ color: sst.color }} strokeWidth={2.5} />
                    <span className="text-sm font-black tabular-nums" style={{ color: sst.color }}>
                      {score != null ? score.toFixed(1) : '—'}
                      <span className="text-[9px] opacity-70">/10</span>
                    </span>
                    {noAns > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-red-500 text-white tabular-nums">
                        {noAns} مخالفة
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-[#9D8F85] px-2.5 py-1.5 rounded-lg border border-[#EDE5DC] bg-white">
                    لم يُقيَّم
                  </span>
                )}
              </div>

              {/* Phase photos grid */}
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PHASES.map(p => {
                    const isDone   = !!cell[`phase${p.id}`];
                    const time     = fmtTime(cell[`phase${p.id}`]);
                    const photoUrl = cell[`phase${p.id}Photo`] || null;
                    return (
                      <div key={p.id}
                        className="rounded-xl border-2 overflow-hidden"
                        style={{ borderColor: isDone ? p.border : '#EDE5DC', background: isDone ? p.bg : '#FAFAF8' }}
                      >
                        {/* Phase label strip */}
                        <div className="px-3 py-2 flex items-center justify-between"
                          style={{ background: isDone ? `${p.color}10` : '#F5F0EB' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0"
                              style={{ background: isDone ? p.color : '#C9B8A8' }}>
                              {p.id}
                            </span>
                            <span className="text-[11px] font-black"
                              style={{ color: isDone ? p.color : '#9D8F85' }}>
                              {p.label}
                            </span>
                          </div>
                          {isDone ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums"
                              style={{ color: p.color }}>
                              <CheckCircle2 size={11} strokeWidth={2.5} />
                              {time || '—'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-[#C9B8A8]">لم يبدأ</span>
                          )}
                        </div>
                        {/* Photo */}
                        {isDone && photoUrl ? (
                          <button
                            onClick={() => onViewPhoto(photoUrl)}
                            className="block w-full relative group/photo"
                            title="عرض الصورة"
                          >
                            <img src={photoUrl} alt={p.label}
                              className="w-full h-44 object-cover transition-transform group-hover/photo:scale-105" />
                            <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/30 transition-colors flex items-center justify-center">
                              <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity shadow-lg">
                                <ImageIcon size={15} className="text-[#2D2926]" strokeWidth={2.25} />
                              </div>
                            </div>
                          </button>
                        ) : (
                          <div className="w-full h-44 flex flex-col items-center justify-center gap-1.5 bg-[#FAFAF8]">
                            <div className="w-10 h-10 rounded-full bg-[#F5F0EB] border border-[#E8DDD4] flex items-center justify-center">
                              <ImageIcon size={16} className="text-[#C9B8A8]" strokeWidth={2} />
                            </div>
                            <span className="text-[10px] font-bold text-[#C9B8A8]">
                              {isDone ? 'بدون صورة' : 'لم تُرفع بعد'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}