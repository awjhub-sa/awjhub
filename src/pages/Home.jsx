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
  Sparkle as Sparkles,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { useAssignedTasks } from '../hooks/useAssignedTasks.js';
import TodayMenuCard from '../components/TodayMenuCard.jsx';
import { formatHijri } from '../lib/hijri.js';
import { BRAND } from '../config/brand.js';

const _cardSpring = { type: 'spring', stiffness: 380, damping: 18 };

const MenuCard = ({ icon: Icon, title, badge, onClick, variant = 'default' }) => {
  const isAccent = variant === 'accent';
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={_cardSpring}
      className={`group/menu relative w-full text-right rounded-2xl p-5 flex items-center gap-4 border-2 overflow-hidden transition-all duration-300 ${
        isAccent
          ? 'border-transparent text-white'
          : 'bg-gradient-to-br from-white via-white to-background/40 border-line text-ink hover:border-primary/40 hover:shadow-[0_8px_28px_rgb(var(--c-primary)/0.18)]'
      }`}
      style={isAccent
        ? { background: 'linear-gradient(135deg, rgb(var(--c-ink-800)) 0%, rgb(var(--c-ink)) 100%)', boxShadow: '0 6px 24px rgb(var(--c-ink) / 0.28)' }
        : { boxShadow: '0 2px 10px rgb(var(--c-ink) / 0.06)' }}
    >
      {isAccent && (
        <div className="absolute top-0 right-0 left-0 h-0.5 opacity-70"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-primary-400)), transparent)' }} />
      )}

      <div className="relative flex-shrink-0">
        <div className={`absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover/menu:opacity-60 transition-opacity duration-500 ${isAccent ? 'bg-primary-400' : 'bg-primary'}`} />
        <motion.div
          whileHover={{ scale: 1.15, rotate: 5 }}
          whileTap={{ scale: 0.88 }}
          transition={_cardSpring}
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-md border-2"
          style={isAccent
            ? { background: 'linear-gradient(135deg, rgb(var(--c-primary-400) / 0.18), rgb(var(--c-primary) / 0.10))', borderColor: 'rgb(var(--c-primary-400) / 0.35)' }
            : { background: 'linear-gradient(135deg, rgb(var(--c-bg)), rgb(var(--c-primary-100)))', borderColor: 'rgb(var(--c-primary) / 0.25)' }}
        >
          <Icon size={26} weight="regular" className="text-primary" />
          <Sparkles size={9} className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow" />
        </motion.div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-base">{title}</span>
          {badge != null && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={_cardSpring}
              className="badge-pulse-red inline-flex items-center min-w-[22px] h-[22px] bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-extrabold rounded-full px-1.5 ring-2 ring-white shadow-md tabular-nums"
            >
              {badge}
            </motion.span>
          )}
        </div>
      </div>

      <motion.div
        whileHover={{ x: -4 }}
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
          isAccent ? 'bg-white/10 group-hover/menu:bg-white/20' : 'bg-background group-hover/menu:bg-primary/15'
        }`}
      >
        <ChevronLeft size={16} weight="bold" className={isAccent ? 'text-white' : 'text-primary'} />
      </motion.div>
    </motion.button>
  );
};

const ACTIVITY_CFG = {
  reports: { label: 'بلاغ طارئ', Icon: Siren, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  meal_evaluations: { label: 'تقييم وجبات', Icon: ChefHat, color: 'rgb(var(--c-primary))', bg: 'rgb(var(--c-bg))', border: 'rgb(var(--c-line))' },
  mina_readiness: { label: 'جاهزية منى', Icon: Tent, color: '#0891B2', bg: '#F0F9FF', border: '#BAE6FD' },
  arafat_readiness: { label: 'جاهزية عرفة', Icon: Mountain, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  logistics_requests: { label: 'طلب إسناد', Icon: Boxes, color: '#06B6D4', bg: '#EFF6FF', border: '#BFDBFE' },
};

const STATUS_DATA = {
  pending:     { label: 'قيد الانتظار', bg: '#FEF9C3', text: '#854D0E' },
  in_progress: { label: 'جارٍ التنفيذ', bg: '#DBEAFE', text: '#155E75' },
  resolved:    { label: 'تم الحل',      bg: '#DCFCE7', text: '#166534' },
  approved:    { label: 'موافق عليه',   bg: '#DBEAFE', text: '#155E75' },
  delivered:   { label: 'تم التسليم',   bg: '#DCFCE7', text: '#166534' },
  rejected:    { label: 'مرفوض',        bg: '#FEE2E2', text: '#991B1B' },
};

const SEVERITY_LABEL = { high: 'عالي', medium: 'متوسط', low: 'منخفض' };
const SEVERITY_COLOR = { high: '#DC2626', medium: '#D97706', low: '#06B6D4' };

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
            <img src={BRAND.logo.color} alt="" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink leading-tight truncate">{BRAND.companyName}</p>
              <p className="text-[10px] text-primary font-bold leading-tight truncate">{BRAND.tagline}</p>
            </div>
          </div>

          <motion.button
            onClick={() => navigate('/profile')}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="w-10 h-10 rounded-xl bg-background border border-primary/20 flex items-center justify-center hover:bg-primary group transition-colors shrink-0"
          >
            <CircleUser size={18} weight="regular" className="text-primary group-hover:text-white transition-colors" />
          </motion.button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-5 space-y-5">

        {/* Compact welcome card */}
        <div className="rounded-3xl overflow-hidden shadow-lg animate-fade-slide-up">
          <div className="p-5 sm:p-6 relative overflow-hidden bg-ink">
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgb(var(--c-primary)) 0, rgb(var(--c-primary)) 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
            <div className="flex items-center justify-between gap-3 relative">
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs mb-0.5">مرحباً بك،</p>
                <h2 className="text-white font-bold text-lg sm:text-xl truncate leading-tight">{name}</h2>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin size={12} className="text-primary" />
                  <span className="text-primary text-xs font-bold">مراقب ميداني</span>
                </div>
              </div>
              <div className="bg-white/10 rounded-2xl px-3.5 py-2 text-center border border-white/10 shrink-0">
                <p className="text-white/50 text-[9px] mb-0.5">مركز</p>
                <p className="text-primary font-bold text-lg leading-tight tabular-nums">{centerNum}</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/10 mt-3 flex items-center gap-2">
              <Building2 size={14} className="text-primary shrink-0" />
              <p className="text-white text-xs font-medium leading-snug truncate">{caterer}</p>
            </div>
          </div>
          <div className="bg-background border-t border-line px-5 py-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-ink">{clock.hijri}</span>
            <span className="text-[11px] text-muted font-bold tabular-nums">{clock.time}</span>
          </div>
        </div>

        {/* Section content based on selected tab */}
        {view === 'actions' && (
          <div className="space-y-4 animate-fade-slide-up">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-line/50" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">القائمة الرئيسية</span>
              <div className="h-px flex-1 bg-line/50" />
            </div>
            <motion.div
              className="grid grid-cols-1 gap-3"
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
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-primary" />
                <span className="text-base font-black text-ink">نشاط اليوم</span>
                {activities.length > 0 && (
                  <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full tabular-nums">{activities.length}</span>
                )}
              </div>
            </div>

            {activities.length === 0 ? (
              <div className="bg-white border border-line rounded-3xl py-12 text-center shadow-sm">
                <Clock size={36} className="mx-auto text-line mb-3 opacity-40" weight="thin" />
                <p className="text-muted text-sm font-bold">لا يوجد نشاط مسجل لليوم بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {displayed.map(item => {
                  const cfg = ACTIVITY_CFG[item._col];
                  const { Icon } = cfg;
                  const ms = toMs(item);
                  const statusInfo = STATUS_DATA[item.status] || { label: item.status, bg: '#F3F4F6', text: '#374151' };
                  const showStatus = item.status && (item._col === 'reports' || item._col === 'logistics_requests');
                  const isSubmission = ['meal_evaluations', 'mina_readiness', 'arafat_readiness'].includes(item._col);
                  let title = item.reportType || item.type || cfg.label;
                  if (isSubmission) title = `تم رفع ${cfg.label}`;
                  const MEAL_LBL = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
                  const sub = item._col === 'reports' && item.severity
                    ? `خطورة: ${SEVERITY_LABEL[item.severity]}`
                    : (item.mealType ? (MEAL_LBL[item.mealType] || item.mealType) : '');

                  return (
                    <div key={item.id} className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="w-1.5 self-stretch rounded-full shrink-0"
                          style={{ background: item.severity ? SEVERITY_COLOR[item.severity] : cfg.color }} />
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                          <Icon size={18} style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5 gap-2">
                            <p className="text-sm font-bold text-ink truncate">{title}</p>
                            <span className="text-[10px] text-muted font-bold shrink-0 tabular-nums">{fmtTime(ms)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(item.reportNumber || item.requestNumber) && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums"
                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                {item.reportNumber || item.requestNumber}
                              </span>
                            )}
                            {sub && <span className="text-[10px] text-muted font-bold">{sub}</span>}
                            {showStatus && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: statusInfo.bg, color: statusInfo.text }}>
                                {statusInfo.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {item.adminNotes && (item._col === 'reports' || item._col === 'logistics_requests') && (
                        <div className="border-t border-line bg-gradient-to-br from-background to-white px-4 py-2.5">
                          <p className="text-[10px] text-primary font-black mb-1 tracking-wide">ملاحظات غرفة العمليات</p>
                          <p className="text-[12px] text-ink font-medium leading-relaxed whitespace-pre-wrap">{item.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {activities.length > 8 && (
                  <button onClick={() => setShowAll(p => !p)}
                    className="w-full py-3 text-primary font-bold text-sm bg-white rounded-2xl border border-dashed border-line mt-1">
                    {showAll ? 'عرض أقل' : `عرض الكل (${activities.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-line shadow-[0_-4px_20px_rgb(var(--c-ink)/0.06)] pb-[env(safe-area-inset-bottom)]">
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
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-b-full bg-primary" />
                )}
                <div className="relative">
                  <TIcon size={22} weight={active ? 'bold' : 'regular'} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white tabular-nums">
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
