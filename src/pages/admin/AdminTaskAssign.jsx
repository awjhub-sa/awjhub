import { useState, useEffect } from 'react';
import { db, serverTimestamp } from '../../lib/db.js';
import {
  Target,
  ChefHat,
  Tent,
  Compass,
  Globe as Earth,
  CalendarCheck,
  Rocket,
  Sparkle as Sparkles,
  Buildings as Building2,
  CheckCircle as CheckCircle2,
  CaretDown as ChevronDown,
  CaretUp as ChevronUp,
  Clock,
  WarningCircle as AlertCircle,
  X,
  Stack as Layers,
  MagnifyingGlass as Search,
  Trash as Trash2,
  Fire as Flame,
  Package,
  ShieldCheck,
} from '@phosphor-icons/react';
import {
  SunHorizon as Sunrise,
  Sun as SunMedium,
  MoonStars as MoonStar,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { Surface, IconTile, Pill } from '../../components/ui/index.jsx';
import { CENTERS } from '../../config/centers.js';
import { NATIONALITIES, NAT_LABEL as NAT_LABEL_SHARED } from '../../config/nationalities.js';
import { extractCenterNum, extractDay } from '../../hooks/useAssignedTasks.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

function centerNum(id) {
  return parseInt((id || '').replace(/[^0-9]/g, '')) || 0;
}
function fullDate(ts) {
  if (!ts) return '—';
  return (ts.toDate ? ts.toDate() : new Date(ts))
    .toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

const TASKS = [
  { key: 'meal_evaluation',  label: 'تقييم الوجبات', icon: ChefHat,  color: 'rgb(var(--c-primary))', hasMeals: true  },
  { key: 'mina_readiness',   label: 'جاهزية منى',    icon: Tent,     color: '#16A34A', hasMeals: false },
  { key: 'arafat_readiness', label: 'جاهزية عرفة',   icon: Compass,  color: '#3D6795', hasMeals: false },
];

const MEALS = [
  { key: 'breakfast', label: 'الإفطار', icon: Sunrise,   color: '#F59E0B' },
  { key: 'lunch',     label: 'الغداء',  icon: SunMedium, color: '#4E7CB0' },
  { key: 'dinner',    label: 'العشاء',  icon: MoonStar,  color: '#B4674E' },
];

const MEAL_CATEGORIES = [
  { key: 'cooked',     label: 'وجبة مطبوخة', icon: Flame,       color: '#DC2626' },
  { key: 'dry',        label: 'وجبة جافة',   icon: Package,     color: 'rgb(var(--c-primary))' },
  { key: 'sterilized', label: 'وجبة معقمة',  icon: ShieldCheck, color: '#3D6795' },
];

const DHU_HIJJAH_DAYS = [
  { value: '7',  dayAr: '٧',  label: '٧ ذو الحجة ١٤٤٧'  },
  { value: '8',  dayAr: '٨',  label: '٨ ذو الحجة ١٤٤٧'  },
  { value: '9',  dayAr: '٩',  label: '٩ ذو الحجة ١٤٤٧'  },
  { value: '10', dayAr: '١٠', label: '١٠ ذو الحجة ١٤٤٧' },
  { value: '11', dayAr: '١١', label: '١١ ذو الحجة ١٤٤٧' },
  { value: '12', dayAr: '١٢', label: '١٢ ذو الحجة ١٤٤٧' },
  { value: '13', dayAr: '١٣', label: '١٣ ذو الحجة ١٤٤٧' },
];

const TASK_LABEL = {
  meal_evaluation:  'تقييم الوجبات',
  mina_readiness:   'جاهزية منى',
  arafat_readiness: 'جاهزية عرفة',
};
const MEAL_LABEL = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
const MEAL_CATEGORY_LABEL = Object.fromEntries(MEAL_CATEGORIES.map(c => [c.key, c.label]));
const NAT_LABEL  = NAT_LABEL_SHARED;

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

function AssignmentCard({ item }) {
  const [open,      setOpen]      = useState(false);
  const [confirm,   setConfirm]   = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const natLabels   = item.targetNationalities?.length
    ? item.targetNationalities.map(k => NAT_LABEL[k] || k).join('، ')
    : null;
  const taskLabels  = item.taskTypes?.map(k => TASK_LABEL[k] || k).join(' + ') || '—';
  const centerCount = item.targetCenters?.length ?? 0;

  const dateDisplay = item.scheduledDate
    ? (item.scheduledDate?.toDate
        ? new Date(item.scheduledDate.toDate()).toLocaleDateString('ar-SA', { dateStyle: 'long' })
        : String(item.scheduledDate))
    : '—';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await db.assigned_tasks.delete(item.id);
      if (
        item.taskTypes?.includes('meal_evaluation') &&
        item.mealTypes?.length &&
        item.targetCenters?.length &&
        item.scheduledDate
      ) {
        const day = extractDay(
          item.scheduledDate?.toDate
            ? item.scheduledDate.toDate().toLocaleDateString('ar-SA', { dateStyle: 'long' })
            : String(item.scheduledDate)
        );
        const phaseIds = [];
        item.targetCenters.forEach(entry => {
          /* `entry` is normally the full center ID (text[]); fall back to
             the legacy numeric-only format for tasks created before the
             schema migration. */
          const centerStr = typeof entry === 'string'
            ? entry
            : CENTERS.find(c => centerNum(c.id) === Number(entry))?.id;
          if (!centerStr) return;
          item.mealTypes.forEach(mealType => {
            phaseIds.push(`${centerStr}_d${day}_${mealType}`);
          });
        });
        if (phaseIds.length) await db.meal_phases.deleteMany(phaseIds);
      }
    } catch {}
    setDeleting(false);
    setConfirm(false);
  };

  return (
    <Surface className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <IconTile Icon={Layers} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-ink truncate">{taskLabels}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {natLabels
              ? <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <Earth size={12} weight="bold" className="text-muted/60" /> {natLabels}
                </span>
              : <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <Building2 size={12} weight="bold" className="text-muted/60" /> مراكز محددة
                </span>
            }
            <span className="text-muted/50">·</span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
              <Building2 size={12} weight="bold" className="text-muted/60" /> {centerCount} مركز
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Pill color={item.status === 'completed' ? '#15803D' : '#F59E0B'}>
            {item.status === 'completed' ? 'منجز' : 'قيد الانتظار'}
          </Pill>
          <div className="flex items-center gap-1 text-[10.5px] font-medium text-muted">
            <Clock size={10} weight="bold" className="text-muted/60" />
            {fullDate(item.createdAt)}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(p => !p)}
              className="flex items-center gap-0.5 text-[10.5px] font-bold text-primary">
              {open ? <ChevronUp size={11} weight="bold" /> : <ChevronDown size={11} weight="bold" />}
              {open ? 'إخفاء' : 'تفاصيل'}
            </button>
            <span className="text-line">|</span>
            <button onClick={() => setConfirm(true)}
              className="flex items-center gap-0.5 text-[10.5px] font-bold text-red-500 hover:text-red-700 transition-colors">
              <Trash2 size={11} weight="bold" />
              حذف
            </button>
          </div>
        </div>
      </div>

      {/* Confirm delete bar */}
      {confirm && (
        <div className="border-t px-5 py-3 flex items-center justify-between gap-3"
          style={{ background: tint('#DC2626', 12), borderColor: tint('#DC2626', 28) }}>
          <p className="text-[12px] font-bold" style={{ color: '#DC2626' }}>
            سيختفي الإسناد فوراً من عند المراقبين. تأكيد الحذف؟
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setConfirm(false)}
              className="text-[11px] font-bold text-muted hover:text-ink px-2.5 py-1 rounded-[8px] border border-line bg-white transition-colors">
              إلغاء
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="text-[11px] font-bold text-white px-3 py-1 rounded-[8px] border disabled:opacity-60 transition-opacity hover:opacity-90 flex items-center gap-1.5"
              style={{ background: '#DC2626', borderColor: '#DC2626' }}>
              {deleting
                ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Trash2 size={11} weight="bold" />}
              {deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="border-t border-line bg-[rgb(var(--c-bg))] px-5 py-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-[12px]">
            <CalendarCheck size={13} style={{ color: 'rgb(var(--c-primary))' }} weight="bold" />
            <span className="text-muted font-medium">تاريخ التنفيذ:</span>
            <span className="font-bold text-ink">{dateDisplay}</span>
          </div>

          {item.mealTypes?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <ChefHat size={13} style={{ color: 'rgb(var(--c-primary))' }} weight="bold" />
              <span className="text-muted font-medium">وجبات:</span>
              {item.mealTypes.map(m => (
                <Pill key={m} color="rgb(var(--c-primary))">{MEAL_LABEL[m] || m}</Pill>
              ))}
            </div>
          )}

          {item.mealCategories?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <Layers size={13} style={{ color: 'rgb(var(--c-primary))' }} weight="bold" />
              <span className="text-muted font-medium">الأصناف:</span>
              {item.mealCategories.map(c => (
                <Pill key={c} color="rgb(var(--c-primary))">{MEAL_CATEGORY_LABEL[c] || c}</Pill>
              ))}
            </div>
          )}

          <div>
            <p className="text-[11.5px] font-medium text-muted mb-1.5 flex items-center gap-1.5">
              <Building2 size={12} weight="bold" className="text-muted/60" />
              المراكز المستهدفة ({centerCount})
            </p>
            <div className="flex flex-wrap gap-1">
              {item.targetCenters?.map(c => {
                const label = typeof c === 'string' ? c : `مركز ${c}`;
                return (
                  <span key={label} className="bg-white border border-line text-ink text-[10px] font-bold px-2 py-0.5 rounded-[8px]">
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Surface>
  );
}

/* The form is a sequence, so its panels are numbered: three interchangeable
   cards read as "three things" where the screen means "first, then, then". */
const Step = ({ n, title, hint, tone = 'rgb(var(--c-primary))' }) => (
  <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b"
    style={{ background: tint(tone, 12), borderColor: tint(tone, 28) }}>
    <span className="w-7 h-7 rounded-[10px] border flex items-center justify-center text-[12px] font-bold shrink-0"
      style={{ background: tint(tone, 9), borderColor: tint(tone, 22), color: tone }}>
      {n}
    </span>
    <p className="font-bold text-ink text-[13px] flex-1 truncate">{title}</p>
    {hint != null && (
      <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-md border shrink-0"
        style={{ color: tone, background: tint(tone, 9), borderColor: tint(tone, 22) }}>
        {hint}
      </span>
    )}
  </div>
);

export default function AdminTaskAssign() {
  const [selTasks,     setSelTasks]     = useState([]);
  const [selMeals,     setSelMeals]     = useState([]);
  const [selCategories, setSelCategories] = useState([]);
  const [selNats,      setSelNats]      = useState([]);
  const [selMode,      setSelMode]      = useState('nationality'); // 'nationality' | 'center'
  const [selCenters,   setSelCenters]   = useState([]);
  const [centerSearch, setCenterSearch] = useState('');
  const [schedDay,     setSchedDay]     = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [feedback,     setFeedback]     = useState(null);
  const [history,      setHistory]      = useState([]);
  const [showAll,      setShowAll]      = useState(false);

  const hasMeal         = selTasks.includes('meal_evaluation');
  const mealMissing     = hasMeal && selMeals.length === 0;
  const categoryMissing = hasMeal && selCategories.length === 0;

  /* All nationality.centers entries are numeric (e.g. 25) but the actual
     center IDs are strings like 'مركز 25-أ'. When selecting by nationality
     we expand each number to every CENTERS row whose ID parses to that
     number — so a nationality covering "25" assigns to both 25-أ and 25-ب. */
  const targetCenters = selMode === 'nationality'
    ? (() => {
        const nums = new Set(
          NATIONALITIES.filter(n => selNats.includes(n.key)).flatMap(n => n.centers)
        );
        return CENTERS
          .filter(c => nums.has(centerNum(c.id)))
          .map(c => c.id)
          .sort((a, b) => centerNum(a) - centerNum(b));
      })()
    : [...selCenters].sort((a, b) => centerNum(a) - centerNum(b));

  const filteredCenters = CENTERS.filter(c =>
    c.id.includes(centerSearch) || c.caterer.includes(centerSearch)
  );

  const schedLabel = DHU_HIJJAH_DAYS.find(d => d.value === schedDay)?.label || '';

  useEffect(() => {
    return db.assigned_tasks.subscribe(rows => {
      const sorted = [...rows].sort((a, b) =>
        (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      );
      setHistory(sorted);
    });
  }, []);

  const handleAssign = async () => {
    if (selTasks.length === 0)                              { setFeedback({ type: 'error', msg: 'اختر مهمة واحدة على الأقل' }); return; }
    if (mealMissing)                                        { setFeedback({ type: 'error', msg: 'اختر نوع الوجبة للتقييم' }); return; }
    if (categoryMissing)                                    { setFeedback({ type: 'error', msg: 'اختر صنف الوجبة للتقييم' }); return; }
    if (selMode === 'nationality' && selNats.length === 0)  { setFeedback({ type: 'error', msg: 'اختر جنسية واحدة على الأقل' }); return; }
    if (selMode === 'center' && selCenters.length === 0)    { setFeedback({ type: 'error', msg: 'اختر مركزاً واحداً على الأقل' }); return; }
    if (!schedDay)                                          { setFeedback({ type: 'error', msg: 'حدد يوم التنفيذ' }); return; }

    setSubmitting(true);
    setFeedback(null);
    try {
      await db.assigned_tasks.insert({
        taskTypes:           selTasks,
        mealTypes:           hasMeal ? selMeals : [],
        mealCategories:      hasMeal ? selCategories : [],
        targetNationalities: selMode === 'nationality' ? selNats : [],
        targetCenters:       targetCenters,
        scheduledDate:       schedLabel,
        createdAt:           serverTimestamp(),
      });
      setFeedback({ type: 'success', msg: 'تم إسناد المهام بنجاح ✓' });
      setSelTasks([]); setSelMeals([]); setSelCategories([]); setSelNats([]); setSelCenters([]); setSchedDay('');
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setFeedback({ type: 'error', msg: 'حدث خطأ أثناء الحفظ، حاول مجدداً' });
    }
    setSubmitting(false);
  };

  const removeTask   = key => {
    setSelTasks(p => p.filter(x => x !== key));
    if (key === 'meal_evaluation') { setSelMeals([]); setSelCategories([]); }
  };
  const removeNat    = key => setSelNats(p => p.filter(x => x !== key));
  const removeMeal   = key => setSelMeals(p => p.filter(x => x !== key));
  const removeCenter = id  => setSelCenters(p => p.filter(x => x !== id));

  const displayedHistory = showAll ? history : history.slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="متابعة الوجبات"
        Icon={Target}
        title="إسناد المهام"
        stats={[
          { value: selCenters.length, label: 'مركز محدَّد', tone: selCenters.length ? 'gold' : undefined },
          { value: selTasks.length, label: 'نوع مهمة' },
          { value: history.length, label: 'إسناد سابق' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Form */}
        <div className="lg:col-span-3 space-y-4">

          {/* 1. Task selection */}
          <Surface className="overflow-hidden">
            <Step n="١" title="ما المطلوب إنجازه"
              hint={selTasks.length ? `${selTasks.length} مهمة` : null} />
            <div className="p-4 space-y-3">
              {TASKS.map(t => {
                const Icon   = t.icon;
                const active = selTasks.includes(t.key);
                return (
                  <div key={t.key}>
                    <button
                      onClick={() => setSelTasks(p => toggle(p, t.key))}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-[11px] border transition-colors text-start"
                      style={active
                        ? { background: tint(t.color, 12), borderColor: tint(t.color, 28) }
                        : { background: '#fff', borderColor: 'rgb(var(--c-line))' }}>
                      <div className="w-9 h-9 rounded-[10px] border flex items-center justify-center shrink-0"
                        style={{ background: tint(t.color, 9), borderColor: tint(t.color, 22) }}>
                        <Icon size={17} style={{ color: t.color }} weight="regular" />
                      </div>
                      <span className="flex-1 text-[13px] font-bold" style={{ color: active ? t.color : 'rgb(var(--c-ink))' }}>
                        {t.label}
                      </span>
                      <div className={`w-5 h-5 rounded-[7px] border flex items-center justify-center transition-colors ${active ? 'border-transparent' : 'border-line'}`}
                        style={active ? { background: t.color } : {}}>
                        {active && <CheckCircle2 size={13} className="text-white" weight="bold" />}
                      </div>
                    </button>

                    {/* Meal sub-selection — required */}
                    {t.hasMeals && active && (
                      <div className="mt-2 ms-4 space-y-3">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[11px] font-bold text-muted">نوع الوجبة</span>
                            {mealMissing
                              ? <span className="text-[10px] font-bold px-1.5 py-[3px] rounded-md border flex items-center gap-0.5"
                                  style={{ background: tint('#DC2626', 9), borderColor: tint('#DC2626', 22), color: '#DC2626' }}>
                                  <AlertCircle size={10} weight="bold" /> مطلوب
                                </span>
                              : <span className="text-[10px] font-bold px-1.5 py-[3px] rounded-md border"
                                  style={{ background: tint('#16A34A', 9), borderColor: tint('#16A34A', 22), color: '#16A34A' }}>
                                  ✓ محدد
                                </span>
                            }
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {MEALS.map(m => {
                              const mActive = selMeals.includes(m.key);
                              return (
                                <button key={m.key}
                                  onClick={() => setSelMeals(p => toggle(p, m.key))}
                                  className="flex flex-col items-center gap-1.5 py-3 rounded-[11px] border transition-colors"
                                  style={mActive
                                    ? { background: tint(t.color, 12), borderColor: tint(t.color, 28), color: t.color }
                                    : { background: 'rgb(var(--c-bg))', borderColor: mealMissing ? tint('#DC2626', 28) : 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}>
                                  <m.icon size={20} weight="regular" style={{ color: mActive ? t.color : m.color }} />
                                  <span className="text-[12px] font-bold">{m.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Meal CATEGORY sub-selection — required */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[11px] font-bold text-muted">صنف الوجبة</span>
                            {categoryMissing
                              ? <span className="text-[10px] font-bold px-1.5 py-[3px] rounded-md border flex items-center gap-0.5"
                                  style={{ background: tint('#DC2626', 9), borderColor: tint('#DC2626', 22), color: '#DC2626' }}>
                                  <AlertCircle size={10} weight="bold" /> مطلوب
                                </span>
                              : <span className="text-[10px] font-bold px-1.5 py-[3px] rounded-md border"
                                  style={{ background: tint('#16A34A', 9), borderColor: tint('#16A34A', 22), color: '#16A34A' }}>
                                  ✓ {selCategories.length} محدد
                                </span>
                            }
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {MEAL_CATEGORIES.map(c => {
                              const cActive = selCategories.includes(c.key);
                              const CIcon   = c.icon;
                              return (
                                <button key={c.key}
                                  onClick={() => setSelCategories(p => toggle(p, c.key))}
                                  className="flex flex-col items-center gap-1.5 py-3 rounded-[11px] border transition-colors"
                                  style={cActive
                                    ? { background: tint(c.color, 12), borderColor: tint(c.color, 28), color: c.color }
                                    : { background: 'rgb(var(--c-bg))', borderColor: categoryMissing ? tint('#DC2626', 28) : 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}>
                                  <CIcon size={20} weight="regular" style={{ color: cActive ? c.color : c.color + 'AA' }} />
                                  <span className="text-[12px] font-bold">{c.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Surface>

          {/* 2. Target selection (Nationality or Center) */}
          <Surface className="overflow-hidden">
            {/* Header */}
            <Step n="٢" title="على من يقع" tone="#4E7CB0"
              hint={(selMode === 'nationality' ? selNats.length : selCenters.length) || null}
            />

            {/* Mode toggle */}
            <div className="px-4 pt-3.5 pb-0">
              <div className="flex gap-1.5 p-1 rounded-[11px] border border-line bg-[rgb(var(--c-bg))]">
                {[
                  { id: 'nationality', label: 'حسب الجنسية', icon: Earth },
                  { id: 'center',      label: 'حسب المركز',  icon: Building2 },
                ].map(m => {
                  const Icon = m.icon;
                  const active = selMode === m.id;
                  return (
                    <button key={m.id}
                      onClick={() => { setSelMode(m.id); setSelNats([]); setSelCenters([]); setCenterSearch(''); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[9px] border text-[12px] font-bold transition-colors"
                      style={active
                        ? { background: '#fff', color: 'rgb(var(--c-ink))', borderColor: 'rgb(var(--c-line))' }
                        : { color: 'rgb(var(--c-muted))', borderColor: 'transparent' }}>
                      <Icon size={13} weight="regular" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nationality grid */}
            {selMode === 'nationality' && (
              <div className="p-4 grid grid-cols-2 gap-2.5">
                {NATIONALITIES.map(n => {
                  const active = selNats.includes(n.key);
                  return (
                    <button key={n.key}
                      onClick={() => setSelNats(p => toggle(p, n.key))}
                      className="flex items-center gap-2.5 px-3.5 py-3 rounded-[11px] border transition-colors text-start"
                      style={active
                        ? { background: tint(n.color, 12), borderColor: tint(n.color, 28) }
                        : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                      <span className="text-lg leading-none">{n.flag}</span>
                      <div className="flex-1 min-w-0 text-start">
                        <p className="text-[12px] font-bold truncate" style={{ color: active ? n.color : 'rgb(var(--c-ink))' }}>{n.label}</p>
                        <p className="text-[10px] font-medium text-muted">{n.centers.length} مركز</p>
                      </div>
                      <div className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${active ? 'border-transparent' : 'border-line'}`}
                        style={active ? { background: n.color } : {}}>
                        {active && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Center list */}
            {selMode === 'center' && (
              <div className="p-4 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search size={13} weight="regular" className="absolute start-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={centerSearch}
                    onChange={e => setCenterSearch(e.target.value)}
                    placeholder="ابحث عن مركز..."
                    dir="rtl"
                    className="w-full ps-8 pe-3 py-2.5 rounded-[10px] border border-line bg-white text-[13px] text-ink placeholder-muted/50 focus:outline-none focus:border-primary transition-colors"
                  />
                  {centerSearch && (
                    <button onClick={() => setCenterSearch('')}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors">
                      <X size={12} weight="regular" />
                    </button>
                  )}
                </div>

                {/* Select / deselect all visible */}
                {filteredCenters.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted">{filteredCenters.length} مركز</span>
                    <button
                      onClick={() => {
                        const visibleIds = filteredCenters.map(c => c.id);
                        const allSelected = visibleIds.every(id => selCenters.includes(id));
                        if (allSelected) setSelCenters(p => p.filter(id => !visibleIds.includes(id)));
                        else setSelCenters(p => [...new Set([...p, ...visibleIds])]);
                      }}
                      className="text-[11px] font-bold text-primary hover:underline">
                      {filteredCenters.every(c => selCenters.includes(c.id)) ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </button>
                  </div>
                )}

                {/* Center rows */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {filteredCenters.length === 0
                    ? <p className="text-center text-[12px] font-medium text-muted py-4">لا توجد نتائج</p>
                    : filteredCenters.map(c => {
                        const active = selCenters.includes(c.id);
                        return (
                          <button key={c.id}
                            onClick={() => setSelCenters(p => toggle(p, c.id))}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[11px] border transition-colors text-start"
                            style={active
                              ? { background: tint('rgb(var(--c-primary))', 12), borderColor: tint('rgb(var(--c-primary))', 28) }
                              : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                            <div className="w-7 h-7 rounded-[9px] border flex items-center justify-center shrink-0"
                              style={{ background: tint('rgb(var(--c-primary))', 9), borderColor: tint('rgb(var(--c-primary))', 22) }}>
                              <Building2 size={13} weight="regular" style={{ color: active ? 'rgb(var(--c-primary))' : 'rgb(var(--c-muted))' }} />
                            </div>
                            <div className="flex-1 min-w-0 text-start">
                              <p className="text-[12px] font-bold" style={{ color: active ? 'rgb(var(--c-primary))' : 'rgb(var(--c-ink))' }}>{c.id}</p>
                              <p className="text-[10px] font-medium text-muted truncate">{c.caterer}</p>
                            </div>
                            <div className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${active ? 'border-transparent' : 'border-line'}`}
                              style={active ? { background: 'rgb(var(--c-primary))' } : {}}>
                              {active && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                            </div>
                          </button>
                        );
                      })
                  }
                </div>
              </div>
            )}
          </Surface>

          {/* 3. Date */}
          <Surface className="overflow-hidden">
            <Step n="٣" title="متى يُنفَّذ" tone="#16A34A" hint={schedDay ? schedLabel : null} />
            <div className="p-4 grid grid-cols-4 gap-2">
              {DHU_HIJJAH_DAYS.map(d => {
                const active = schedDay === d.value;
                return (
                  <button key={d.value}
                    onClick={() => setSchedDay(p => p === d.value ? '' : d.value)}
                    className="flex flex-col items-center gap-0.5 py-3 px-1 rounded-[11px] border transition-colors"
                    style={active
                      ? { background: tint('#16A34A', 12), borderColor: tint('#16A34A', 28) }
                      : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                    <span className="text-[15px] font-extrabold leading-none" style={{ color: active ? '#16A34A' : 'rgb(var(--c-ink))' }}>
                      {d.dayAr}
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: active ? '#16A34A' : 'rgb(var(--c-muted))' }}>
                      ذو الحجة
                    </span>
                    {active && <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: '#16A34A' }} />}
                  </button>
                );
              })}
            </div>
          </Surface>

          {/* Feedback */}
          {feedback && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-[11px] text-[13px] font-bold border"
              style={feedback.type === 'success'
                ? { background: tint('#16A34A', 12), borderColor: tint('#16A34A', 28), color: '#16A34A' }
                : { background: tint('#DC2626', 12), borderColor: tint('#DC2626', 28), color: '#DC2626' }}>
              {feedback.type === 'success'
                ? <CheckCircle2 size={16} weight="regular" />
                : <AlertCircle size={16} weight="regular" />}
              {feedback.msg}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleAssign}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-[12px] bg-primary border border-primary text-white font-bold text-[13.5px] transition-shadow disabled:opacity-60 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]">
            {submitting
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Rocket size={16} weight="regular" />}
            {submitting ? 'جارٍ الإسناد...' : 'إسناد المهام'}
          </button>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          <Surface className="overflow-hidden sticky top-4">
            <div className="px-4 sm:px-5 py-3 border-b"
              style={{ background: tint('rgb(var(--c-accent-600))', 12), borderColor: tint('rgb(var(--c-accent-600))', 28) }}>
              <p className="font-bold text-ink text-[13px]">ملخص الإسناد</p>
            </div>
            <div className="p-4 space-y-4">

              {/* Tasks */}
              <div>
                <p className="text-[11px] font-bold text-muted mb-2 flex items-center gap-1">
                  <Sparkles size={11} weight="regular" /> المهام المختارة
                </p>
                {selTasks.length === 0
                  ? <p className="text-[12px] font-medium text-muted">لم تُحدد بعد</p>
                  : <div className="space-y-2">
                      {selTasks.map(k => {
                        const t = TASKS.find(x => x.key === k);
                        return (
                          <div key={k}>
                            <div className="flex items-center gap-1.5">
                              <span className="flex-1 text-[12px] font-bold px-2.5 py-1 rounded-[8px] border"
                                style={{ background: tint(t.color, 12), borderColor: tint(t.color, 28), color: t.color }}>
                                {t.label}
                              </span>
                              <button onClick={() => removeTask(k)}
                                className="w-6 h-6 rounded-[8px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors shrink-0"
                                style={{ color: t.color }}>
                                <X size={12} weight="bold" />
                              </button>
                            </div>

                            {/* Meals under meal_evaluation */}
                            {k === 'meal_evaluation' && (
                              <div className="mt-1.5 ms-2 space-y-1.5">
                                {selMeals.length === 0
                                  ? <div className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: '#DC2626' }}>
                                      <AlertCircle size={10} weight="regular" />
                                      يرجى اختيار نوع الوجبة
                                    </div>
                                  : <div className="flex flex-wrap gap-1">
                                      {selMeals.map(m => (
                                        <div key={m} className="flex items-center gap-0.5">
                                          <span className="text-[10px] font-bold px-2 py-[3px] rounded-md border"
                                            style={{ background: tint(t.color, 9), borderColor: tint(t.color, 22), color: t.color }}>
                                            {MEAL_LABEL[m]}
                                          </span>
                                          <button onClick={() => removeMeal(m)}
                                            className="w-4 h-4 rounded-[5px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors"
                                            style={{ color: t.color }}>
                                            <X size={9} weight="bold" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                }
                                {selCategories.length === 0
                                  ? <div className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: '#DC2626' }}>
                                      <AlertCircle size={10} weight="regular" />
                                      يرجى اختيار صنف الوجبة
                                    </div>
                                  : <div className="flex flex-wrap gap-1">
                                      {selCategories.map(c => {
                                        const cat = MEAL_CATEGORIES.find(x => x.key === c);
                                        return (
                                          <div key={c} className="flex items-center gap-0.5">
                                            <span className="text-[10px] font-bold px-2 py-[3px] rounded-md border"
                                              style={{ background: tint(cat.color, 9), borderColor: tint(cat.color, 22), color: cat.color }}>
                                              {cat.label}
                                            </span>
                                            <button onClick={() => setSelCategories(p => p.filter(x => x !== c))}
                                              className="w-4 h-4 rounded-[5px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors"
                                              style={{ color: cat.color }}>
                                              <X size={9} weight="bold" />
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                }
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                }
              </div>

              {/* Target selection preview */}
              <div>
                {selMode === 'nationality' ? (
                  <>
                    <p className="text-[11px] font-bold text-muted mb-2 flex items-center gap-1">
                      <Earth size={11} weight="regular" /> الجنسيات
                    </p>
                    {selNats.length === 0
                      ? <p className="text-[12px] font-medium text-muted">لم تُحدد بعد</p>
                      : <div className="space-y-1.5">
                          {selNats.map(k => {
                            const n = NATIONALITIES.find(x => x.key === k);
                            return (
                              <div key={k} className="flex items-center gap-1.5">
                                <span className="flex-1 text-[11px] font-bold px-2 py-1 rounded-[8px] border"
                                  style={{ background: tint(n.color, 12), borderColor: tint(n.color, 28), color: n.color }}>
                                  {n.flag} {n.label}
                                  <span className="font-medium opacity-60 ms-1 text-[10px]">({n.centers.length} مركز)</span>
                                </span>
                                <button onClick={() => removeNat(k)}
                                  className="w-6 h-6 rounded-[8px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors shrink-0"
                                  style={{ color: n.color }}>
                                  <X size={12} weight="bold" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                    }
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold text-muted mb-2 flex items-center gap-1">
                      <Building2 size={11} weight="regular" /> المراكز المحددة
                      {selCenters.length > 0 && (
                        <span className="ms-1 text-[10px] font-bold px-1.5 py-[3px] rounded-md border"
                          style={{ background: tint('rgb(var(--c-primary))', 9), borderColor: tint('rgb(var(--c-primary))', 22), color: 'rgb(var(--c-primary))' }}>
                          {selCenters.length}
                        </span>
                      )}
                    </p>
                    {selCenters.length === 0
                      ? <p className="text-[12px] font-medium text-muted">لم تُحدد بعد</p>
                      : <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                          {selCenters.map(id => (
                            <div key={id} className="flex items-center gap-0.5">
                              <span className="text-[10px] font-bold px-2 py-[3px] rounded-md border"
                                style={{ background: tint('rgb(var(--c-primary))', 9), borderColor: tint('rgb(var(--c-primary))', 22), color: 'rgb(var(--c-primary))' }}>
                                {id}
                              </span>
                              <button onClick={() => removeCenter(id)}
                                className="w-4 h-4 rounded-[5px] flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors text-primary">
                                <X size={9} weight="bold" />
                              </button>
                            </div>
                          ))}
                        </div>
                    }
                  </>
                )}
              </div>

              {/* Target centers count (nationality mode only) */}
              {selMode === 'nationality' && (
                <div>
                  <p className="text-[11px] font-bold text-muted mb-2 flex items-center gap-1">
                    <Building2 size={11} weight="regular" />
                    المراكز المستهدفة
                    {targetCenters.length > 0 && (
                      <span className="ms-1 text-[10px] font-bold px-1.5 py-[3px] rounded-md border"
                        style={{ background: tint('rgb(var(--c-accent-600))', 9), borderColor: tint('rgb(var(--c-accent-600))', 22), color: 'rgb(var(--c-accent-600))' }}>
                        {targetCenters.length}
                      </span>
                    )}
                  </p>
                  {targetCenters.length === 0
                    ? <p className="text-[12px] font-medium text-muted">ستظهر بعد تحديد الجنسيات</p>
                    : <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                        {targetCenters.map(c => (
                          <span key={c} className="text-[10px] font-bold px-2 py-[3px] rounded-md border"
                            style={{ background: tint('rgb(var(--c-accent-600))', 9), borderColor: tint('rgb(var(--c-accent-600))', 22), color: 'rgb(var(--c-accent-600))' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                  }
                </div>
              )}

              {/* Date */}
              {schedDay && (
                <div className="rounded-[11px] border px-3 py-2.5 flex items-center justify-between"
                  style={{ background: tint('#16A34A', 12), borderColor: tint('#16A34A', 28) }}>
                  <div>
                    <p className="text-[10px] font-medium text-muted mb-0.5 flex items-center gap-1">
                      <CalendarCheck size={10} weight="regular" /> يوم التنفيذ
                    </p>
                    <p className="text-[12px] font-bold" style={{ color: '#16A34A' }}>{schedLabel}</p>
                  </div>
                  <button onClick={() => setSchedDay('')}
                    className="w-6 h-6 rounded-[8px] flex items-center justify-center hover:bg-white transition-colors"
                    style={{ color: '#16A34A' }}>
                    <X size={12} weight="bold" />
                  </button>
                </div>
              )}
            </div>
          </Surface>
        </div>
      </div>
      {history.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink text-[13.5px] flex items-center gap-2">
              <Clock size={14} style={{ color: 'rgb(var(--c-primary))' }} weight="regular" />
              سجل الإسناد السابق
              <span className="bg-[rgb(var(--c-bg))] text-primary border border-line text-[10px] font-bold px-2 py-[3px] rounded-md">
                {history.length}
              </span>
            </p>
            {history.length > 5 && (
              <button onClick={() => setShowAll(p => !p)}
                className="text-[12px] font-bold text-primary flex items-center gap-1">
                {showAll ? <><ChevronUp size={12} /> عرض أقل</> : <><ChevronDown size={12} /> عرض الكل</>}
              </button>
            )}
          </div>
          {displayedHistory.map(item => (
            <AssignmentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
