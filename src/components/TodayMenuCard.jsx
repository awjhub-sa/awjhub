import { useEffect, useMemo, useState } from 'react';
import {
  ForkKnife as UtensilsCrossed,
  SunHorizon as Sunrise,
  Sun as SunMedium,
  MoonStars as MoonStar,
  WarningCircle as AlertCircle,
  Buildings as Building2,
  CalendarBlank as Calendar,
  MapPin,
  Clock as ClockIcon,
} from '@phosphor-icons/react';
import { getCenterNationalities } from '../config/nationalities.js';
import {
  HAJJ_DAYS, CATEGORY_KEYS, CATEGORY_META,
  getMeal, getMealItems,
} from '../config/menus.js';
import { useMenuVersion } from '../lib/menuStore.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const MEAL_META = {
  breakfast: { label: 'الإفطار', Icon: Sunrise,   color: '#F59E0B' },
  lunch:     { label: 'الغداء',  Icon: SunMedium, color: '#4E7CB0' },
  dinner:    { label: 'العشاء',  Icon: MoonStar,  color: '#B4674E' },
};
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];

export default function TodayMenuCard({ centerId, centerIds, defaultDay = '7' }) {
  /* Saved menus arrive after first paint; this re-renders when they do. */
  useMenuVersion();

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

  const headColor = nat?.color || 'rgb(var(--c-primary))';

  return (
    <div className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b flex items-center gap-3"
        style={{ background: tint(headColor, 12), borderColor: tint(headColor, 28) }}>
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border text-xl"
          style={{ background: tint(headColor, 9), borderColor: tint(headColor, 22) }}>
          {nat ? nat.flag : <UtensilsCrossed size={19} weight="duotone" style={{ color: headColor }} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold truncate leading-tight" style={{ color: headColor }}>
            منيو اليوم {nat ? `· ${nat.label}` : ''}
          </p>
          <p className="text-[11.5px] text-muted font-medium mt-1 flex items-center gap-1.5">
            <Building2 size={11} weight="bold" className="text-muted/60" />
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
                  className={`flex-shrink-0 px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-colors border ${
                    active
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-muted border-line hover:border-primary hover:text-primary'
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
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {nationalities.map(n => {
              const active = n.key === (nat?.key);
              return (
                <button key={n.key}
                  onClick={() => setActiveNatKey(n.key)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-colors border ${
                    active ? 'text-white' : 'bg-white text-muted border-line hover:border-current'
                  }`}
                  style={active
                    ? { background: n.color, borderColor: n.color }
                    : { color: n.color, borderColor: 'rgb(var(--c-line))' }}>
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
              className={`flex-shrink-0 px-3 py-1.5 rounded-[10px] text-[11px] font-bold transition-colors border ${
                selectedDay === d.value
                  ? 'text-white'
                  : 'bg-white text-muted border-line hover:border-primary hover:text-primary'
              }`}
              style={selectedDay === d.value
                ? { background: headColor, borderColor: headColor }
                : undefined}>
              <Calendar size={10} className="inline-block ms-0 me-1 -mt-0.5" weight="bold" />
              {d.dayAr} ذو الحجة
            </button>
          ))}
        </div>
      </div>

      {/* Meals */}
      {!nat ? (
        <div className="py-12 px-5 text-center">
          <AlertCircle size={26} weight="duotone" className="mx-auto text-muted/35" />
          <p className="text-[13px] font-semibold text-muted mt-3">لم يتم تحديد جنسية لهذا المركز</p>
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
                className="rounded-[14px] border overflow-hidden"
                style={{ borderColor: tint(meta.color, 28) }}>
                {/* Meal header */}
                <div className="px-3.5 py-2.5 border-b"
                  style={{ background: tint(meta.color, 12), borderColor: tint(meta.color, 28) }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{ background: tint(meta.color, 9), borderColor: tint(meta.color, 22) }}>
                      <MIcon size={15} weight="duotone" style={{ color: meta.color }} />
                    </span>
                    <p className="text-[13px] font-bold flex-1" style={{ color: meta.color }}>{meta.label}</p>
                    <span className="text-[10.5px] font-bold tabular-nums px-1.5 py-[3px] rounded-md leading-none"
                      style={{ background: tint(meta.color, 11), color: meta.color }}>
                      {total}
                    </span>
                  </div>
                  {(meal.location || meal.time) && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {meal.location && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none"
                          style={{ background: tint(meta.color, 11), color: meta.color }}>
                          <MapPin size={10} weight="bold" />
                          {meal.location}
                        </span>
                      )}
                      {meal.time && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none"
                          style={{ background: tint(meta.color, 11), color: meta.color }}>
                          <ClockIcon size={10} weight="bold" />
                          {meal.time}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* Categorized dishes */}
                <div className="px-3.5 py-3 space-y-3">
                  {total === 0 ? (
                    <p className="text-[11.5px] font-medium text-muted text-center py-2">لم يُضف بعد</p>
                  ) : (
                    CATEGORY_KEYS.map(catKey => {
                      const items = meal[catKey];
                      if (!items || items.length === 0) return null;
                      const cMeta = CATEGORY_META[catKey];
                      return (
                        <div key={catKey}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cMeta.color }} />
                            <span className="text-[10.5px] font-bold" style={{ color: cMeta.color }}>{cMeta.label}</span>
                            <span className="h-px flex-1" style={{ background: tint(cMeta.color, 28) }} />
                            <span className="text-[10px] font-bold tabular-nums text-muted">{items.length}</span>
                          </div>
                          <ul className="space-y-1 ps-3.5">
                            {items.map((dish, i) => (
                              <li key={i} className="text-[12px] text-ink font-medium leading-relaxed flex gap-2">
                                <span className="text-muted/40 shrink-0">·</span>
                                <span className="flex-1">{dish}</span>
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
