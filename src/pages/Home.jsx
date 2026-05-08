// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import {
  Utensils, AlertTriangle, Truck,
  Bell, User, ChevronLeft, TrendingUp,
  ClipboardCheck, MapPin, Home as HomeIcon, Mountain, Building2,
  Package, ChevronDown, ChevronUp, LogOut
} from 'lucide-react';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';
import { db, auth } from '../config/db.js';

/* ── Decorative rule ── */
const GoldRule = () => (
  <svg width="100" height="6" viewBox="0 0 100 6" fill="none">
    <line x1="0" y1="3" x2="32" y2="3" stroke="#A98159" strokeWidth="0.75" />
    <circle cx="40" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <circle cx="50" cy="3" r="2.5" fill="#A98159" />
    <circle cx="60" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <line x1="68" y1="3" x2="100" y2="3" stroke="#A98159" strokeWidth="0.75" />
  </svg>
);

/* ── Menu card ── */
const MenuCard = ({ icon: Icon, title, subtitle, badge, onClick, variant = 'default' }) => {
  const isAccent = variant === 'accent';
  return (
    <button
      onClick={onClick}
      className={`
        group w-full text-right rounded-2xl p-5 flex items-center gap-4
        transition-all duration-300 active:scale-[0.97] border
        ${isAccent
          ? 'border-transparent hover:brightness-110 hover:shadow-2xl'
          : 'bg-background border-appBorder hover:border-primary/50 hover:shadow-[0_8px_30px_rgba(169,129,89,0.18)] hover:-translate-y-0.5'}
      `}
      style={isAccent ? { background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)', boxShadow: '0 4px 20px rgba(45,41,38,0.25)' } : {}}
    >
      <div className={`
        flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center
        transition-all duration-300 group-hover:scale-110 group-hover:rotate-3
        ${isAccent
          ? 'bg-white/10 group-hover:bg-white/20'
          : 'bg-primary-50 border border-primary/20 group-hover:bg-primary/10 group-hover:border-primary/40'}
      `}>
        <Icon size={26} className="text-primary transition-all duration-300 group-hover:scale-105" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-bold text-base ${isAccent ? 'text-white' : 'text-dark'}`}>{title}</span>
          {badge && (
            <span className="bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {badge}
            </span>
          )}
        </div>
        <p className={`text-sm mt-0.5 truncate transition-colors duration-300 ${isAccent ? 'text-white/50 group-hover:text-white/70' : 'text-secondary group-hover:text-primary/70'}`}>
          {subtitle}
        </p>
      </div>
      <ChevronLeft
        size={18}
        className={`flex-shrink-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100 opacity-50
          ${isAccent ? 'text-white' : 'text-primary'}`}
        strokeWidth={2.5}
      />
    </button>
  );
};

/* ── Activity config ── */
const ACTIVITY_CFG = {
  reports: {
    label:   'بلاغ ميداني',
    Icon:    AlertTriangle,
    color:   '#DC2626',
    bg:      '#FEF2F2',
    border:  '#FECACA',
  },
  meal_evaluations: {
    label:   'تقييم وجبات',
    Icon:    Utensils,
    color:   '#A98159',
    bg:      '#FDF8F0',
    border:  '#D1C4B9',
  },
  mina_readiness: {
    label:   'جاهزية منى',
    Icon:    HomeIcon,
    color:   '#0369A1',
    bg:      '#F0F9FF',
    border:  '#BAE6FD',
  },
  arafat_readiness: {
    label:   'جاهزية عرفة',
    Icon:    Mountain,
    color:   '#7C3AED',
    bg:      '#F5F3FF',
    border:  '#DDD6FE',
  },
  logistics_requests: {
    label:   'طلب إسناد',
    Icon:    Package,
    color:   '#059669',
    bg:      '#ECFDF5',
    border:  '#A7F3D0',
  },
};

const SEVERITY_LABEL = { high: 'عالي', medium: 'متوسط', low: 'منخفض' };
const SEVERITY_COLOR  = { high: '#DC2626', medium: '#D97706', low: '#3B82F6' };
const STATUS_LABEL   = { pending: 'قيد المراجعة', reviewed: 'تمت المراجعة', resolved: 'مُغلق' };

/* timestamp helper */
function toMs(doc) {
  return doc.timestamp?.toMillis?.() ?? doc.createdAt?.toMillis?.() ?? 0;
}
function fmtTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/* ══════════════════════════════════════════════════════════ */
export default function Home() {
  const navigate      = useNavigate();
  const { profile }   = useAuth();
  const [clock, setClock]       = useState({ hijri: '', time: '' });
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut(auth).catch(() => {});
    navigate('/login', { replace: true });
  };
  const [activities, setActivities] = useState([]);
  const [showAll, setShowAll]   = useState(false);

  /* ── ساعة هجرية حية ── */
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

  /* ── سجل اليوم — الاستماع لكل collections الخاصة بالمراقب ── */
  useEffect(() => {
    if (!profile?.uid) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const cols = Object.keys(ACTIVITY_CFG);
    const unsubs = [];
    const store  = {};

    cols.forEach(col => {
      store[col] = [];
      const q = query(collection(db, col), where('uid', '==', profile.uid));
      const unsub = onSnapshot(q, snap => {
        store[col] = snap.docs
          .map(d => ({ id: d.id, _col: col, ...d.data() }))
          .filter(d => toMs(d) >= todayMs);
        const all = cols.flatMap(c => store[c]);
        all.sort((a, b) => toMs(b) - toMs(a));
        setActivities([...all]);
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [profile?.uid]);

  /* ── Profile helpers ── */
  const name      = profile?.nameAr || profile?.name || 'المراقب';
  const center    = profile?.center || '—';
  const caterer   = profile?.caterer || getCaterer(profile?.center) || '—';
  const centerNum = center !== '—' ? center.replace('مركز ', '') : '—';
  const isSup     = profile?.role === 'supervisor' || profile?.role === 'admin';
  const supCenters = profile?.centers || (profile?.center ? [profile.center] : []);

  /* ── counts per type ── */
  const counts = Object.fromEntries(
    Object.keys(ACTIVITY_CFG).map(c => [c, activities.filter(a => a._col === c).length])
  );
  const totalToday = activities.length;

  const displayed = showAll ? activities : activities.slice(0, 4);

  return (
    <div dir="rtl" className="min-h-screen bg-background font-arabic"
      style={{ fontFamily: "'IBM Plex Sans Arabic', 'Noto Kufi Arabic', Tahoma, sans-serif" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-appBorder px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="شعار التطبيق" className="w-11 h-11 object-contain" />
            <div>
              <p className="text-xs font-bold text-dark leading-tight">ضيوف البيت</p>
              <p className="text-[10px] text-secondary leading-tight">منظومة المراقبة الميدانية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="group relative w-9 h-9 rounded-xl border border-appBorder flex items-center justify-center hover:bg-primary-50 hover:border-primary/30 transition-all duration-200">
              <Bell size={17} className="text-secondary transition-all duration-300 group-hover:text-primary group-hover:scale-110 group-hover:rotate-12" strokeWidth={1.75} />
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="تسجيل الخروج"
              className="group w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center hover:bg-red-500 hover:border-red-500 transition-all duration-300 disabled:opacity-50"
            >
              {loggingOut
                ? <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                : <LogOut size={16} className="text-red-500 transition-all duration-300 group-hover:text-white group-hover:-translate-x-0.5" strokeWidth={2} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-10">

        {/* ── Welcome Card ── */}
        <div className="mt-5 rounded-2xl overflow-hidden shadow-card-lg"
          style={{ animation: 'fadeSlideUp 0.4s ease forwards' }}>

          <div className="p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 55%, #1A1511 100%)' }}>
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, #A98159 0, #A98159 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />

            {/* Name + center */}
            <div className="flex items-start justify-between mb-4 relative">
              <div className="flex-1 min-w-0 ml-3">
                <p className="text-white/50 text-xs mb-0.5">مرحباً بك،</p>
                <h2 className="text-white font-bold text-xl leading-tight truncate">{name}</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin size={11} className="text-primary flex-shrink-0" />
                  <span className="text-primary text-xs font-medium">
                    {isSup ? 'مشرف ميداني' : 'مراقب ميداني'}
                  </span>
                </div>
              </div>
              {!isSup ? (
                <div className="bg-white/10 rounded-xl px-4 py-2 text-center border border-white/10 flex-shrink-0">
                  <p className="text-white/50 text-[10px]">مركز رقم</p>
                  <p className="text-primary font-bold text-2xl leading-tight">{centerNum}</p>
                </div>
              ) : (
                <div className="bg-white/10 rounded-xl px-4 py-2 text-center border border-white/10 flex-shrink-0">
                  <p className="text-white/50 text-[10px]">مراكزك</p>
                  <p className="text-primary font-bold text-2xl leading-tight">{supCenters.length}</p>
                </div>
              )}
            </div>

            <div className="mb-3 relative"><GoldRule /></div>

            {/* Caterer */}
            {!isSup ? (
              <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <div className="flex items-start gap-2">
                  <Building2 size={13} className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white/50 text-[10px] mb-0.5">{center} — المتعهد</p>
                    <p className="text-white text-xs font-medium leading-snug">{caterer}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {supCenters.map(cid => (
                  <div key={cid} className="bg-white/5 rounded-xl px-3 py-2 border border-white/10 flex items-start gap-2">
                    <Building2 size={11} className="text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-primary text-[10px] font-bold">{cid}</p>
                      <p className="text-white/70 text-[10px] leading-snug truncate">
                        {profile?.caterers?.[cid] || getCaterer(cid)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer — تاريخ هجري + وقت */}
          <div className="bg-primary-50 border-t border-appBorder px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" strokeWidth={2} />
              <span className="text-xs font-medium text-dark">{clock.hijri || '…'}</span>
            </div>
            <span className="text-xs text-secondary font-medium">{clock.time}</span>
          </div>
        </div>

        {/* ── سجل اليوم ── */}
        <div className="mt-6" style={{ animation: 'fadeSlideUp 0.4s ease 0.15s both' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} className="text-primary" strokeWidth={2} />
              <span className="text-sm font-bold text-dark">سجل اليوم</span>
              {totalToday > 0 && (
                <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {totalToday}
                </span>
              )}
            </div>
            {/* mini counts */}
            <div className="flex items-center gap-1.5">
              {Object.entries(ACTIVITY_CFG).map(([col, cfg]) =>
                counts[col] > 0 ? (
                  <span key={col}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                    {counts[col]} {cfg.label.split(' ')[0]}
                  </span>
                ) : null
              )}
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="bg-white border border-appBorder rounded-2xl py-8 text-center">
              <ClipboardCheck size={28} className="mx-auto text-primary/30 mb-2" strokeWidth={1.5} />
              <p className="text-secondary text-sm">لا يوجد نشاط اليوم بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(item => {
                const cfg = ACTIVITY_CFG[item._col];
                const { Icon } = cfg;
                const ms = toMs(item);

                /* عنوان حسب نوع النشاط */
                let title = cfg.label;
                let sub   = '';
                if (item._col === 'reports') {
                  const typeMap = {
                    water:'مياه', electric:'كهرباء', crowd:'ازدحام',
                    food:'غذاء', medical:'طبي', security:'أمن', fire:'حريق', other:'أخرى'
                  };
                  title = `بلاغ — ${typeMap[item.reportType || item.type] || item.reportType || 'غير محدد'}`;
                  sub   = SEVERITY_LABEL[item.severity] ? `خطورة: ${SEVERITY_LABEL[item.severity]}` : '';
                } else if (item._col === 'meal_evaluations') {
                  title = 'تقييم جودة وجبات';
                  sub   = item.mealType || item.meal || '';
                } else if (item._col === 'mina_readiness') {
                  title = 'جاهزية مشعر منى';
                } else if (item._col === 'arafat_readiness') {
                  title = 'جاهزية مشعر عرفة';
                } else if (item._col === 'logistics_requests') {
                  title = 'طلب إسناد';
                  sub   = item.requestType || item.type || '';
                }

                const statusLabel = item.status ? (STATUS_LABEL[item.status] || item.status) : '';
                const sevColor    = item.severity ? SEVERITY_COLOR[item.severity] : cfg.color;

                return (
                  <div key={item.id}
                    className="group bg-white border rounded-2xl px-4 py-3 flex items-start gap-3 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                    style={{ borderColor: cfg.border }}>
                    {/* left strip */}
                    <div className="w-1 self-stretch rounded-full flex-shrink-0 transition-all duration-300 group-hover:w-1.5"
                      style={{ background: sevColor }} />

                    {/* icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <Icon size={16} style={{ color: cfg.color }} strokeWidth={2} />
                    </div>

                    {/* content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-dark truncate">{title}</p>
                        <span className="text-[10px] text-secondary flex-shrink-0">{fmtTime(ms)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {sub && <span className="text-xs text-secondary">{sub}</span>}
                        {statusLabel && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full transition-all duration-200"
                            style={{
                              background: item.status === 'pending' ? '#FEF9C3' : item.status === 'reviewed' ? '#DCFCE7' : '#F3F4F6',
                              color:      item.status === 'pending' ? '#854D0E' : item.status === 'reviewed' ? '#166534' : '#374151',
                            }}>
                            {statusLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {activities.length > 4 && (
                <button
                  onClick={() => setShowAll(p => !p)}
                  className="group w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-primary font-medium hover:bg-primary-50 rounded-xl transition-all duration-200 hover:shadow-sm">
                  {showAll
                    ? <><ChevronUp size={15} className="transition-transform duration-300 group-hover:-translate-y-0.5" /> عرض أقل</>
                    : <><ChevronDown size={15} className="transition-transform duration-300 group-hover:translate-y-0.5" /> عرض الكل ({activities.length})</>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Section label ── */}
        <div className="flex items-center gap-3 mt-7 mb-4" style={{ animation: 'fadeSlideUp 0.4s ease 0.2s both' }}>
          <div className="h-px flex-1 bg-appBorder" />
          <span className="text-xs font-semibold text-secondary uppercase tracking-widest">القائمة الرئيسية</span>
          <div className="h-px flex-1 bg-appBorder" />
        </div>

        {/* ── Menu Items ── */}
        <div className="flex flex-col gap-3" style={{ animation: 'fadeSlideUp 0.4s ease 0.25s both' }}>
          <MenuCard icon={Utensils}      title="تقييم جودة الوجبات"     subtitle="رفع تقرير جودة وجبات الحجاج"              onClick={() => navigate('/mealcheck')}       variant="accent" />
          <MenuCard icon={HomeIcon}      title="تقييم جاهزية مشعر منى"  subtitle="فحص جاهزية المطبخ والمرافق الغذائية"    onClick={() => navigate('/mina-readiness')} />
          <MenuCard icon={Mountain}      title="تقييم جاهزية مشعر عرفة" subtitle="فحص جاهزية المطبخ والمرافق الغذائية"    onClick={() => navigate('/arafat-readiness')} />
          <MenuCard icon={AlertTriangle} title="بلاغ طارئ"               subtitle="إرسال بلاغ عاجل لغرفة العمليات"          onClick={() => navigate('/report')}          badge="جديد" />
          <MenuCard icon={Truck}         title="رفع طلب إسناد"           subtitle="طلب معدات أو موارد بشرية"               onClick={() => navigate('/logistics')} />
        </div>

      </main>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
