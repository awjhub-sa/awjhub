import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ForkKnife as UtensilsCrossed,
  Buildings as Building2,
  SunHorizon as Sunrise,
  Sun as SunMedium,
  MoonStars as MoonStar,
  MapPin,
  Clock as ClockIcon,
  Info,
  PencilSimple,
  Plus,
  UploadSimple,
  CloudCheck,
  WarningCircle,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import MealEditor from '../../components/menu/MealEditor.jsx';
import MenuImport from '../../components/menu/MenuImport.jsx';
import { NATIONALITIES } from '../../config/nationalities.js';
import { db } from '../../lib/db.js';
import { refreshMenus, useMenuVersion } from '../../lib/menuStore.js';
import { refreshNationalities, useNationalityVersion } from '../../lib/nationalityStore.js';
import {
  HAJJ_DAYS, CATEGORY_KEYS, CATEGORY_META, getMeal, getMealItems, isSavedMeal,
} from '../../config/menus.js';

const MEAL_META = {
  breakfast: { label: 'الإفطار', Icon: Sunrise,   color: '#F59E0B' },
  lunch:     { label: 'الغداء',  Icon: SunMedium, color: '#4E7CB0' },
  dinner:    { label: 'العشاء',  Icon: MoonStar,  color: '#B4674E' },
};
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];

const AR = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

/* PostgREST answers a missing table with PGRST205 and an English sentence about
   a schema cache, which tells an operations manager nothing. Until 008_menus.sql
   has been run this is the only failure they can hit, so it gets named. */
const MISSING_TABLE = 'جدول المنيو غير موجود بعد — شغّل ملف supabase/migrations/008_menus.sql في لوحة Supabase.';
const explain = (err) => {
  const msg = err?.message || '';
  if (err?.code === 'PGRST205' || /schema cache|public\.menus/i.test(msg)) return MISSING_TABLE;
  return msg || 'تعذّر الحفظ — تحقّق من الاتصال';
};

/**
 * The menu, read the way it is used: pick who is eating, pick the day, see the
 * three meals side by side — and now written the same way.
 *
 * The dishes used to live in a source file, which was fine while one operator
 * used the system. Each company brings its own nationalities and its own
 * kitchen, so a menu is data the customer owns: typed here, or imported from
 * the spreadsheet they already keep. What ships in the file remains the
 * fallback, so nothing is ever blank while a season is half-entered.
 */
