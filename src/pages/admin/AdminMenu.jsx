import { useMemo, useState } from 'react';
import {
  UtensilsCrossed, ChevronRight, X, Search, Building2,
  Sparkles, Coffee, Sun, Moon, AlertCircle, MapPin, Clock as ClockIcon,
} from 'lucide-react';
import PageHeader from '../../components/PageHeader.jsx';
import { NATIONALITIES } from '../../config/nationalities.js';
import {
  MENUS, HAJJ_DAYS, MEAL_LABEL, CATEGORY_KEYS, CATEGORY_META,
  getMeal, getMealItems, hasMealContent,
} from '../../config/menus.js';

const MEAL_META = {
  breakfast: { label: 'الإفطار', Icon: Coffee, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  lunch:     { label: 'الغداء',  Icon: Sun,    color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5' },
  dinner:    { label: 'العشاء',  Icon: Moon,   color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
};
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];

export default function AdminMenu() {
  const [selectedNat, setSelectedNat] = useState(null);
  const [selectedDay, setSelectedDay] = useState('7');
  const [searchTerm,  setSearchTerm]  = useState('');

  /* Coverage per nationality — counts how many meals have any dishes filled in */
  const coverage = useMemo(() => {
    const map = {};
    NATIONALITIES.forEach(n => {
      let filled = 0;
      const total = HAJJ_DAYS.length * MEAL_ORDER.length; // 7×3 = 21
      HAJJ_DAYS.forEach(d => MEAL_ORDER.forEach(m => {
        if (hasMealContent(n.key, d.value, m)) filled++;
      }));
      map[n.key] = { filled, total, pct: Math.round((filled / total) * 100) };
    });
    return map;
  }, []);

  /* Filter nationalities by search */
  const filteredNats = useMemo(() => {
    if (!searchTerm.trim()) return NATIONALITIES;
    const q = searchTerm.trim().toLowerCase();
    return NATIONALITIES.filter(n => n.label.toLowerCase().includes(q));
  }, [searchTerm]);

  const activeNat = selectedNat ? NATIONALITIES.find(n => n.key === selectedNat) : null;

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      <PageHeader
        Icon={UtensilsCrossed}
        title="إدارة المنيو"
        subtitle="منيو الوجبات حسب الجنسية ويوم ذو الحجة والوجبة"
        gradient={{ from: '#F59E0B', to: '#D97706' }}
        glowColor="rgba(245,158,11,0.4)"
      />

      {!activeNat ? (
        <>
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9D8F85]" strokeWidth={2} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث بالجنسية..."
              className="w-full pr-11 pl-4 py-3 rounded-2xl border-2 border-[#EDE5DC] bg-white text-sm font-medium text-[#2D2926] placeholder:text-[#C9B8A8] focus:border-[#A98159] focus:outline-none transition-colors shadow-[0_2px_8px_rgba(45,41,38,0.05)]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-[#9D8F85] hover:bg-[#F5F0EB] transition-colors">
                <X size={14} strokeWidth={2.25} />
              </button>
            )}
          </div>

          {/* Nationality cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNats.map(n => {
              const cov = coverage[n.key];
              return (
                <button key={n.key}
                  onClick={() => setSelectedNat(n.key)}
                  className="group text-right bg-white rounded-2xl border-2 border-[#EDE5DC] p-4 shadow-[0_2px_8px_rgba(45,41,38,0.07)] hover:shadow-[0_6px_24px_rgba(169,129,89,0.18)] hover:border-[#D9CEBC] hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-2xl blur-md opacity-40 group-hover:opacity-60 transition-opacity"
                        style={{ background: n.color }} />
                      <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md"
                        style={{ background: `linear-gradient(135deg, ${n.color}, ${n.color}CC)` }}>
                        <span className="drop-shadow">{n.flag}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-black text-[#2D2926] truncate">{n.label}</p>
                      <p className="text-[10px] text-[#A98159] font-bold mt-0.5 flex items-center gap-1">
                        <Building2 size={9} strokeWidth={2.5} />
                        {n.centers.length} مركز
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[#C9B8A8] group-hover:text-[#A98159] transition-colors shrink-0"
                      strokeWidth={2.25} />
                  </div>

                  {/* Coverage bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-[#9D8F85]">المنيو المعبأ</span>
                      <span className="text-[11px] font-black tabular-nums"
                        style={{ color: cov.pct === 100 ? '#10B981' : cov.pct > 0 ? n.color : '#9D8F85' }}>
                        {cov.filled}/{cov.total} · {cov.pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-[#F5F0EB] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cov.pct}%`,
                          background: cov.pct === 100 ? '#10B981' : n.color,
                        }} />
                    </div>
                  </div>

                  {/* Hint */}
                  {cov.filled === 0 && (
                    <div className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                      <AlertCircle size={10} strokeWidth={2.5} />
                      لم يُضف منيو بعد
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="bg-gradient-to-br from-[#FDF8F0] to-white border border-[#E8DDD4] rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
              <Sparkles size={15} className="text-white" strokeWidth={2.25} />
            </div>
            <div className="flex-1 text-[11px] text-[#6D6E71] leading-relaxed">
              <p className="font-black text-[#2D2926] mb-0.5 text-xs">تعديل المنيو</p>
              <p>
                المنيو مخزن في الملف <code className="bg-white border border-[#E8DDD4] px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5">src/config/menus.js</code>
                {' '}— لتعديل أو إضافة أطباق، حدّث القيم في الملف ثم احفظ. يظهر التغيير فوراً للمراقب والمشرف.
              </p>
            </div>
          </div>
        </>
      ) : (
        /* ─── Nationality detail view ─── */
        <NationalityDetail
          nat={activeNat}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          onBack={() => setSelectedNat(null)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   NationalityDetail — day tabs + 3 meal panels with dishes
══════════════════════════════════════════════════════════════════ */
function NationalityDetail({ nat, selectedDay, setSelectedDay, onBack }) {
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-gradient-to-br from-white to-[#FDF8F0] border border-[#E8DDD4] rounded-2xl p-4 flex items-center gap-3 shadow-[0_2px_8px_rgba(45,41,38,0.07)]">
        <button onClick={onBack}
          className="min-w-[40px] min-h-[40px] rounded-xl border border-[#D9CEBC] bg-white text-[#A98159] flex items-center justify-center hover:bg-[#FDF8F0] hover:border-[#A98159] transition-all shrink-0"
          title="رجوع">
          <X size={16} strokeWidth={2.25} />
        </button>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl blur-md opacity-50" style={{ background: nat.color }} />
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md"
            style={{ background: `linear-gradient(135deg, ${nat.color}, ${nat.color}CC)` }}>
            {nat.flag}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-[#2D2926] truncate">منيو {nat.label}</p>
          <p className="text-[11px] text-[#A98159] font-bold mt-0.5">
            {nat.centers.length} مركز · {nat.centers.map(c => `مركز ${c}`).slice(0, 4).join('، ')}
            {nat.centers.length > 4 && ` +${nat.centers.length - 4}`}
          </p>
        </div>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {HAJJ_DAYS.map(d => (
          <button key={d.value}
            onClick={() => setSelectedDay(d.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${
              selectedDay === d.value
                ? 'text-white shadow-md'
                : 'bg-white text-[#6D6E71] border-[#D9CEBC] hover:border-[#A98159] hover:text-[#A98159]'
            }`}
            style={selectedDay === d.value
              ? { background: `linear-gradient(135deg, ${nat.color}, ${nat.color}DD)`, borderColor: nat.color }
              : undefined}>
            {d.label}
          </button>
        ))}
      </div>

      {/* 3 meal panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MEAL_ORDER.map(mealKey => {
          const meta  = MEAL_META[mealKey];
          const meal  = getMeal(nat.key, selectedDay, mealKey);
          const total = getMealItems(nat.key, selectedDay, mealKey).length;
          const MIcon = meta.Icon;
          return (
            <div key={mealKey}
              className="bg-white rounded-2xl border-2 overflow-hidden shadow-[0_2px_12px_rgba(45,41,38,0.07)]"
              style={{ borderColor: meta.border }}>
              {/* Meal header */}
              <div className="px-4 py-3 border-b"
                style={{ background: meta.bg, borderColor: meta.border }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm"
                    style={{ border: `1.5px solid ${meta.border}` }}>
                    <MIcon size={18} style={{ color: meta.color }} strokeWidth={2.25} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black" style={{ color: meta.color }}>{meta.label}</p>
                    <p className="text-[10px] font-bold text-[#6D6E71] mt-0.5">
                      {total > 0 ? `${total} صنف` : 'لم يُضف بعد'}
                    </p>
                  </div>
                </div>
                {(meal.location || meal.time) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {meal.location && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 border"
                        style={{ borderColor: meta.border, color: meta.color }}>
                        <MapPin size={10} strokeWidth={2.5} />
                        {meal.location}
                      </span>
                    )}
                    {meal.time && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 border"
                        style={{ borderColor: meta.border, color: meta.color }}>
                        <ClockIcon size={10} strokeWidth={2.5} />
                        {meal.time}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Categorized dish list */}
              <div className="p-4 space-y-3">
                {total === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F0EB] border border-[#E8DDD4] flex items-center justify-center mx-auto mb-2">
                      <UtensilsCrossed size={16} className="text-[#C9B8A8]" strokeWidth={2} />
                    </div>
                    <p className="text-[11px] font-bold text-[#9D8F85]">لم يتم إضافة المنيو بعد</p>
                  </div>
                ) : (
                  CATEGORY_KEYS.map(catKey => {
                    const items = meal[catKey];
                    if (!items || items.length === 0) return null;
                    const cMeta = CATEGORY_META[catKey];
                    return (
                      <div key={catKey} className="rounded-xl border p-2.5"
                        style={{ background: cMeta.bg, borderColor: cMeta.border }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-black flex items-center gap-1.5" style={{ color: cMeta.color }}>
                            <span className="w-1.5 h-3.5 rounded-full" style={{ background: cMeta.color }} />
                            {cMeta.label}
                          </p>
                          <span className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-md bg-white"
                            style={{ color: cMeta.color, border: `1px solid ${cMeta.border}` }}>
                            {items.length}
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {items.map((dish, i) => (
                            <li key={i}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-white/70 border border-white/80">
                              <span className="w-4 h-4 rounded text-[9px] font-black text-white flex items-center justify-center shrink-0 tabular-nums"
                                style={{ background: cMeta.color }}>
                                {i + 1}
                              </span>
                              <p className="text-[12px] text-[#2D2926] font-medium leading-relaxed flex-1">{dish}</p>
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

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
