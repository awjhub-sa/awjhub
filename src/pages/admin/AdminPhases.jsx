import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { CENTERS } from '../../config/centers.js';
import { Activity, CheckCircle2, Clock, Layers, RotateCcw, ImageIcon, X, Trash2 } from 'lucide-react';
import { Coffee, ForkKnife, Moon } from '@phosphor-icons/react';

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
  const [selectedDay,  setSelectedDay]  = useState('8');
  const [sortBy,       setSortBy]       = useState('progress');
  const [lightboxSrc,  setLightboxSrc]  = useState(null);
  
  // حالات المسح (التي كانت ناقصة وتسبب الخطأ)
  const [clearConfirm,    setClearConfirm]    = useState(false);
  const [clearing,        setClearing]        = useState(false);
  const [mealClearTarget, setMealClearTarget] = useState(null);
  const [mealClearing,    setMealClearing]    = useState(false);
  const [centerClearConfirm, setCenterClearConfirm] = useState(null);
  const [centerClearing,     setCenterClearing]     = useState(false);

  const handleClearDay = async () => {
    setClearing(true);
    try {
      const batch = writeBatch(db);
      Object.values(phasesData)
        .filter(d => d.day === selectedDay)
        .forEach(d => batch.delete(doc(db, 'meal_phases', d.id)));
      await batch.commit();
    } catch {}
    setClearing(false);
    setClearConfirm(false);
  };

  const handleClearMeal = async () => {
    if (!mealClearTarget) return;
    setMealClearing(true);
    try {
      await deleteDoc(doc(db, 'meal_phases', `${mealClearTarget.center}_d${selectedDay}_${mealClearTarget.mealId}`));
    } catch {}
    setMealClearing(false);
    setMealClearTarget(null);
  };

  // وظيفة مسح المركز (كانت ناقصة)
  const handleClearCenter = async (centerId) => {
    setCenterClearing(true);
    try {
      const batch = writeBatch(db);
      MEALS.forEach(m => {
        const docId = `${centerId}_d${selectedDay}_${m.id}`;
        batch.delete(doc(db, 'meal_phases', docId));
      });
      await batch.commit();
    } catch(e) {}
    setCenterClearing(false);
    setCenterClearConfirm(null);
  };

  useEffect(() => {
    return onSnapshot(collection(db, 'meal_phases'), snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
      setPhasesData(map);
    });
  }, []);

  const getCell = (center, day, mealId) =>
    phasesData[`${center}_d${day}_${mealId}`] || {};

  const cellDone = (data) => [1, 2, 3].filter(n => !!data[`phase${n}`]).length;

  const rows = useMemo(() => {
    const list = CENTERS.map(c => {
      let total = 0;
      MEALS.forEach(m => { total += cellDone(getCell(c.id, selectedDay, m.id)); });
      return { center: c.id, caterer: c.caterer, total };
    });
    if (sortBy === 'progress') return [...list].sort((a, b) => b.total - a.total);
    return list;
  }, [phasesData, selectedDay, sortBy]);

  const maxDone = MEALS.length * PHASES.length; // 9
  const fullyDone  = rows.filter(r => r.total === maxDone).length;
  const inProgress = rows.filter(r => r.total > 0 && r.total < maxDone).length;
  const notStarted = rows.filter(r => r.total === 0).length;
  const overallPct = Math.round((rows.reduce((s, r) => s + r.total, 0) / (rows.length * maxDone)) * 100) || 0;

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2926]">المراحل الميدانية</h1>
          <p className="text-sm text-[#9D8F85] mt-0.5 font-medium">متابعة مراحل تجهيز وطبخ وتوزيع الوجبات — تحديث فوري</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
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
      <div className="bg-white rounded-2xl px-6 py-4 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-[#2D2926]">
            التقدم الإجمالي — {DAYS.find(d => d.id === selectedDay)?.label}
          </p>
          <p className="text-lg font-black text-[#A98159] tabular-nums">{overallPct}%</p>
        </div>
        <div className="h-3 bg-[#F5F0EB] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${overallPct}%`,
              background: overallPct === 100 ? '#10B981' : overallPct > 50 ? '#F59E0B' : '#A98159',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">
        <div className="grid gap-2 px-4 py-3 border-b border-[#EDE5DC] bg-[#FAFAF8]"
          style={{ gridTemplateColumns: '1.2fr repeat(3, 1fr) 0.6fr 50px' }}>
          <p className="text-[11px] font-bold text-[#9D8F85]">المركز</p>
          {MEALS.map(m => (
            <div key={m.id} className="flex items-center justify-center gap-1.5">
              <m.icon size={14} style={{ color: m.color }} />
              <p className="text-[11px] font-bold text-[#9D8F85]">{m.label}</p>
            </div>
          ))}
          <p className="text-[11px] font-bold text-[#9D8F85] text-center">التقدم</p>
          <p className="text-[11px] font-bold text-[#9D8F85] text-center">إجراء</p>
        </div>

        {rows.map((row, idx) => {
          const isLast = idx === rows.length - 1;
          const pct = Math.round((row.total / maxDone) * 100);
          return (
            <div
              key={row.center}
              className={`group grid gap-2 px-4 py-4 items-center ${!isLast ? 'border-b border-[#EDE5DC]' : ''}`}
              style={{ gridTemplateColumns: '1.2fr repeat(3, 1fr) 0.6fr 50px' }}
            >
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#2D2926]">{row.center}</p>
                <p className="text-[10px] text-[#A98159] font-bold truncate">{row.caterer}</p>
              </div>

              {MEALS.map(meal => {
                const data = getCell(row.center, selectedDay, meal.id);
                const done = cellDone(data);
                const isTarget = mealClearTarget?.center === row.center && mealClearTarget?.mealId === meal.id;
                return (
                  <div key={meal.id} className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5">
                      {PHASES.map(phase => (
                        <PhaseDot
                          key={phase.id}
                          done={!!data[`phase${phase.id}`]}
                          phase={phase}
                          small
                          photoUrl={data[`phase${phase.id}_photo`] || null}
                          onViewPhoto={setLightboxSrc}
                        />
                      ))}
                    </div>
                    {done > 0 && (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-[#9D8F85] tabular-nums">
                          {fmtTime([3,2,1].map(n => data[`phase${n}`]).find(Boolean))}
                        </span>
                        {isTarget ? (
                           <button onClick={handleClearMeal} className="text-[8px] text-red-500 font-bold">تأكيد</button>
                        ) : (
                           <button onClick={() => setMealClearTarget({center: row.center, mealId: meal.id})} className="opacity-0 group-hover:opacity-100 text-[8px] text-[#9D8F85]">حذف</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="text-center">
                <p className="text-xs font-black" style={{ color: pct === 100 ? '#10B981' : '#F59E0B' }}>{pct}%</p>
              </div>

              <div className="flex justify-center">
                {centerClearConfirm === row.center ? (
                   <button onClick={() => handleClearCenter(row.center)} className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center text-white">
                     <Trash2 size={12} />
                   </button>
                ) : (
                   <button onClick={() => setCenterClearConfirm(row.center)} className="w-7 h-7 border rounded-lg flex items-center justify-center text-[#C9B8A8]">
                     <Trash2 size={12} />
                   </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}