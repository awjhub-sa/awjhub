import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase.js';
import { rowFromDb } from '../lib/db.js';
import {
  ChefHat,
  Siren,
  Stack as Boxes,
  BellRinging as BellRing,
  UserCircle as CircleUser,
  CaretLeft as ChevronLeft,
  ClipboardText as ClipboardCheck,
  MapPin,
  Tent,
  Mountains as Mountain,
  Buildings as Building2,
  Clock,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { useAssignedTasks } from '../hooks/useAssignedTasks.js';
import TodayMenuCard from '../components/TodayMenuCard.jsx';
import { formatHijri } from '../lib/hijri.js';
import { BRAND } from '../config/brand.js';
import { Surface, IconTile, Pill, EmptyState } from '../components/ui/index.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const NAVY = 'rgb(var(--c-primary))';

const _cardSpring = { type: 'spring', stiffness: 380, damping: 18 };

const MenuCard = ({ icon: Icon, title, badge, onClick, variant = 'default' }) => {
  /* The lead action carries the brand tint; the rest are plain white rows, so
     one card leads instead of five competing. */
  const isAccent = variant === 'accent';
  return (
    <motion.button
      onClick={onClick}
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98, y: 0 }}
      transition={_cardSpring}
      className={`group group/menu w-full text-start rounded-[14px] border p-4 flex items-center gap-3.5
                  cursor-pointer shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                  hover:shadow-[0_8px_22px_-8px_rgb(var(--c-ink)/0.22)]
                  active:shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ${
        isAccent ? '' : 'bg-white border-line'
      }`}
      style={isAccent ? { background: tint(NAVY, 12), borderColor: tint(NAVY, 28) } : undefined}
    >
      <IconTile Icon={Icon} color={NAVY} size="lg" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[15px] font-bold ${isAccent ? 'text-primary' : 'text-ink'}`}>{title}</span>
          {badge != null && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={_cardSpring}
              className="badge-pulse-red inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5
                         bg-[#DC2626] text-white text-[10px] font-bold rounded-full ring-2 ring-white tabular-nums"
            >
              {badge}
            </motion.span>
          )}
        </div>
      </div>

      <ChevronLeft size={15} weight="bold" className="shrink-0 text-muted/40 group-hover/menu:text-muted transition-colors" />
    </motion.button>
  );
};

const ACTIVITY_CFG = {
  reports: { label: 'بلاغ طارئ', Icon: Siren, color: '#DC2626' },
  meal_evaluations: { label: 'تقييم وجبات', Icon: ChefHat, color: 'rgb(var(--c-primary))' },
  mina_readiness: { label: 'جاهزية منى', Icon: Tent, color: '#3D6795' },
  arafat_readiness: { label: 'جاهزية عرفة', Icon: Mountain, color: '#9E5741' },
  logistics_requests: { label: 'طلب إسناد', Icon: Boxes, color: '#4E7CB0' },
};

const STATUS_DATA = {
  pending:     { label: 'قيد الانتظار', color: '#B45309' },
  in_progress: { label: 'جارٍ التنفيذ', color: '#4E7CB0' },
  resolved:    { label: 'تم الحل',      color: '#15803D' },
  approved:    { label: 'موافق عليه',   color: '#4E7CB0' },
  delivered:   { label: 'تم التسليم',   color: '#15803D' },
  rejected:    { label: 'مرفوض',        color: '#DC2626' },
};

const SEVERITY_LABEL = { high: 'عالي', medium: 'متوسط', low: 'منخفض' };
const SEVERITY_COLOR = { high: '#DC2626', medium: '#D97706', low: '#4E7CB0' };

const toMs = doc => doc.timestamp?.toMillis?.() ?? doc.createdAt?.toMillis?.() ?? 0;
const fmtTime = ms => ms ? new Date(ms).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const TABS = [
  { key: 'actions',  label: 'الإجراءات', Icon: ClipboardCheck },
  { key: 'menu',     label: 'المنيو',     Icon: ChefHat },
  { key: 'activity', label: 'النشاط',     Icon: BellRing },
];

export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [view, setView] = useState('actions');
  const [clock, setClock] = useState({ hijri: '', time: '' });
  const [activities, setActivities] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({
        hijri: formatHijri(now),
        time:  now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true }),
      });
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!profile?.uid || !profile?.center) return;
    const todayMs = new Date().setHours(0, 0, 0, 0);
    let mounted = true;
    const loadFor = async (table) => {
      const { data } = await supabase.from(table).select('*').eq('center', profile.center);
      if (!mounted) return;
      const docs = (data || [])
        .map(d => ({ ...rowFromDb(d), _col: table }))
        .filter(d => toMs(d) >= todayMs);
      setActivities(prev => {
        const others = prev.filter(a => a._col !== table);
        return [...others, ...docs].sort((a, b) => toMs(b) - toMs(a));
      });
    };
    const channels = Object.keys(ACTIVITY_CFG).map(col => {
      loadFor(col);
      return supabase.channel(`home-${col}-${profile.center}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: col }, () => loadFor(col))
        .subscribe();
    });

    return () => { mounted = false; channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [profile?.uid, profile?.center]);

  const { tasks, completions } = useAssignedTasks(profile);

  const pendingMealBadge = (() => {
    const mealTasks = tasks.filter(t => t.taskTypes?.includes('meal_evaluation'));
    let count = 0;
    mealTasks.forEach(task => (task.mealTypes || []).forEach(mt => {
      if (!completions.some(c => c.taskId === task.id && c.mealType === mt)) count++;
    }));
    return count || null;
  })();
  const pendingMinaBadge = tasks.filter(t => t.taskTypes?.includes('mina_readiness') &&
    !completions.some(c => c.taskId === t.id && c.taskType === 'mina_readiness')).length || null;
  const pendingArafatBadge = tasks.filter(t => t.taskTypes?.includes('arafat_readiness') &&
    !completions.some(c => c.taskId === t.id && c.taskType === 'arafat_readiness')).length || null;
  const totalPending = (pendingMealBadge || 0) + (pendingMinaBadge || 0) + (pendingArafatBadge || 0) || null;

  const name = profile?.nameAr || profile?.name || 'المراقب الميداني';
  const center = profile?.center || '—';
  const caterer = profile?.caterer || getCaterer(profile?.center) || '—';
  const centerNum = center !== '—' ? center.replace('مركز ', '') : '—';
  const displayed = showAll ? activities : activities.slice(0, 8);

  return (
    <div dir="rtl" className="min-h-screen bg-canvas font-arabic pb-28">

      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 md:px-8 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={BRAND.logo.icon} alt="" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-ink leading-tight truncate">{BRAND.companyName}</p>
              <p className="text-[10px] text-primary font-bold leading-tight truncate">{BRAND.tagline}</p>
            </div>
          </div>

          <motion.button
            onClick={() => navigate('/profile')}
            whileTap={{ scale: 0.94 }}
            className="w-10 h-10 rounded-[10px] bg-white border border-line flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors shrink-0"
          >
            <CircleUser size={18} weight="duotone" className="text-primary" />
          </motion.button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-5 space-y-5">

        {/* Compact welcome card */}
        <div className="rounded-[18px] overflow-hidden border border-line animate-fade-slide-up">
          <div className="p-5 sm:p-6 relative" style={{ background: 'rgb(var(--c-ink))' }}>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.6), transparent)' }} />
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-white/50 mb-1">مرحباً بك،</p>
                <h2 className="text-white font-extrabold text-[19px] sm:text-[21px] truncate leading-tight">{name}</h2>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin size={12} weight="bold" className="text-accent" />
                  <span className="text-accent text-[11.5px] font-bold">مراقب ميداني</span>
                </div>
              </div>
              <div className="rounded-[10px] px-4 py-2.5 text-center border border-white/10 shrink-0"
                style={{ background: 'rgb(255 255 255 / 0.06)' }}>
                <p className="text-[10px] font-medium text-white/50 mb-1">مركز</p>
                <p className="text-accent font-extrabold text-[19px] leading-none tabular-nums">{centerNum}</p>
              </div>
            </div>
            <div className="rounded-[10px] px-3 py-2.5 border border-white/10 mt-3 flex items-center gap-2"
              style={{ background: 'rgb(255 255 255 / 0.06)' }}>
              <Building2 size={14} weight="duotone" className="text-accent shrink-0" />
              <p className="text-white text-[12px] font-medium leading-snug truncate">{caterer}</p>
            </div>
          </div>
          <div className="bg-white border-t border-line px-5 py-2.5 flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-ink">{clock.hijri}</span>
            <span className="text-[11.5px] font-bold text-muted tabular-nums">{clock.time}</span>
          </div>
        </div>

        {/* Section content based on selected tab */}
        {view === 'actions' && (
          <div className="space-y-4 animate-fade-slide-up">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-muted tracking-[0.18em]">القائمة الرئيسية</span>
              <span aria-hidden className="h-px flex-1 bg-line" />
            </div>
            <motion.div
              className="grid grid-cols-1 gap-2.5"
              initial="hidden" animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            >
              {[
                { icon: ChefHat,       title: 'تقييم جودة الوجبات', path: '/mealcheck',        variant: 'accent',  badge: pendingMealBadge },
                { icon: Tent,          title: 'جاهزية مشعر منى',    path: '/mina-readiness',   variant: 'default', badge: pendingMinaBadge },
                { icon: Mountain,      title: 'جاهزية مشعر عرفة',   path: '/arafat-readiness', variant: 'default', badge: pendingArafatBadge },
                { icon: Siren,         title: 'بلاغ طارئ',          path: '/report',           variant: 'default', badge: null },
                { icon: Boxes,         title: 'طلب إسناد لوجستي',   path: '/logistics',        variant: 'default', badge: null },
              ].map((item) => (
                <motion.div key={item.path}
                  variants={{
                    hidden:  { opacity: 0, x: 20 },
                    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 340, damping: 22 } },
                  }}
                >
                  <MenuCard icon={item.icon} title={item.title} onClick={() => navigate(item.path)}
                    variant={item.variant} badge={item.badge} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {view === 'menu' && profile?.center && (
          <div className="animate-fade-slide-up">
            <TodayMenuCard centerId={profile.center} />
          </div>
        )}

        {view === 'activity' && (
          <div className="space-y-3 animate-fade-slide-up">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <ClipboardCheck size={17} weight="duotone" className="text-primary" />
                <span className="text-[15px] font-bold text-ink">نشاط اليوم</span>
                {activities.length > 0 && (
                  <Pill color={NAVY} className="tabular-nums">{activities.length}</Pill>
                )}
              </div>
            </div>

            {activities.length === 0 ? (
              <Surface>
                <EmptyState Icon={Clock} title="لا يوجد نشاط مسجل لليوم بعد" />
              </Surface>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {displayed.map(item => {
                  const cfg = ACTIVITY_CFG[item._col];
                  const { Icon } = cfg;
                  const ms = toMs(item);
                  const statusInfo = STATUS_DATA[item.status] || { label: item.status, color: 'rgb(var(--c-muted))' };
                  const showStatus = item.status && (item._col === 'reports' || item._col === 'logistics_requests');
                  const isSubmission = ['meal_evaluations', 'mina_readiness', 'arafat_readiness'].includes(item._col);
                  let title = item.reportType || item.type || cfg.label;
                  if (isSubmission) title = `تم رفع ${cfg.label}`;
                  const MEAL_LBL = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
                  const sub = item._col === 'reports' && item.severity
                    ? `خطورة: ${SEVERITY_LABEL[item.severity]}`
                    : (item.mealType ? (MEAL_LBL[item.mealType] || item.mealType) : '');

                  return (
                    <div key={item.id}
                      className="relative bg-white border border-line rounded-[14px] overflow-hidden
                                 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
                      {/* The rail carries severity when there is one, otherwise the kind of entry. */}
                      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]"
                        style={{ background: item.severity ? SEVERITY_COLOR[item.severity] : cfg.color }} />
                      <div className="ps-5 pe-4 py-3.5 flex items-center gap-3">
                        <IconTile Icon={Icon} color={cfg.color} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13.5px] font-bold text-ink truncate">{title}</p>
                            <span className="text-[10.5px] font-semibold text-muted shrink-0 tabular-nums">{fmtTime(ms)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            {(item.reportNumber || item.requestNumber) && (
                              <Pill color={cfg.color} className="tabular-nums">
                                {item.reportNumber || item.requestNumber}
                              </Pill>
                            )}
                            {sub && <span className="text-[11px] font-medium text-muted">{sub}</span>}
                            {showStatus && <Pill color={statusInfo.color}>{statusInfo.label}</Pill>}
                          </div>
                        </div>
                      </div>
                      {item.adminNotes && (item._col === 'reports' || item._col === 'logistics_requests') && (
                        <div className="border-t border-line pt-2.5 pb-3 pe-4 ps-5"
                          style={{ background: tint(NAVY, 7) }}>
                          <p className="text-[10px] font-bold text-primary mb-1 tracking-[0.12em]">ملاحظات غرفة العمليات</p>
                          <p className="text-[12px] text-ink font-medium leading-relaxed whitespace-pre-wrap">{item.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {activities.length > 8 && (
                  <button onClick={() => setShowAll(p => !p)}
                    className="w-full min-h-[44px] mt-1 rounded-[12px] bg-white border border-dashed border-line
                               text-primary font-bold text-[13px] hover:bg-[rgb(var(--c-bg))] transition-colors">
                    {showAll ? 'عرض أقل' : `عرض الكل (${activities.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          {TABS.map(tab => {
            const active = view === tab.key;
            const TIcon = tab.Icon;
            const showBadge = tab.key === 'actions' && totalPending;
            return (
              <button key={tab.key}
                onClick={() => setView(tab.key)}
                className={`relative flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                  active ? 'text-primary' : 'text-muted hover:text-primary'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-[3px] rounded-b-full bg-primary" />
                )}
                <div className="relative">
                  <TIcon size={21} weight={active ? 'fill' : 'regular'} />
                  {showBadge && (
                    <span className="absolute -top-1 -end-2 min-w-[18px] h-[18px] px-1 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white tabular-nums">
                      {totalPending}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] font-bold ${active ? 'text-primary' : ''}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-slide-up { animation: fadeSlideUp 0.35s ease-out forwards; }
      `}</style>
    </div>
  );
}
