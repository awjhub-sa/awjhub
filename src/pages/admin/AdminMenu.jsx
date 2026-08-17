import { useMemo, useState } from 'react';
import {
  ForkKnife as UtensilsCrossed,
  Buildings as Building2,
  SunHorizon as Sunrise,
  Sun as SunMedium,
  MoonStars as MoonStar,
  MapPin,
  Clock as ClockIcon,
  Info,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { NATIONALITIES } from '../../config/nationalities.js';
import {
  HAJJ_DAYS, CATEGORY_KEYS, CATEGORY_META, getMeal, getMealItems,
} from '../../config/menus.js';

const MEAL_META = {
  breakfast: { label: 'الإفطار', Icon: Sunrise,   color: '#F59E0B' },
  lunch:     { label: 'الغداء',  Icon: SunMedium, color: '#4E7CB0' },
  dinner:    { label: 'العشاء',  Icon: MoonStar,  color: '#B4674E' },
};
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];

const AR = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

/**
 * The menu, read the way it is used: pick who is eating, pick the day, see the
 * three meals side by side.
 *
 * It used to be two screens — a grid of nationality cards that replaced itself
 * with a detail view, and an X to come back. Comparing Monday's lunch for two
 * nationalities meant four navigations. Both choices are now rails that stay on
 * screen, so switching either is one click and the answer never leaves.
 */
