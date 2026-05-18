// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ForkKnife as Utensils, Warning as AlertTriangle, Van as Truck,
  Bell, User, CaretLeft as ChevronLeft, TrendUp as TrendingUp,
  ClipboardText as ClipboardCheck, MapPin, House as HomeIcon, Mountains as Mountain, Buildings as Building2,
  Package, Clock, SignOut as LogOut,
} from '@phosphor-icons/react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { db } from '../config/db.js';
import { useAssignedTasks } from '../hooks/useAssignedTasks.js';
import TodayMenuCard from '../components/TodayMenuCard.jsx';

/* ── Decorative Gold Rule ── */
const GoldRule = () => (
  <svg width="100" height="6" viewBox="0 0 100 6" fill="none">
    <line x1="0" y1="3" x2="32" y2="3" stroke="#A98159" strokeWidth="0.75" />
    <circle cx="40" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <circle cx="50" cy="3" r="2.5" fill="#A98159" />
    <circle cx="60" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <line x1="68" y1="3" x2="100" y2="3" stroke="#A98159" strokeWidth="0.75" />
  </svg>
);

const _cardSpring = { type: 'spring', stiffness: 380, damping: 18 };

/* ── Reusable Menu Card ── */
const MenuCard = ({ icon: Icon, title, subtitle, badge, onClick, variant = 'default' }) => {
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
          : 'bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 border-[#EDE5DC] text-[#2D2926] hover:border-[#A98159]/40 hover:shadow-[0_8px_28px_rgba(169,129,89,0.18)]'
      }`}
      style={isAccent
        ? { background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)', boxShadow: '0 6px 24px rgba(45,41,38,0.28)' }
        : { boxShadow: '0 2px 10px rgba(45,41,38,0.06)' }}
    >
      {/* Top accent stripe (accent variant only) */}
      {isAccent && (
        <div className="absolute top-0 right-0 left-0 h-0.5 opacity-70"
          style={{ background: 'linear-gradient(90deg, transparent, #C4A46E, transparent)' }} />
      )}

      {/* Icon with glow + sparkle */}
      <div className="relative flex-shrink-0">
        <div className={`absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover/menu:opacity-60 transition-opacity duration-500 ${isAccent ? 'bg-[#C4A46E]' : 'bg-[#A98159]'}`} />
        <motion.div
          whileHover={{ scale: 1.15, rotate: 5 }}
          whileTap={{ scale: 0.88 }}
          transition={_cardSpring}
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-md border-2"
          style={isAccent
            ? { background: 'linear-gradient(135deg, rgba(196,164,110,0.18), rgba(169,129,89,0.10))', borderColor: 'rgba(196,164,110,0.35)' }
            : { background: 'linear-gradient(135deg, #FDF8F0, #F3EAE0)', borderColor: 'rgba(169,129,89,0.25)' }}
        >
          <Icon size={26} weight="duotone" className="text-[#A98159]" />
          <Sparkles size={9} className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow" />
        </motion.div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-base">{title}</span>
          {badge && (
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
        {subtitle && (
          <p className={`text-sm mt-1 truncate ${isAccent ? 'text-white/60' : 'text-[#6D6E71]'}`}>
            {subtitle}
          </p>
        )}
      </div>

      <motion.div
        whileHover={{ x: -4 }}
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
          isAccent ? 'bg-white/10 group-hover/menu:bg-white/20' : 'bg-[#FDF8F0] group-hover/menu:bg-[#A98159]/15'
        }`}
      >
        <ChevronLeft size={16} weight="bold" className={isAccent ? 'text-white' : 'text-[#A98159]'} />
      </motion.div>
    </motion.button>
  );
};

