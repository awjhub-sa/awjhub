import { useEffect, useMemo, useState } from 'react';
import {
  UtensilsCrossed, Coffee, Sun, Moon, AlertCircle, Building2, Calendar,
  MapPin, Clock as ClockIcon,
} from 'lucide-react';
import { getCenterNationalities } from '../config/nationalities.js';
import {
  HAJJ_DAYS, CATEGORY_KEYS, CATEGORY_META,
  getMeal, getMealItems,
} from '../config/menus.js';

const MEAL_META = {
  breakfast: { label: 'الإفطار', Icon: Coffee, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  lunch:     { label: 'الغداء',  Icon: Sun,    color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5' },
  dinner:    { label: 'العشاء',  Icon: Moon,   color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
};
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];

/**
 * Compact widget showing today's menu for the user's assigned center(s).
 *
 * Props:
 *   centerId          — single center string ('مركز 7') for observers
 *   centerIds         — array of center strings for supervisors
 *   defaultDay        — '7'..'13' (default '7')
 */
export default function TodayMenuCard({ centerId, centerIds, defaultDay = '7' }) {
  const [selectedDay,    setSelectedDay]    = useState(defaultDay);
  const [activeCenterId, setActiveCenterId] = useState(centerId || (centerIds && centerIds[0]) || null);
  const [activeNatKey,   setActiveNatKey]   = useState(null);

  /* Update selection when supervisor switches center externally */
  const effectiveCenterId = centerId || activeCenterId;
  const nationalities = useMemo(() => getCenterNationalities(effectiveCenterId), [effectiveCenterId]);
  const nat = nationalities.find(n => n.key === activeNatKey) || nationalities[0] || null;

  /* Reset nationality selection when center changes */
  useEffect(() => {
    setActiveNatKey(nationalities[0]?.key || null);
  }, [effectiveCenterId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!effectiveCenterId) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_10px_rgba(45,41,38,0.06)] overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#EDE5DC] flex items-center gap-3"
        style={{
          background: nat
            ? `linear-gradient(135deg, ${nat.color}10, #FDFCFB)`
            : 'linear-gradient(135deg, #FDF8F0, #FDFCFB)',
        }}>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl blur-md opacity-50"
            style={{ background: nat?.color || '#A98159' }} />
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-md text-xl"
            style={{ background: `linear-gradient(135deg, ${nat?.color || '#A98159'}, ${(nat?.color || '#A98159')}CC)` }}>
            {nat ? <span className="drop-shadow">{nat.flag}</span> : <UtensilsCrossed size={18} className="text-white" strokeWidth={2.25} />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#2D2926] truncate">
            منيو اليوم {nat ? `· ${nat.label}` : ''}
          </p>
          <p className="text-[11px] text-[#6D6E71] font-bold mt-0.5 flex items-center gap-1.5">
            <Building2 size={10} strokeWidth={2.5} className="text-[#A98159]" />
            <span className="truncate">{effectiveCenterId}</span>
          </p>
        </div>
      </div>

      {/* Center switcher for supervisors */}
      {!centerId && centerIds && centerIds.length > 1 && (
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {centerIds.map(c => {
              const active = c === activeCenterId;
              return (
                <button key={c}
                  onClick={() => setActiveCenterId(c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border ${
                    active
                      ? 'bg-[#2D2926] text-white border-[#2D2926] shadow-sm'
                      : 'bg-white text-[#6D6E71] border-[#D9CEBC] hover:border-[#A98159] hover:text-[#A98159]'
                  }`}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Nationality switcher — shown when a center hosts multiple nationalities */}
      {nationalities.length > 1 && (
        <div className="px-4 sm:px-5 pt-3 pb-1">
          <p className="text-[10px] font-bold text-[#9D8F85] mb-1.5 flex items-center gap-1">
            <UtensilsCrossed size={10} strokeWidth={2.5} className="text-[#A98159]" />
            هذا المركز يستضيف أكثر من جنسية — اختر الجنسية
          </p>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {nationalities.map(n => {
              const active = n.key === (nat?.key);
              return (
                <button key={n.key}
                  onClick={() => setActiveNatKey(n.key)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border-2 ${
                    active ? 'text-white shadow-sm' : 'bg-white text-[#6D6E71] border-[#D9CEBC] hover:border-current'
                  }`}
                  style={active
                    ? { background: `linear-gradient(135deg, ${n.color}, ${n.color}DD)`, borderColor: n.color }
                    : { color: n.color, borderColor: '#D9CEBC' }}>
                  <span className="text-sm leading-none">{n.flag}</span>
                  {n.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Day tabs */}
      <div className="px-4 sm:px-5 pt-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {HAJJ_DAYS.map(d => (
            <button key={d.value}
              onClick={() => setSelectedDay(d.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border ${
                selectedDay === d.value
                  ? 'text-white shadow-sm'
                  : 'bg-white text-[#6D6E71] border-[#D9CEBC] hover:border-[#A98159] hover:text-[#A98159]'
              }`}
              style={selectedDay === d.value
                ? { background: nat?.color || '#A98159', borderColor: nat?.color || '#A98159' }
                : undefined}>
              <Calendar size={9} className="inline-block ms-0 me-1 -mt-0.5" strokeWidth={2.5} />
              {d.dayAr} ذو الحجة
            </button>
          ))}
        </div>
      </div>

      {/* Meals */}
      {!nat ? (
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FDF8F0] border border-[#E8DDD4] flex items-center justify-center mx-auto mb-2">
            <AlertCircle size={20} className="text-[#A98159]" strokeWidth={2} />
          </div>
          <p className="text-[12px] font-bold text-[#9D8F85]">لم يتم تحديد جنسية لهذا المركز</p>
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-3">
          {MEAL_ORDER.map(mealKey => {
            const meta  = MEAL_META[mealKey];
            const meal  = getMeal(nat.key, selectedDay, mealKey);
            const total = getMealItems(nat.key, selectedDay, mealKey).length;
            const MIcon = meta.Icon;
            return (
              <div key={mealKey}
                className="rounded-2xl border-2 overflow-hidden"
                style={{ borderColor: meta.border }}>
                {/* Meal header */}
                <div className="px-3.5 py-2.5 border-b"
                  style={{ background: meta.bg, borderColor: meta.border }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm"
                      style={{ border: `1.5px solid ${meta.border}` }}>
                      <MIcon size={15} style={{ color: meta.color }} strokeWidth={2.25} />
                    </div>
                    <p className="text-xs font-black flex-1" style={{ color: meta.color }}>{meta.label}</p>
                    <span className="text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md bg-white"
                      style={{ color: meta.color, border: `1px solid ${meta.border}` }}>
                      {total}
                    </span>
                  </div>
                  {(meal.location || meal.time) && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {meal.location && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/80 border"
                          style={{ borderColor: meta.border, color: meta.color }}>
                          <MapPin size={9} strokeWidth={2.5} />
                          {meal.location}
                        </span>
                      )}
                      {meal.time && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/80 border"
                          style={{ borderColor: meta.border, color: meta.color }}>
                          <ClockIcon size={9} strokeWidth={2.5} />
                          {meal.time}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* Categorized dishes */}
                <div className="p-2.5 space-y-2">
                  {total === 0 ? (
                    <p className="text-[11px] font-bold text-[#9D8F85] text-center py-2">لم يُضف بعد</p>
                  ) : (
                    CATEGORY_KEYS.map(catKey => {
                      const items = meal[catKey];
                      if (!items || items.length === 0) return null;
                      const cMeta = CATEGORY_META[catKey];
                      return (
                        <div key={catKey} className="rounded-xl border px-2.5 py-2"
                          style={{ background: cMeta.bg, borderColor: cMeta.border }}>
                          <p className="text-[9px] font-black flex items-center gap-1.5 mb-1.5"
                            style={{ color: cMeta.color }}>
                            <span className="w-1 h-3 rounded-full" style={{ background: cMeta.color }} />
                            {cMeta.label}
                          </p>
                          <ul className="flex flex-wrap gap-1.5">
                            {items.map((dish, i) => (
                              <li key={i}
                                className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#2D2926] bg-white border rounded-md px-2 py-0.5"
                                style={{ borderColor: cMeta.border }}>
                                <span className="w-3.5 h-3.5 rounded text-[8px] font-black text-white flex items-center justify-center shrink-0 tabular-nums"
                                  style={{ background: cMeta.color }}>
                                  {i + 1}
                                </span>
                                {dish}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
