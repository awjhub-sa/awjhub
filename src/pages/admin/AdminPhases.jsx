import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { CENTERS } from '../../config/centers.js';
import { Activity, CheckCircle2, Clock, Layers, RotateCcw } from 'lucide-react';

const PHASES = [
  { id: 1, label: 'التجهيز',         short: 'تجهيز', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', glow: 'rgba(245,158,11,0.45)' },
  { id: 2, label: 'الطبخ',            short: 'طبخ',   color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5', glow: 'rgba(239,68,68,0.45)'  },
  { id: 3, label: 'التعبئة والتوزيع', short: 'توزيع', color: '#10B981', bg: '#F0FDF4', border: '#6EE7B7', glow: 'rgba(16,185,129,0.45)' },
];

function fmtTime(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminPhases() {
  const [phasesData, setPhasesData] = useState({});
  const [sortBy,     setSortBy]     = useState('progress'); // 'progress' | 'center'

  useEffect(() => {
    return onSnapshot(collection(db, 'meal_phases'), snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.data().center || d.id] = { id: d.id, ...d.data() }; });
      setPhasesData(map);
    });
  }, []);

  /* Merge with CENTERS list so every center shows even if no data yet */
  const rows = useMemo(() => {
    const list = CENTERS.map(c => {
      const data  = phasesData[c.id] || {};
      const done  = [1, 2, 3].filter(n => !!data[`phase${n}`]).length;
      return { center: c.id, caterer: c.caterer, data, done };
    });
    if (sortBy === 'progress') {
      return [...list].sort((a, b) => b.done - a.done);
    }
    return list; // original order = center number order
  }, [phasesData, sortBy]);

  const totalCenters   = CENTERS.length;
  const fullyDone      = rows.filter(r => r.done === 3).length;
  const inProgress     = rows.filter(r => r.done > 0 && r.done < 3).length;
  const notStarted     = rows.filter(r => r.done === 0).length;
  const overallPct     = Math.round((rows.reduce((s, r) => s + r.done, 0) / (totalCenters * 3)) * 100);

  return (
    <div className="space-y-5 pb-6" dir="rtl">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2926]">المراحل الميدانية</h1>
          <p className="text-sm text-[#9D8F85] mt-0.5 font-medium">
            متابعة مراحل تجهيز وطبخ وتوزيع الوجبات — تحديث فوري
          </p>
        </div>

        {/* Sort toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setSortBy(s => s === 'progress' ? 'center' : 'progress')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D9CEBC] bg-white text-[#2D2926] text-xs font-bold hover:border-[#A98159] hover:bg-[#FDF8F0] transition-all"
          >
            <RotateCcw size={13} strokeWidth={2} className="text-[#A98159]" />
            {sortBy === 'progress' ? 'ترتيب حسب التقدم' : 'ترتيب حسب المركز'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المراكز',    value: totalCenters, color: '#6366F1', icon: Layers        },
          { label: 'مكتمل ٣ مراحل',     value: fullyDone,    color: '#10B981', icon: CheckCircle2   },
          { label: 'قيد التنفيذ',        value: inProgress,   color: '#F59E0B', icon: Activity       },
          { label: 'لم يبدأ',           value: notStarted,   color: '#9D8F85', icon: Clock          },
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

      {/* Overall progress bar */}
      <div className="bg-white rounded-2xl px-6 py-4 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-[#2D2926]">التقدم الإجمالي لجميع المراكز</p>
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
            {rows.reduce((s, r) => s + r.done, 0)} من {totalCenters * 3} مرحلة مكتملة
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

      {/* Phase legend header */}
      <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-5 py-3 border-b border-[#EDE5DC] bg-[#FAFAF8]">
          <p className="text-[11px] font-bold text-[#9D8F85] uppercase tracking-wider">المركز</p>
          {PHASES.map(p => (
            <div key={p.id} className="hidden sm:flex items-center justify-center gap-1.5 min-w-[90px]">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <p className="text-[11px] font-bold text-[#9D8F85]">{p.label}</p>
            </div>
          ))}
          <p className="text-[11px] font-bold text-[#9D8F85] text-center min-w-[70px]">التقدم</p>
        </div>

        {/* Rows */}
        {rows.map((row, idx) => {
          const isLast = idx === rows.length - 1;
          const pct    = Math.round((row.done / 3) * 100);
          return (
            <div
              key={row.center}
              className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-3 gap-y-2 px-5 py-4 transition-colors hover:bg-[#FDFAF7] ${!isLast ? 'border-b border-[#EDE5DC]' : ''}`}
            >
              {/* Center info */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-[#2D2926]">{row.center}</p>
                  {row.done === 3 && (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 text-[9px] font-black px-2 py-0.5 rounded-full border border-green-200">
                      <CheckCircle2 size={9} strokeWidth={2.5} /> مكتمل
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#A98159] font-bold mt-0.5 truncate">{row.caterer}</p>
                {row.data.observer && (
                  <p className="text-[10px] text-[#9D8F85] font-medium mt-0.5 truncate">
                    {row.data.observer}
                  </p>
                )}
                {/* Mobile: phase dots */}
                <div className="flex items-center gap-2 mt-2 sm:hidden">
                  {PHASES.map(p => {
                    const ts   = row.data[`phase${p.id}`];
                    const done = !!ts;
                    return (
                      <div key={p.id} className="flex items-center gap-1">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all"
                          style={done
                            ? { background: p.color, color: '#fff', boxShadow: `0 0 10px ${p.glow}` }
                            : { background: '#F3F4F6', color: '#D1D5DB' }
                          }
                        >
                          {done ? <CheckCircle2 size={13} strokeWidth={2.5} /> : p.id}
                        </div>
                        {done && (
                          <span className="text-[9px] font-bold" style={{ color: p.color }}>
                            {fmtTime(ts)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Desktop: individual phase lamps */}
              {PHASES.map(p => {
                const ts   = row.data[`phase${p.id}`];
                const done = !!ts;
                return (
                  <div key={p.id} className="hidden sm:flex flex-col items-center justify-center min-w-[90px] gap-1">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all duration-500"
                      style={done
                        ? {
                            background: p.color,
                            color: '#fff',
                            boxShadow: `0 0 0 4px ${p.bg}, 0 0 16px ${p.glow}`,
                          }
                        : {
                            background: '#F3F4F6',
                            color: '#D1D5DB',
                            border: '2px solid #E5E7EB',
                          }
                      }
                    >
                      {done
                        ? <CheckCircle2 size={16} strokeWidth={2.5} />
                        : <span className="text-[11px]">{p.id}</span>
                      }
                    </div>
                    {done ? (
                      <span className="text-[9px] font-bold tabular-nums" style={{ color: p.color }}>
                        {fmtTime(ts)}
                      </span>
                    ) : (
                      <span className="text-[9px] text-[#D1D5DB] font-medium">—</span>
                    )}
                  </div>
                );
              })}

              {/* Progress bar */}
              <div className="flex flex-col items-center gap-1 min-w-[70px]">
                <p className="text-sm font-black tabular-nums"
                  style={{
                    color: pct === 100 ? '#10B981' : pct > 0 ? '#F59E0B' : '#D1D5DB'
                  }}>
                  {pct}%
                </p>
                <div className="w-16 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: pct === 100
                        ? '#10B981'
                        : pct >= 67
                          ? '#F59E0B'
                          : pct >= 34
                            ? '#EF4444'
                            : '#A98159',
                    }}
                  />
                </div>
                <p className="text-[9px] text-[#9D8F85] font-medium">{row.done}/3</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