/* ── Activity Display Configuration ── */
const ACTIVITY_CFG = {
  reports: { label: 'بلاغ طارئ', Icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  meal_evaluations: { label: 'تقييم وجبات', Icon: Utensils, color: '#A98159', bg: '#FDF8F0', border: '#D1C4B9' },
  mina_readiness: { label: 'جاهزية منى', Icon: HomeIcon, color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  arafat_readiness: { label: 'جاهزية عرفة', Icon: Mountain, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  logistics_requests: { label: 'طلب إسناد', Icon: Package, color: '#3182CE', bg: '#EFF6FF', border: '#BFDBFE' },
};

/* ── Status Styles ── */
const STATUS_DATA = {
  pending:     { label: 'قيد الانتظار', bg: '#FEF9C3', text: '#854D0E' },
  in_progress: { label: 'جارٍ التنفيذ', bg: '#DBEAFE', text: '#1E40AF' },
  resolved:    { label: 'تم الحل',      bg: '#DCFCE7', text: '#166534' },
  approved:    { label: 'موافق عليه',   bg: '#DBEAFE', text: '#1E40AF' },
  delivered:   { label: 'تم التسليم',   bg: '#DCFCE7', text: '#166534' },
  rejected:    { label: 'مرفوض',        bg: '#FEE2E2', text: '#991B1B' }
};

const SEVERITY_LABEL = { high: 'عالي', medium: 'متوسط', low: 'منخفض' };
const SEVERITY_COLOR  = { high: '#DC2626', medium: '#D97706', low: '#3B82F6' };

function toMs(doc) {
  return doc.timestamp?.toMillis?.() ?? doc.createdAt?.toMillis?.() ?? 0;
}

function fmtTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [clock, setClock] = useState({ hijri: '', time: '' });
  const [activities, setActivities] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({
        hijri: now.toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' }),
        time:  now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true }),
      });
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!profile?.uid || !profile?.center) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    /* Listen by CENTER (not uid) so the observer sees anything submitted on
       their center — whether they uploaded it or the supervisor did. */
    const collectionsToTrack = Object.keys(ACTIVITY_CFG);
    const unsubs = collectionsToTrack.map(col => {
      const q = query(collection(db, col), where('center', '==', profile.center));
      return onSnapshot(q, snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, _col: col, ...d.data() }))
          .filter(d => toMs(d) >= todayMs);

        setActivities(prev => {
          const others = prev.filter(a => a._col !== col);
          const combined = [...others, ...docs];
          return combined.sort((a, b) => toMs(b) - toMs(a));
        });
      });
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [profile?.uid, profile?.center]);

  const { tasks, completions } = useAssignedTasks(profile);

  const pendingMealBadge = (() => {
    const mealTasks = tasks.filter(t => t.task_types?.includes('meal_evaluation'));
    let count = 0;
    mealTasks.forEach(task => {
      (task.meal_types || []).forEach(mt => {
        if (!completions.some(c => c.taskId === task.id && c.mealType === mt)) count++;
      });
    });
    return count || null;
  })();

  const pendingMinaBadge = (() => {
    const count = tasks.filter(t => t.task_types?.includes('mina_readiness') &&
      !completions.some(c => c.taskId === t.id && c.taskType === 'mina_readiness')).length;
    return count || null;
  })();

  const pendingArafatBadge = (() => {
    const count = tasks.filter(t => t.task_types?.includes('arafat_readiness') &&
      !completions.some(c => c.taskId === t.id && c.taskType === 'arafat_readiness')).length;
    return count || null;
  })();

  const totalPendingBadge = (pendingMealBadge || 0) + (pendingMinaBadge || 0) + (pendingArafatBadge || 0) || null;

  const name = profile?.nameAr || profile?.name || 'المراقب الميداني';
  const center = profile?.center || '—';
  const caterer = profile?.caterer || getCaterer(profile?.center) || '—';
  const centerNum = center !== '—' ? center.replace('مركز ', '') : '—';
  const isSup = profile?.role === 'supervisor' || profile?.role === 'admin';
  // التحقق من وجود مصفوفة المراكز لتجنب خطأ length
  const centersCount = profile?.centers ? profile.centers.length : (profile?.center ? 1 : 0);

  const displayed = showAll ? activities : activities.slice(0, 4);

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] font-arabic pb-10">
      
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-xs font-bold text-[#2D2926] leading-tight">ضيوف البيت</p>
              <p className="text-[10px] text-[#A98159] font-bold leading-tight">منظومة المراقبة الميدانية</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="relative w-10 h-10 rounded-xl border border-[#D1C4B9] bg-white/60 backdrop-blur-md flex items-center justify-center hover:bg-[#FDF8F0] transition-colors"
            >
              <Bell size={18} weight="thin" className="text-[#6D6E71]" />
              {totalPendingBadge && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={_cardSpring}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#BA1A1A] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                  style={{ animation: 'softPulse 2s ease-in-out infinite' }}
                >
                  {totalPendingBadge}
                </motion.span>
              )}
            </motion.button>

            <motion.button
              onClick={() => navigate('/profile')}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="w-10 h-10 rounded-xl bg-[#FDF8F0] border border-[#A98159]/20 backdrop-blur-md flex items-center justify-center hover:bg-[#A98159] group transition-colors"
            >
              <User size={18} weight="thin" className="text-[#A98159] group-hover:text-white transition-colors" />
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        <div className="lg:col-span-7 space-y-6">
          
          <div className="rounded-[2.5rem] overflow-hidden shadow-xl animate-fade-slide-up">
            <div className="p-8 relative overflow-hidden bg-[#2D2926]">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #A98159 0, #A98159 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
              
              <div className="flex items-start justify-between mb-6 relative">
                <div className="flex-1 min-w-0">
                  <p className="text-white/50 text-sm mb-1">مرحباً بك،</p>
                  <h2 className="text-white font-bold text-2xl truncate leading-tight">{name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <MapPin size={14} className="text-[#A98159]" />
                    <span className="text-[#A98159] text-sm font-bold">{isSup ? 'مشرف ميداني' : 'مراقب ميداني'}</span>
                  </div>
                </div>
                <div className="bg-white/10 rounded-2xl px-5 py-3 text-center border border-white/10 shrink-0">
                    <p className="text-white/50 text-[10px] mb-1">{isSup ? 'المراكز' : 'مركز رقم'}</p>
                    <p className="text-[#A98159] font-bold text-2xl leading-tight">{isSup ? centersCount : centerNum}</p>
                </div>
              </div>

              <div className="mb-6 relative w-48"><GoldRule /></div>

              <div className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <Building2 size={18} className="text-[#A98159] mt-0.5" />
                  <div>
                    <p className="text-white/50 text-[10px] mb-1">{center} — المتعهد المسجل</p>
                    <p className="text-white text-sm font-bold leading-snug">{caterer}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-[#FDF8F0] border-t border-[#D1C4B9] px-8 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#A98159]">
                <TrendingUp size={16} />
                <span className="text-sm font-bold text-[#2D2926]">{clock.hijri}</span>
              </div>
              <span className="text-sm text-[#6D6E71] font-bold">{clock.time}</span>
            </div>
          </div>

          {/* Today's menu for this observer's center */}
          {profile?.center && (
            <TodayMenuCard centerId={profile.center} />
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={20} className="text-[#A98159]" />
                <span className="text-lg font-black text-[#2D2926]">سجل النشاط اليومي</span>
                {activities.length > 0 && <span className="bg-[#A98159] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{activities.length}</span>}
              </div>
            </div>

            {activities.length === 0 ? (
              <div className="bg-white border border-[#D1C4B9] rounded-3xl py-12 text-center shadow-sm">
                <Clock size={40} className="mx-auto text-[#D1C4B9] mb-3 opacity-40" weight="thin" />
                <p className="text-[#6D6E71] text-sm font-bold font-arabic">لا يوجد نشاط مسجل لليوم بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {displayed.map(item => {
                  const cfg = ACTIVITY_CFG[item._col];
                  const { Icon } = cfg;
                  const ms = toMs(item);
                  const statusInfo = STATUS_DATA[item.status] || { label: item.status, bg: '#F3F4F6', text: '#374151' };

                  /* Status pill is only meaningful for reports & logistics_requests
                     (admin workflow). Evaluations/readiness are submissions — once
                     uploaded they're "done" from the observer's perspective, so
                     showing "قيد الانتظار" is confusing. */
                  const showStatus = item.status && (item._col === 'reports' || item._col === 'logistics_requests');

                  /* Title: for evaluations/readiness, prefix with "تم رفع" so the
                     observer sees a clear "completed" message. */
                  const isSubmission = item._col === 'meal_evaluations'
                    || item._col === 'mina_readiness'
                    || item._col === 'arafat_readiness';
                  let title = item.reportType || item.type || cfg.label;
                  if (isSubmission) title = `تم رفع ${cfg.label}`;
                  const MEAL_LBL = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
                  let sub = item._col === 'reports' && item.severity
                    ? `خطورة: ${SEVERITY_LABEL[item.severity]}`
                    : (item.mealType ? (MEAL_LBL[item.mealType] || item.mealType) : '');

                  return (
                    <div key={item.id} className="bg-white border border-[#D1C4B9] rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                      <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: item.severity ? SEVERITY_COLOR[item.severity] : cfg.color }} />
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <Icon size={20} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-base font-bold text-[#2D2926] truncate">{title}</p>
                          <span className="text-xs text-[#6D6E71] font-bold shrink-0 mr-2">{fmtTime(ms)}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(item.reportNumber || item.requestNumber) && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md shrink-0"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                              {item.reportNumber || item.requestNumber}
                            </span>
                          )}
                          {sub && <span className="text-xs text-[#6D6E71] font-bold">{sub}</span>}
                          {showStatus && (
                            <span className="text-[10px] font-black px-3 py-0.5 rounded-full border border-black/5"
                                  style={{ background: statusInfo.bg, color: statusInfo.text }}>
                              {statusInfo.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {activities.length > 4 && (
                  <button onClick={() => setShowAll(p => !p)} className="w-full py-3 text-[#A98159] font-bold text-sm bg-white hover:bg-gray-50 rounded-2xl transition-all border border-dashed border-[#D1C4B9] mt-2">
                    {showAll ? 'عرض أقل' : `عرض الكل (${activities.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#D1C4B9]/50" />
            <span className="text-[10px] font-black text-[#A98159] uppercase tracking-widest">القائمة الرئيسية</span>
            <div className="h-px flex-1 bg-[#D1C4B9]/50" />
          </div>

          <motion.div
            className="grid grid-cols-1 gap-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          >
            {[
              { icon: Utensils,      title: 'تقييم جودة الوجبات',  path: '/mealcheck',        variant: 'accent', badge: pendingMealBadge   },
              { icon: HomeIcon,      title: 'جاهزية مشعر منى',     path: '/mina-readiness',   variant: 'default', badge: pendingMinaBadge  },
              { icon: Mountain,      title: 'جاهزية مشعر عرفة',    path: '/arafat-readiness', variant: 'default', badge: pendingArafatBadge },
              { icon: AlertTriangle, title: 'بلاغ طارئ',           path: '/report',           variant: 'default', badge: null              },
              { icon: Truck,         title: 'طلب إسناد لوجستي',    path: '/logistics',        variant: 'default', badge: null              },
            ].map((item, i) => (
              <motion.div
                key={item.path}
                variants={{
                  hidden:  { opacity: 0, x: 20 },
                  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 340, damping: 22 } },
                }}
              >
                <MenuCard
                  icon={item.icon}
                  title={item.title}
                  onClick={() => navigate(item.path)}
                  variant={item.variant}
                  badge={item.badge}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>

      </main>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-slide-up { animation: fadeSlideUp 0.5s ease-out forwards; }
        @keyframes softPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.75; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}