export default function AdminMenu() {
  const [natKey, setNatKey] = useState(NATIONALITIES[0]?.key ?? null);
  const [day, setDay]       = useState('7');

  const nat = useMemo(() => NATIONALITIES.find(n => n.key === natKey) || null, [natKey]);

  const dayTotal = useMemo(() => {
    if (!nat) return 0;
    return MEAL_ORDER.reduce((n, m) => n + getMealItems(nat.key, day, m).length, 0);
  }, [nat, day]);

  return (
    <div className="space-y-4 pb-6" dir="rtl">
      <PageHeader
        kicker="متابعة الوجبات"
        Icon={UtensilsCrossed}
        title="المنيو"
        subtitle={nat ? `${nat.label} — ${HAJJ_DAYS.find(d => d.value === day)?.label ?? ''}` : 'اختر جنسية'}
        stats={[
          { value: AR(NATIONALITIES.length), label: 'جنسية' },
          { value: AR(nat?.centers.length ?? 0), label: 'مركز لهذه الجنسية' },
          { value: AR(dayTotal), label: 'صنف في هذا اليوم', tone: 'gold' },
        ]}
      />

      {/* ── Who is eating ──
          A rail, not a screen: the choice stays visible so switching between
          two nationalities is one click rather than a round trip. */}
      <section className="bg-white rounded-2xl border border-line p-3">
        <p className="text-[10px] font-black text-muted/70 tracking-widest mb-2 px-1">الجنسية</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {NATIONALITIES.map(n => {
            const on = n.key === natKey;
            return (
              <button key={n.key} onClick={() => setNatKey(n.key)}
                className={`flex-shrink-0 flex items-center gap-2.5 pr-2 pl-3.5 py-2 rounded-xl border transition-all ${
                  on ? 'shadow-[0_3px_12px_rgb(var(--c-ink)/0.12)]' : 'bg-white border-line hover:border-primary/40'
                }`}
                style={on
                  ? { background: `color-mix(in srgb, ${n.color} 10%, #fff)`, borderColor: n.color }
                  : undefined}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${n.color} 14%, #fff)` }}>
                  {n.flag}
                </span>
                <span className="text-right">
                  <span className={`block text-[12px] font-black whitespace-nowrap ${on ? '' : 'text-ink'}`}
                    style={on ? { color: n.color } : undefined}>
                    {n.label}
                  </span>
                  <span className="block text-[9.5px] font-bold text-muted flex items-center gap-1 mt-0.5">
                    <Building2 size={9} weight="bold" />
                    {AR(n.centers.length)} مركز
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {nat && (
        <>
          {/* ── Which day ──
              The number leads and the label follows, because the operations
              room says "the ninth", never "Tuesday". */}
          <section className="bg-white rounded-2xl border border-line p-3">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[10px] font-black text-muted/70 tracking-widest">يوم الحج</p>
              <p className="text-[10px] font-bold text-muted truncate">
                {nat.centers.slice(0, 6).map(c => `مركز ${c}`).join('، ')}
                {nat.centers.length > 6 && ` +${AR(nat.centers.length - 6)}`}
              </p>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {HAJJ_DAYS.map(d => {
                const on = d.value === day;
                const n = MEAL_ORDER.reduce((t, m) => t + getMealItems(nat.key, d.value, m).length, 0);
                return (
                  <button key={d.value} onClick={() => setDay(d.value)}
                    className={`rounded-xl border py-2 transition-all ${
                      on ? 'text-white border-transparent shadow-[0_4px_14px_rgb(var(--c-primary)/0.3)]'
                         : 'bg-white border-line hover:border-primary/40'
                    }`}
                    style={on
                      ? { background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }
                      : undefined}>
                    <span className={`block text-lg font-black tabular-nums leading-none ${on ? '' : 'text-ink'}`}>
                      {AR(d.value)}
                    </span>
                    <span className={`block text-[9px] font-bold mt-1 ${on ? 'text-white/70' : 'text-muted'}`}>
                      {n > 0 ? `${AR(n)} صنف` : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── The three meals ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MEAL_ORDER.map(key => (
              <MealCard key={key} natKey={nat.key} day={day} mealKey={key} />
            ))}
          </div>
        </>
      )}

      <p className="flex items-start gap-2 text-[11px] text-muted leading-relaxed px-1">
        <Info size={13} weight="bold" className="text-muted/60 mt-0.5 flex-shrink-0" />
        المنيو مخزَّن في <code className="bg-white border border-line px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5">src/config/menus.js</code>
        — عدّل القيم هناك ويظهر التغيير فوراً للمراقب والمشرف.
      </p>

      <style>{'.no-scrollbar::-webkit-scrollbar { display: none; }'}</style>
    </div>
  );
}

/* One meal.
 *
 * The dishes used to sit in a coloured box inside a coloured box inside a
 * bordered card, each with a numbered square — three frames and a counter
 * around every line of text. Now the category is a labelled rule and the dish
 * is just the dish. */
function MealCard({ natKey, day, mealKey }) {
  const meta = MEAL_META[mealKey];
  const meal = getMeal(natKey, day, mealKey);
  const total = getMealItems(natKey, day, mealKey).length;
  const MIcon = meta.Icon;

  return (
    <section className="relative bg-white rounded-2xl border border-line overflow-hidden flex flex-col">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: meta.color }} />

      <header className="px-4 pt-4 pb-3 border-b border-line">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${meta.color} 12%, #fff)` }}>
            <MIcon size={17} weight="bold" style={{ color: meta.color }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black" style={{ color: meta.color }}>{meta.label}</p>
            <p className="text-[10px] font-bold text-muted mt-0.5">
              {total > 0 ? `${AR(total)} صنف` : 'لم يُضف بعد'}
            </p>
          </div>
        </div>

        {(meal.location || meal.time) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            {meal.location && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border border-line bg-background text-ink">
                <MapPin size={10} weight="bold" style={{ color: meta.color }} />
                {meal.location}
              </span>
            )}
            {meal.time && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border border-line bg-background text-ink">
                <ClockIcon size={10} weight="bold" style={{ color: meta.color }} />
                {meal.time}
              </span>
            )}
          </div>
        )}
      </header>

      <div className="p-4 flex-1">
        {total === 0 ? (
          <p className="text-[11px] font-bold text-muted/70 text-center py-8">لم يُضف المنيو بعد</p>
        ) : (
          <div className="space-y-3.5">
            {CATEGORY_KEYS.map(catKey => {
              const items = meal[catKey];
              if (!items?.length) return null;
              const c = CATEGORY_META[catKey];
              return (
                <div key={catKey}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-[10px] font-black" style={{ color: c.color }}>{c.label}</span>
                    <span className="h-px flex-1" style={{ background: c.border }} />
                    <span className="text-[9px] font-black tabular-nums text-muted">{AR(items.length)}</span>
                  </div>
                  <ul className="space-y-1 pr-3.5">
                    {items.map((dish, i) => (
                      <li key={i} className="text-[12px] text-ink font-medium leading-relaxed flex gap-2">
                        <span className="text-muted/40 flex-shrink-0">·</span>
                        <span className="flex-1">{dish}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
