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
import { CENTERS } from '../../config/centers.js';
import { NATIONALITIES, NAT_LABEL as NAT_LABEL_SHARED } from '../../config/nationalities.js';
import { extractCenterNum, extractDay } from '../../hooks/useAssignedTasks.js';

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
    <div className="bg-white rounded-2xl border border-line shadow-[0_2px_10px_rgb(var(--c-ink)/0.06)] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400) / 0.16), rgb(var(--c-primary) / 0.08))' }}>
          <Layers size={18} style={{ color: 'rgb(var(--c-primary))' }} weight="light" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink truncate">{taskLabels}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {natLabels
              ? <span className="flex items-center gap-1 text-[11px] text-muted">
                  <Earth size={10} weight="light" /> {natLabels}
                </span>
              : <span className="flex items-center gap-1 text-[11px] text-muted">
                  <Building2 size={10} weight="light" /> مراكز محددة
                </span>
            }
            <span className="text-muted">·</span>
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Building2 size={10} weight="light" /> {centerCount} مركز
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
            item.status === 'completed'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {item.status === 'completed' ? 'منجز' : 'قيد الانتظار'}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-muted">
            <Clock size={9} weight="light" />
            {fullDate(item.createdAt)}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(p => !p)}
              className="flex items-center gap-0.5 text-[10px] font-bold text-primary">
              {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {open ? 'إخفاء' : 'تفاصيل'}
            </button>
            <span className="text-line">|</span>
            <button onClick={() => setConfirm(true)}
              className="flex items-center gap-0.5 text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors">
              <Trash2 size={11} weight="regular" />
              حذف
            </button>
          </div>
        </div>
      </div>

      {/* Confirm delete bar */}
      {confirm && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-red-600">
            سيختفي الإسناد فوراً من عند المراقبين. تأكيد الحذف؟
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setConfirm(false)}
              className="text-[11px] font-bold text-muted hover:text-ink px-2.5 py-1 rounded-lg border border-line bg-white transition-colors">
              إلغاء
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="text-[11px] font-bold text-white px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors flex items-center gap-1.5">
              {deleting
                ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Trash2 size={11} weight="regular" />}
              {deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="border-t border-line bg-background px-5 py-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs">
            <CalendarCheck size={13} style={{ color: 'rgb(var(--c-primary))' }} weight="light" />
            <span className="text-muted">تاريخ التنفيذ:</span>
            <span className="font-bold text-ink">{dateDisplay}</span>
          </div>

          {item.mealTypes?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <ChefHat size={13} style={{ color: 'rgb(var(--c-primary))' }} weight="light" />
              <span className="text-muted">وجبات:</span>
              {item.mealTypes.map(m => (
                <span key={m} className="bg-background border border-line text-primary font-bold px-2 py-0.5 rounded-lg text-[11px]">
                  {MEAL_LABEL[m] || m}
                </span>
              ))}
            </div>
          )}

          {item.mealCategories?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Layers size={13} style={{ color: 'rgb(var(--c-primary))' }} weight="light" />
              <span className="text-muted">الأصناف:</span>
              {item.mealCategories.map(c => (
                <span key={c} className="bg-background border border-line text-primary font-bold px-2 py-0.5 rounded-lg text-[11px]">
                  {MEAL_CATEGORY_LABEL[c] || c}
                </span>
              ))}
            </div>
          )}

          <div>
            <p className="text-[11px] text-muted mb-1.5 flex items-center gap-1">
              <Building2 size={11} weight="light" />
              المراكز المستهدفة ({centerCount})
            </p>
            <div className="flex flex-wrap gap-1">
              {item.targetCenters?.map(c => {
                const label = typeof c === 'string' ? c : `مركز ${c}`;
                return (
                  <span key={label} className="bg-white border border-line text-ink text-[10px] font-bold px-2 py-0.5 rounded-lg">
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

      {}
      <PageHeader
        kicker="متابعة الوجبات"
        Icon={Target}
        title="إسناد المهام"
        subtitle="توزيع المهام الميدانية على المراقبين حسب الجنسية والمركز"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Form */}
        <div className="lg:col-span-3 space-y-4">

          {/* 1. Task selection */}
          <div className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)), #fff 60%)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                <Sparkles size={15} className="text-white" weight="regular" />
              </div>
              <p className="font-bold text-ink text-sm">اختيار المهام</p>
            </div>
            <div className="p-4 space-y-3">
              {TASKS.map(t => {
                const Icon   = t.icon;
                const active = selTasks.includes(t.key);
                return (
                  <div key={t.key}>
                    <button
                      onClick={() => setSelTasks(p => toggle(p, t.key))}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-right"
                      style={active
                        ? { background: `${t.color}0F`, borderColor: `${t.color}50`, boxShadow: `0 2px 12px ${t.color}18` }
                        : { background: '#fff', borderColor: 'rgb(var(--c-line))' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: active ? `${t.color}22` : 'rgb(var(--c-primary-50))' }}>
                        <Icon size={17} style={{ color: t.color }} weight="regular" />
                      </div>
                      <span className="flex-1 text-sm font-bold" style={{ color: active ? t.color : 'rgb(var(--c-ink-800))' }}>
                        {t.label}
                      </span>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${active ? 'border-transparent' : 'border-line'}`}
                        style={active ? { background: t.color } : {}}>
                        {active && <CheckCircle2 size={13} className="text-white" weight="bold" />}
                      </div>
                    </button>

                    {/* Meal sub-selection — required */}
                    {t.hasMeals && active && (
                      <div className="mt-2 mr-4 space-y-3">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[11px] font-semibold text-muted">نوع الوجبة</span>
                            {mealMissing
                              ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center gap-0.5">
                                  <AlertCircle size={8} weight="bold" /> مطلوب
                                </span>
                              : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
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
                                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all"
                                  style={mActive
                                    ? { background: `${t.color}12`, borderColor: t.color, color: t.color }
                                    : { background: 'rgb(var(--c-bg))', borderColor: mealMissing ? '#FCA5A5' : 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}>
                                  <m.icon size={20} weight="regular" style={{ color: mActive ? t.color : m.color }} />
                                  <span className="text-xs font-bold">{m.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Meal CATEGORY sub-selection — required */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[11px] font-semibold text-muted">صنف الوجبة</span>
                            {categoryMissing
                              ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center gap-0.5">
                                  <AlertCircle size={8} weight="bold" /> مطلوب
                                </span>
                              : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
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
                                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all"
                                  style={cActive
                                    ? { background: `${c.color}12`, borderColor: c.color, color: c.color }
                                    : { background: 'rgb(var(--c-bg))', borderColor: categoryMissing ? '#FCA5A5' : 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}>
                                  <CIcon size={20} weight="regular" style={{ color: cActive ? c.color : c.color + 'AA' }} />
                                  <span className="text-xs font-bold">{c.label}</span>
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
          </div>

          {/* 2. Target selection (Nationality or Center) */}
          <div className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line"
              style={{ background: 'linear-gradient(135deg, #EFF6FF, #fff 60%)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #93C5FD, #4E7CB0)' }}>
                {selMode === 'nationality' ? <Earth size={15} className="text-white" weight="regular" /> : <Building2 size={15} className="text-white" weight="regular" />}
              </div>
              <p className="font-bold text-ink text-sm">تحديد الجهة المستهدفة</p>
              {(selMode === 'nationality' ? selNats.length : selCenters.length) > 0 && (
                <span className="mr-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                  {selMode === 'nationality' ? selNats.length : selCenters.length} محدد
                </span>
              )}
            </div>

            {/* Mode toggle */}
            <div className="px-4 pt-3.5 pb-0">
              <div className="flex gap-1.5 p-1 rounded-xl bg-[rgb(var(--c-primary-50))]">
                {[
                  { id: 'nationality', label: 'حسب الجنسية', icon: Earth },
                  { id: 'center',      label: 'حسب المركز',  icon: Building2 },
                ].map(m => {
                  const Icon = m.icon;
                  const active = selMode === m.id;
                  return (
                    <button key={m.id}
                      onClick={() => { setSelMode(m.id); setSelNats([]); setSelCenters([]); setCenterSearch(''); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
                      style={active
                        ? { background: 'white', color: 'rgb(var(--c-ink))', boxShadow: '0 1px 6px rgb(var(--c-ink) / 0.12)' }
                        : { color: 'rgb(var(--c-muted))' }}>
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
                      className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-all text-right"
                      style={active
                        ? { background: `${n.color}0D`, borderColor: `${n.color}45`, boxShadow: `0 2px 8px ${n.color}14` }
                        : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                      <span className="text-lg leading-none">{n.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: active ? n.color : 'rgb(var(--c-ink))' }}>{n.label}</p>
                        <p className="text-[10px] text-muted">{n.centers.length} مركز</p>
                      </div>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${active ? 'border-transparent' : 'border-line'}`}
                        style={active ? { background: n.color } : {}}>
                        {active && <span className="text-white text-[8px] font-black leading-none">✓</span>}
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
                  <Search size={13} weight="regular" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={centerSearch}
                    onChange={e => setCenterSearch(e.target.value)}
                    placeholder="ابحث عن مركز..."
                    dir="rtl"
                    className="w-full pr-8 pl-3 py-2 rounded-xl border border-line bg-bg text-sm text-ink placeholder-muted focus:outline-none focus:border-primary transition-colors"
                  />
                  {centerSearch && (
                    <button onClick={() => setCenterSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-muted">
                      <X size={12} weight="regular" />
                    </button>
                  )}
                </div>

                {/* Select / deselect all visible */}
                {filteredCenters.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted">{filteredCenters.length} مركز</span>
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
                    ? <p className="text-center text-[12px] text-muted py-4">لا توجد نتائج</p>
                    : filteredCenters.map(c => {
                        const active = selCenters.includes(c.id);
                        return (
                          <button key={c.id}
                            onClick={() => setSelCenters(p => toggle(p, c.id))}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-right"
                            style={active
                              ? { background: 'rgb(var(--c-primary) / 0.06)', borderColor: 'rgb(var(--c-primary) / 0.31)', boxShadow: '0 1px 6px rgb(var(--c-primary) / 0.12)' }
                              : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: active ? 'rgb(var(--c-primary) / 0.13)' : 'rgb(var(--c-primary-50))' }}>
                              <Building2 size={13} weight="regular" style={{ color: active ? 'rgb(var(--c-primary))' : 'rgb(var(--c-muted))' }} />
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xs font-bold" style={{ color: active ? 'rgb(var(--c-primary))' : 'rgb(var(--c-ink))' }}>{c.id}</p>
                              <p className="text-[10px] text-muted truncate">{c.caterer}</p>
                            </div>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${active ? 'border-transparent' : 'border-line'}`}
                              style={active ? { background: 'rgb(var(--c-primary))' } : {}}>
                              {active && <span className="text-white text-[8px] font-black leading-none">✓</span>}
                            </div>
                          </button>
                        );
                      })
                  }
                </div>
              </div>
            )}
          </div>

          {/* 3. Date */}
          <div className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line"
              style={{ background: 'linear-gradient(135deg, #F0FDF4, #fff 60%)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #86EFAC, #16A34A)' }}>
                <CalendarCheck size={15} className="text-white" weight="regular" />
              </div>
              <p className="font-bold text-ink text-sm">يوم التنفيذ</p>
              {schedDay && (
                <span className="mr-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {schedLabel}
                </span>
              )}
            </div>
            <div className="p-4 grid grid-cols-4 gap-2">
              {DHU_HIJJAH_DAYS.map(d => {
                const active = schedDay === d.value;
                return (
                  <button key={d.value}
                    onClick={() => setSchedDay(p => p === d.value ? '' : d.value)}
                    className="flex flex-col items-center gap-0.5 py-3 px-1 rounded-xl border transition-all"
                    style={active
                      ? { background: '#2F855A14', borderColor: '#2F855A60', boxShadow: '0 2px 8px #2F855A18' }
                      : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                    <span className="text-sm font-black leading-none" style={{ color: active ? '#16A34A' : 'rgb(var(--c-ink))' }}>
                      {d.dayAr}
                    </span>
                    <span className="text-[9px] font-semibold" style={{ color: active ? '#2F855A99' : 'rgb(var(--c-muted))' }}>
                      ذو الحجة
                    </span>
                    {active && <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: '#16A34A' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-600 border-red-200'
            }`}>
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
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-60 shadow-[0_6px_24px_rgb(var(--c-primary)/0.35)] hover:shadow-[0_8px_32px_rgb(var(--c-primary)/0.45)] hover:opacity-95 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)) 0%, rgb(var(--c-primary)) 50%, rgb(var(--c-primary-700)) 100%)' }}>
            {submitting
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Rocket size={16} weight="regular" />}
            {submitting ? 'جارٍ الإسناد...' : 'إسناد المهام'}
          </button>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)] overflow-hidden sticky top-4">
            <div className="px-5 py-3.5 border-b border-line"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)), #fff 60%)' }}>
              <p className="font-bold text-ink text-sm">ملخص الإسناد</p>
              <p className="text-[10px] text-muted mt-0.5">اضغط × لحذف أي خيار</p>
            </div>
            <div className="p-4 space-y-4">

              {/* Tasks */}
              <div>
                <p className="text-[11px] font-semibold text-muted mb-2 flex items-center gap-1">
                  <Sparkles size={11} weight="regular" /> المهام المختارة
                </p>
                {selTasks.length === 0
                  ? <p className="text-[12px] text-muted italic">لم تُحدد بعد</p>
                  : <div className="space-y-2">
                      {selTasks.map(k => {
                        const t = TASKS.find(x => x.key === k);
                        return (
                          <div key={k}>
                            <div className="flex items-center gap-1.5">
                              <span className="flex-1 text-xs font-bold px-2.5 py-1 rounded-lg border"
                                style={{ background: `${t.color}10`, borderColor: `${t.color}35`, color: t.color }}>
                                {t.label}
                              </span>
                              <button onClick={() => removeTask(k)}
                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors flex-shrink-0"
                                style={{ color: t.color }}>
                                <X size={12} weight="bold" />
                              </button>
                            </div>

                            {/* Meals under meal_evaluation */}
                            {k === 'meal_evaluation' && (
                              <div className="mt-1.5 mr-2 space-y-1.5">
                                {selMeals.length === 0
                                  ? <div className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                                      <AlertCircle size={10} weight="regular" />
                                      يرجى اختيار نوع الوجبة
                                    </div>
                                  : <div className="flex flex-wrap gap-1">
                                      {selMeals.map(m => (
                                        <div key={m} className="flex items-center gap-0.5">
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border"
                                            style={{ background: `${t.color}0A`, borderColor: `${t.color}30`, color: t.color }}>
                                            {MEAL_LABEL[m]}
                                          </span>
                                          <button onClick={() => removeMeal(m)}
                                            className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
                                            style={{ color: t.color }}>
                                            <X size={9} weight="bold" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                }
                                {selCategories.length === 0
                                  ? <div className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                                      <AlertCircle size={10} weight="regular" />
                                      يرجى اختيار صنف الوجبة
                                    </div>
                                  : <div className="flex flex-wrap gap-1">
                                      {selCategories.map(c => {
                                        const cat = MEAL_CATEGORIES.find(x => x.key === c);
                                        return (
                                          <div key={c} className="flex items-center gap-0.5">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border"
                                              style={{ background: `${cat.color}0F`, borderColor: `${cat.color}40`, color: cat.color }}>
                                              {cat.label}
                                            </span>
                                            <button onClick={() => setSelCategories(p => p.filter(x => x !== c))}
                                              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
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
                    <p className="text-[11px] font-semibold text-muted mb-2 flex items-center gap-1">
                      <Earth size={11} weight="regular" /> الجنسيات
                    </p>
                    {selNats.length === 0
                      ? <p className="text-[12px] text-muted italic">لم تُحدد بعد</p>
                      : <div className="space-y-1.5">
                          {selNats.map(k => {
                            const n = NATIONALITIES.find(x => x.key === k);
                            return (
                              <div key={k} className="flex items-center gap-1.5">
                                <span className="flex-1 text-[11px] font-bold px-2 py-1 rounded-lg border"
                                  style={{ background: `${n.color}10`, borderColor: `${n.color}35`, color: n.color }}>
                                  {n.flag} {n.label}
                                  <span className="font-normal opacity-60 mr-1 text-[10px]">({n.centers.length} مركز)</span>
                                </span>
                                <button onClick={() => removeNat(k)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors flex-shrink-0"
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
                    <p className="text-[11px] font-semibold text-muted mb-2 flex items-center gap-1">
                      <Building2 size={11} weight="regular" /> المراكز المحددة
                      {selCenters.length > 0 && (
                        <span className="mr-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgb(var(--c-primary) / 0.09)', color: 'rgb(var(--c-primary))', border: '1px solid rgb(var(--c-primary) / 0.19)' }}>
                          {selCenters.length}
                        </span>
                      )}
                    </p>
                    {selCenters.length === 0
                      ? <p className="text-[12px] text-muted italic">لم تُحدد بعد</p>
                      : <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                          {selCenters.map(id => (
                            <div key={id} className="flex items-center gap-0.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                style={{ background: 'rgb(var(--c-primary) / 0.06)', border: '1px solid rgb(var(--c-primary) / 0.21)', color: 'rgb(var(--c-primary))' }}>
                                {id}
                              </span>
                              <button onClick={() => removeCenter(id)}
                                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors text-primary">
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
                  <p className="text-[11px] font-semibold text-muted mb-2 flex items-center gap-1">
                    <Building2 size={11} weight="regular" />
                    المراكز المستهدفة
                    {targetCenters.length > 0 && (
                      <span className="mr-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#9E574118', color: '#9E5741', border: '1px solid #9E574130' }}>
                        {targetCenters.length}
                      </span>
                    )}
                  </p>
                  {targetCenters.length === 0
                    ? <p className="text-[12px] text-muted italic">ستظهر بعد تحديد الجنسيات</p>
                    : <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                        {targetCenters.map(c => (
                          <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                            style={{ background: '#9E57410D', border: '1px solid #9E574125', color: '#9E5741' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                  }
                </div>
              )}

              {/* Date */}
              {schedDay && (
                <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted mb-0.5 flex items-center gap-1">
                      <CalendarCheck size={10} weight="regular" /> يوم التنفيذ
                    </p>
                    <p className="text-xs font-bold text-[#16A34A]">{schedLabel}</p>
                  </div>
                  <button onClick={() => setSchedDay('')}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors text-[#16A34A]">
                    <X size={12} weight="bold" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {}
      {history.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink text-sm flex items-center gap-2">
              <Clock size={14} style={{ color: 'rgb(var(--c-primary))' }} weight="regular" />
              سجل الإسناد السابق
              <span className="bg-background text-primary border border-line text-[10px] font-bold px-2 py-0.5 rounded-full">
                {history.length}
              </span>
            </p>
            {history.length > 5 && (
              <button onClick={() => setShowAll(p => !p)}
                className="text-xs font-bold text-primary flex items-center gap-1">
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
