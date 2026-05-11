import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { CENTERS } from '../../config/centers.js';
import { Activity, CheckCircle2, Clock, Layers, RotateCcw } from 'lucide-react';

const PHASES = [
  { id: 1, label: 'التجهيز',  short: 'تجهيز', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', glow: 'rgba(245,158,11,0.45)' },
  { id: 2, label: 'الطبخ',    short: 'طبخ',   color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5', glow: 'rgba(239,68,68,0.45)'  },
  { id: 3, label: 'التوزيع',  short: 'توزيع', color: '#10B981', bg: '#F0FDF4', border: '#6EE7B7', glow: 'rgba(16,185,129,0.45)' },
];

const MEALS = [
  { id: 'breakfast', label: 'الإفطار', icon: '🌅', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'lunch',     label: 'الغداء',  icon: '☀️', color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5' },
  { id: 'dinner',    label: 'العشاء',  icon: '🌙', color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
];

const DAYS = [
  { id: '8',  label: '٨ ذو الحجة'  },
  { id: '9',  label: '٩ ذو الحجة'  },
  { id: '10', label: '١٠ ذو الحجة' },
  { id: '11', label: '١١ ذو الحجة' },
  { id: '12', label: '١٢ ذو الحجة' },
  { id: '13', label: '١٣ ذو الحجة' },
];

function fmtTime(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function PhaseDot({ done, phase, small }) {
  const size = small ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]';
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center font-black transition-all`}
      style={done
        ? { background: phase.color, color: '#fff', boxShadow: `0 0 8px ${phase.glow}` }
        : { background: '#F3F4F6', color: '#D1D5DB' }
      }
    >
      {done ? <CheckCircle2 size={small ? 11 : 13} strokeWidth={2.5} /> : phase.id}
    </div>
  );
}

export default function AdminPhases() {
  const [phasesData, setPhasesData] = useState({});
  const [selectedDay, setSelectedDay] = useState('8');
  const [sortBy, setSortBy] = useState('progress');

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
  const overallPct = Math.round((rows.reduce((s, r) => s + r.total, 0) / (rows.length * maxDone)) * 100);

  return (
    <div className="space-y-5 pb-6" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2926]">المراحل الميدانية</h1>
          <p className="text-sm text-[#9D8F85] mt-0.5 font-medium">
            متابعة مراحل تجهيز وطبخ وتوزيع الوجبات — تحديث فوري
          </p>
        </div>
        <button
          onClick={() => setSortBy(s => s === 'progress' ? 'center' : 'progress')}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D9CEBC] bg-white text-[#2D2926] text-xs font-bold hover:border-[#A98159] hover:bg-[#FDF8F0] transition-all flex-shrink-0 self-start sm:self-auto"
        >
          <RotateCcw size={13} strokeWidth={2} className="text-[#A98159]" />
          {sortBy === 'progress' ? 'ترتيب حسب التقدم' : 'ترتيب حسب المركز'}
        </button>
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

      {/* Overall Progress Bar */}
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
              background: overallPct === 100
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : overallPct > 50
                  ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                  : 'linear-gradient(90deg, #A98159, #C4A46E)',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-[#9D8F85] font-medium">
            {rows.reduce((s, r) => s + r.total, 0)} من {rows.length * maxDone} مرحلة مكتملة
          </p>
          <div className="flex items-center gap-3">
            {PHASES.map(p => (
              <div key={p.id} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                <span className="text-[10px] text-[#9D8F85] font-medium">{p.short}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">

        {/* Table Header */}
        <div className="grid gap-2 px-4 py-3 border-b border-[#EDE5DC] bg-[#FAFAF8]"
          style={{ gridTemplateColumns: '1fr repeat(3, minmax(100px, 1fr)) 70px' }}>
          <p className="text-[11px] font-bold text-[#9D8F85] uppercase tracking-wider">المركز</p>
          {MEALS.map(m => (
            <div key={m.id} className="flex items-center justify-center gap-1.5">
              <span className="text-sm">{m.icon}</span>
              <p className="text-[11px] font-bold text-[#9D8F85]">{m.label}</p>
            </div>
          ))}
          <p className="text-[11px] font-bold text-[#9D8F85] text-center">التقدم</p>
        </div>

        {/* Rows */}
        {rows.map((row, idx) => {
          const isLast = idx === rows.length - 1;
          const pct = Math.round((row.total / maxDone) * 100);
          return (
            <div
              key={row.center}
              className={`grid gap-2 px-4 py-4 items-center transition-colors hover:bg-[#FDFAF7] ${!isLast ? 'border-b border-[#EDE5DC]' : ''}`}
              style={{ gridTemplateColumns: '1fr repeat(3, minmax(100px, 1fr)) 70px' }}
            >
              {/* Center Info */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-[#2D2926]">{row.center}</p>
                  {row.total === maxDone && (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 text-[9px] font-black px-2 py-0.5 rounded-full border border-green-200">
                      <CheckCircle2 size={9} strokeWidth={2.5} /> مكتمل
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#A98159] font-bold mt-0.5 truncate">{row.caterer}</p>
              </div>

              {/* Meal Columns */}
              {MEALS.map(meal => {
                const data = getCell(row.center, selectedDay, meal.id);
                const done = cellDone(data);
                return (
                  <div key={meal.id} className="flex flex-col items-center gap-1.5">
                    {/* 3 phase dots */}
                    <div className="flex items-center gap-1">
                      {PHASES.map(phase => (
                        <PhaseDot
                          key={phase.id}
                          done={!!data[`phase${phase.id}`]}
                          phase={phase}
                          small
                        />
                      ))}
                    </div>
                    {/* timestamp of latest phase */}
                    {done > 0 && (() => {
                      const latestTs = [3, 2, 1].map(n => data[`phase${n}`]).find(Boolean);
                      return latestTs ? (
                        <span className="text-[9px] font-bold tabular-nums"
                          style={{ color: PHASES[done - 1]?.color }}>
                          {fmtTime(latestTs)}
                        </span>
                      ) : null;
                    })()}
                    {done === 0 && (
                      <span className="text-[9px] text-[#D1D5DB] font-medium">—</span>
                    )}
                  </div>
                );
              })}

              {/* Progress */}
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-black tabular-nums"
                  style={{ color: pct === 100 ? '#10B981' : pct > 0 ? '#F59E0B' : '#D1D5DB' }}>
                  {pct}%
                </p>
                <div className="w-14 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: pct === 100 ? '#10B981' : pct >= 67 ? '#F59E0B' : pct >= 34 ? '#EF4444' : '#A98159',
                    }}
                  />
                </div>
                <p className="text-[9px] text-[#9D8F85] font-medium">{row.total}/{maxDone}</p>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