export default function AdminMenu() {
  const [natKey, setNatKey] = useState(NATIONALITIES[0]?.key ?? null);
  const [day, setDay]       = useState('7');

  const [seasonId, setSeasonId] = useState(null);
  const [rows, setRows]         = useState([]);      // saved menu rows
  const [editing, setEditing]   = useState(null);    // meal key being edited
  const [importing, setImporting] = useState(false);
  const [seedLines, setSeedLines] = useState(null);  // handed over from OCR
  const [toast, setToast]       = useState('');
  const [tableMissing, setTableMissing] = useState(false);

  /* Re-renders when the overlay changes, so the cards below follow a save
     without this screen having to thread the new values through by hand. */
  useMenuVersion();
  /* And when the season's roster does — the rail below is drawn from it. */
  useNationalityVersion();

  const nat = useMemo(() => NATIONALITIES.find(n => n.key === natKey) || null, [natKey]);
  const dayMeta = useMemo(() => HAJJ_DAYS.find(d => d.value === day) || null, [day]);

  useEffect(() => {
    const unsub = db.seasons.subscribe(list => {
      setSeasonId(list.find(s => s.isActive)?.id ?? null);
    });
    return unsub;
  }, []);

  const reload = useCallback(async () => {
    await refreshNationalities(seasonId);
    const list = await db.menus.list();
    setRows(list);
    await refreshMenus(seasonId);
  }, [seasonId]);

  /* Probes once for the table itself. A save that fails with an English note
     about a schema cache is a dead end; a banner before anyone types is not. */
  useEffect(() => {
    let alive = true;
    db.menus.probe().then(r => { if (alive) setTableMissing(!r.ok); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const rowFor = useCallback(
    (mealKey) => rows.find(r =>
      r.nationalityId === natKey && String(r.day) === String(day) && r.meal === mealKey) || null,
    [rows, natKey, day],
  );

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };

  /* Save one meal. An existing row is updated rather than upserted: season_id
     is nullable until a season exists, and ON CONFLICT cannot see a NULL. */
  const saveMeal = async (mealKey, payload, { source = 'manual', sourceFile = null } = {}) => {
    const existing = rowFor(mealKey);
    const body = {
      ...payload,
      nationalityId: natKey, day, meal: mealKey,
      source, sourceFile, updatedAt: new Date(),
    };
    try {
      if (existing) await db.menus.update(existing.id, body);
      else await db.menus.insert(body);
    } catch (err) { throw new Error(explain(err)); }
    await reload();
    flash('حُفظ المنيو');
  };

  const deleteMeal = async (mealKey) => {
    const existing = rowFor(mealKey);
    try {
      if (existing) await db.menus.delete(existing.id);
    } catch (err) { throw new Error(explain(err)); }
    await reload();
    flash('حُذف المنيو — عاد المنيو الافتراضي');
  };

  /* A sheet arrives as many meals at once, each already carrying its day.
     Two rows in one file can land on the same meal — a corrected line left
     below the original, most often. The last one wins, which is what someone
     who edited their sheet downwards expects, and it keeps the pass from
     inserting twice into a slot that only allows one. */
  const applySheet = async (parsedRows, fileName) => {
    const bySlot = new Map();
    for (const r of parsedRows) bySlot.set(`${r.day}|${r.meal}`, r);

    for (const r of bySlot.values()) {
      const existing = rows.find(x =>
        x.nationalityId === natKey && String(x.day) === String(r.day) && x.meal === r.meal);
      const body = {
        nationalityId: natKey, day: String(r.day), meal: r.meal,
        location: r.location, time: r.time,
        ...Object.fromEntries(CATEGORY_KEYS.map(k => [k, r[k] || []])),
        source: 'excel', sourceFile: fileName || null, updatedAt: new Date(),
      };
      try {
        if (existing) await db.menus.update(existing.id, body);
        else await db.menus.insert(body);
      } catch (err) { throw new Error(explain(err)); }
    }
    await reload();
    flash(`استُوردت ${AR(bySlot.size)} وجبة`);
  };

  const dayTotal = useMemo(() => {
    if (!nat) return 0;
    return MEAL_ORDER.reduce((n, m) => n + getMealItems(nat.key, day, m).length, 0);
  }, [nat, day, rows]);

  const savedCount = useMemo(
    () => rows.filter(r => r.nationalityId === natKey).length,
    [rows, natKey],
  );

  return (
    <div className="space-y-4 pb-6" dir="rtl">
      <PageHeader
        kicker="متابعة الوجبات"
        Icon={UtensilsCrossed}
        title="المنيو"
        subtitle={nat ? `${nat.label} — ${dayMeta?.label ?? ''}` : 'اختر جنسية'}
        stats={[
          { value: AR(NATIONALITIES.length), label: 'جنسية' },
          { value: AR(nat?.centers.length ?? 0), label: 'مركز لهذه الجنسية' },
          { value: AR(dayTotal), label: 'صنف في هذا اليوم', tone: 'gold' },
        ]}
        heroActions={nat && (
          <button onClick={() => setImporting(true)}
            className="h-9 px-4 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25
                       text-white text-[12px] font-black flex items-center gap-1.5 transition-colors">
            <UploadSimple size={14} weight="bold" />
            استيراد منيو
          </button>
        )}
      />

      {tableMissing && (
        <div className="rounded-2xl border p-3.5 flex gap-2.5"
          style={{ borderColor: '#EBCFC3', background: 'color-mix(in srgb, #B4674E 8%, #fff)' }}>
          <WarningCircle size={17} weight="bold" style={{ color: '#B4674E' }} className="flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[12px] font-black text-ink">الحفظ غير مفعّل بعد</p>
          </div>
        </div>
      )}

      {/* ── Who is eating ──
          A rail, not a screen: the choice stays visible so switching between
          two nationalities is one click rather than a round trip. */}
      <section className="bg-white rounded-2xl border border-line p-3">
        <p className="text-[10px] font-black text-muted/70 tracking-widest mb-2 px-1">الجنسية</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {NATIONALITIES.map(n => {
            const on = n.key === natKey;
            const saved = rows.filter(r => r.nationalityId === n.key).length;
            return (
              <button key={n.key} onClick={() => setNatKey(n.key)}
                className={`relative flex-shrink-0 flex items-center gap-2.5 pr-2 pl-3.5 py-2 rounded-xl border transition-all ${
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
                {/* A dot, not a number: it answers "did anyone enter menus for
                    these pilgrims" without competing with the label. */}
                {saved > 0 && (
                  <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-success" />
                )}
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
              <MealCard key={key} natKey={nat.key} day={day} mealKey={key}
                onEdit={() => setEditing(key)} />
            ))}
          </div>
        </>
      )}

      {/* ── Write one meal ── */}
      {editing && nat && (
        <MealEditor
          open
          onClose={() => { setEditing(null); setSeedLines(null); }}
          natLabel={nat.label}
          dayLabel={dayMeta?.label ?? ''}
          mealLabel={MEAL_META[editing].label}
          mealColor={MEAL_META[editing].color}
          initial={getMeal(nat.key, day, editing)}
          isSaved={Boolean(rowFor(editing))}
          seedLines={seedLines}
          onSave={(payload) => saveMeal(editing, payload)}
          onDelete={() => deleteMeal(editing)}
        />
      )}

      {/* ── Bring one in from a file ── */}
      {importing && nat && (
        <MenuImport
          open
          onClose={() => setImporting(false)}
          natLabel={nat.label}
          currentDay={day}
          onApplySheet={applySheet}
          onApplyImage={(lines, meal) => { setSeedLines(lines); setEditing(meal); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2
                        px-4 py-2.5 rounded-xl bg-ink text-white text-[12px] font-black
                        shadow-[0_10px_30px_rgb(var(--c-ink)/0.4)] animate-[amToast_.2s_ease-out]">
          <CloudCheck size={15} weight="bold" className="text-success" />
          {toast}
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes amToast { from { opacity: 0; transform: translate(-50%, 8px); }
                             to   { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}

/* One meal.
 *
 * The dishes used to sit in a coloured box inside a coloured box inside a
 * bordered card, each with a numbered square — three frames and a counter
 * around every line of text. Now the category is a labelled rule and the dish
 * is just the dish. */
function MealCard({ natKey, day, mealKey, onEdit }) {
  const meta = MEAL_META[mealKey];
  const meal = getMeal(natKey, day, mealKey);
  const total = getMealItems(natKey, day, mealKey).length;
  const saved = isSavedMeal(natKey, day, mealKey);
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
            <p className="text-[10px] font-bold text-muted mt-0.5 flex items-center gap-1">
              {total > 0 ? `${AR(total)} صنف` : 'لم يُضف بعد'}
              {saved && (
                <>
                  <span className="text-muted/40">·</span>
                  <span className="inline-flex items-center gap-0.5 text-success">
                    <CloudCheck size={10} weight="bold" />
                    محفوظ
                  </span>
                </>
              )}
            </p>
          </div>

          <button onClick={onEdit} title={total > 0 ? 'تعديل المنيو' : 'إضافة منيو'}
            className="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0
                       transition-colors hover:bg-background"
            style={{ borderColor: `color-mix(in srgb, ${meta.color} 35%, #fff)`, color: meta.color }}>
            {total > 0
              ? <PencilSimple size={14} weight="bold" />
              : <Plus size={15} weight="bold" />}
          </button>
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
          <button onClick={onEdit}
            className="w-full py-8 flex flex-col items-center gap-1.5 rounded-xl border border-dashed
                       transition-colors hover:bg-background"
            style={{ borderColor: `color-mix(in srgb, ${meta.color} 30%, #fff)` }}>
            <Plus size={16} weight="bold" style={{ color: meta.color }} />
            <span className="text-[11px] font-black" style={{ color: meta.color }}>إضافة منيو {meta.label}</span>
            <span className="text-[10px] font-bold text-muted">أو استورد ملفاً من الأعلى</span>
          </button>
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
