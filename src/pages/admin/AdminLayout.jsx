import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../lib/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SquaresFour, Warning, Van, ClipboardText, Users, SignOut,
  Bell, List, X, CaretRight, ListChecks, Stack, CaretLeft,
  UserGear, ShieldCheck, ForkKnife,
} from '@phosphor-icons/react';
import logo from '../../assets/logo-light.svg';
import { getCaterer } from '../../config/centers.js';

const NAV = [
  { to: '/admin/dashboard',  label: 'نظرة عامة',         icon: SquaresFour  },
  { to: '/admin/reports',    label: 'البلاغات الميدانية', icon: Warning      },
  { to: '/admin/logistics',  label: 'الإسناد اللوجستي',  icon: Van          },
  { to: '/admin/analytics',  label: 'الجاهزية',            icon: ShieldCheck   },
  { to: '/admin/phases',     label: 'المراحل',             icon: Stack        },
  { to: '/admin/menu',       label: 'إدارة المنيو',        icon: ForkKnife    },
  { to: '/admin/tasks',      label: 'إسناد المهام',       icon: ListChecks   },
  { to: '/admin/users',      label: 'إدارة المستخدمين',  icon: Users        },
  { to: '/admin/staff',      label: 'إدارة الموظفين',    icon: UserGear     },
];

const NOTIF_COLS = [
  'reports', 'logistics_requests', 'meal_evaluations',
  'mina_readiness', 'arafat_readiness',
];

const spring = { type: 'spring', stiffness: 400, damping: 18 };

export default function AdminLayout() {
  const navigate              = useNavigate();
  const location              = useLocation();
  const { profile, logout }   = useAuth();
  const [open, setOpen]       = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [newCount,     setNewCount]     = useState(0);
  const [lastSeen,     setLastSeen]     = useState(
    () => Number(localStorage.getItem('notif_last_seen') || 0)
  );

  /* Reports sidebar badge */
  useEffect(() => {
    return db.reports.subscribe(rows =>
      setPendingCount(rows.filter(r => (r.status || 'pending') === 'pending').length)
    );
  }, []);

  /* Bell badge */
  useEffect(() => {
    const counts = {};
    const unsubs = NOTIF_COLS.map(col => {
      counts[col] = 0;
      return db[col].subscribe(rows => {
        counts[col] = rows.filter(d => (d.timestamp?.toMillis?.() ?? 0) > lastSeen).length;
        setNewCount(Object.values(counts).reduce((a, b) => a + b, 0));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [lastSeen]);

  /* Reset badge on notifications page */
  useEffect(() => {
    if (location.pathname === '/admin/notifications') {
      const now = Date.now();
      localStorage.setItem('notif_last_seen', now.toString());
      setLastSeen(now);
      setNewCount(0);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="relative px-5 py-4 border-b border-white/10 overflow-hidden">
        <div className="absolute inset-0 opacity-15"
          style={{ background: 'radial-gradient(ellipse at 70% 50%, #C4A46E 0%, transparent 70%)' }} />
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative flex flex-col items-center gap-1 cursor-default"
        >
          <img src={logo} alt="ضيوف البيت" className="w-full max-w-[152px] h-auto object-contain" />
          <p className="text-[9px] font-semibold tracking-widest uppercase opacity-40 text-white">لوحة الإدارة</p>
        </motion.div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }, idx) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 ${
                isActive ? 'text-white' : 'text-white/55 hover:text-white/90'
              }`
            }
            style={({ isActive }) => isActive
              ? { background: 'linear-gradient(135deg, rgba(196,164,110,0.25), rgba(169,129,89,0.15))', borderLeft: '2px solid #C4A46E' }
              : { borderLeft: '2px solid transparent' }
            }
          >
            {({ isActive }) => (
              <>
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  whileHover={{ scale: 1.18 }}
                  whileTap={{ scale: 0.88 }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 backdrop-blur-md border"
                  style={{
                    background: isActive ? 'rgba(196,164,110,0.18)' : 'rgba(255,255,255,0.04)',
                    borderColor: isActive ? 'rgba(196,164,110,0.35)' : 'rgba(255,255,255,0.07)',
                  }}
                >
                  <Icon
                    size={17}
                    weight={isActive ? 'duotone' : 'thin'}
                    color={isActive ? '#C4A46E' : 'rgba(255,255,255,0.55)'}
                  />
                </motion.div>

                <span className="flex-1 text-[13px]">{label}</span>

                {to === '/admin/reports' && pendingCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  >
                    {pendingCount}
                  </motion.span>
                )}

                {isActive && (
                  <CaretRight size={12} weight="bold" className="opacity-40 flex-shrink-0" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile + Logout */}
      <div className="px-4 py-4 border-t border-white/10">
        {/* Avatar + info */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <motion.div
            whileHover={{ scale: 1.08 }}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C4A46E] to-[#A98159] flex items-center justify-center flex-shrink-0 shadow-md cursor-default"
          >
            <span className="text-white text-sm font-bold">
              {(profile?.nameAr || profile?.name)?.charAt(0) || 'أ'}
            </span>
          </motion.div>
          <div className="min-w-0">
            <p className="text-white text-xs font-bold truncate">{profile?.nameAr || profile?.name || 'المشرف'}</p>
            <p className="text-white/40 text-[10px] truncate">{profile?.email || ''}</p>
          </div>
        </div>

        {/* Centers */}
        {profile?.centers?.length > 0 && (
          <div className="mb-2 px-1 max-h-24 overflow-y-auto space-y-1">
            {profile.centers.map(cid => (
              <div key={cid} className="bg-white/5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 transition-colors duration-150">
                <p className="text-[#A98159] text-[10px] font-bold">{cid}</p>
                <p className="text-white/50 text-[9px] truncate leading-tight">
                  {profile.caterers?.[cid] || getCaterer(cid)}
                </p>
              </div>
            ))}
          </div>
        )}
        {profile?.center && !profile?.centers?.length && (
          <div className="mb-2 px-1">
            <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
              <p className="text-[#A98159] text-[10px] font-bold">{profile.center}</p>
              <p className="text-white/50 text-[9px] truncate leading-tight">
                {profile.caterer || getCaterer(profile.center)}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <motion.button
          onClick={handleLogout}
          disabled={loggingOut}
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.96 }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/55 hover:bg-red-500/15 hover:text-red-300 text-sm transition-colors duration-200 disabled:opacity-50"
        >
          {loggingOut
            ? <span className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin flex-shrink-0" />
            : <SignOut size={16} weight="thin" className="flex-shrink-0" />}
          <span className="text-xs font-semibold">{loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}</span>
        </motion.button>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="flex h-screen font-arabic overflow-hidden"
      style={{ fontFamily: "'Cairo', Tahoma, sans-serif", background: 'linear-gradient(160deg, #F5F0EB 0%, #EDE5D8 100%)' }}>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg,#4A3B35 0%,#2D2926 60%,#231F1C 100%)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: 240 }}
              animate={{ x: 0 }}
              exit={{ x: 240 }}
              transition={spring}
              className="relative w-64 flex flex-col z-50 shadow-2xl"
              style={{ background: 'linear-gradient(180deg,#4A3B35 0%,#2D2926 60%,#231F1C 100%)' }}
            >
              <motion.button
                onClick={() => setOpen(false)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="absolute top-4 left-4 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X size={16} weight="thin" />
              </motion.button>
              <SidebarContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="border-b border-[#D9CEBC] px-3 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-[0_1px_8px_rgba(45,41,38,0.08)]"
          style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FDF8F2 100%)' }}>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setOpen(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="lg:hidden p-2 rounded-xl hover:bg-[#F5EEE4] transition-colors"
            >
              <List size={20} weight="thin" className="text-[#2D2926]" />
            </motion.button>
            <div>
              <p className="text-[11px] font-semibold text-[#9D8F85]">موسم الحج ١٤٤٧ هـ</p>
              <p className="text-sm font-bold text-[#2D2926]">لجنة التغذية | شركة ضيوف البيت</p>
            </div>
          </div>

          {/* Bell */}
          <motion.button
            onClick={() => navigate('/admin/notifications')}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="relative p-2.5 rounded-xl border border-[#D9CEBC] bg-white/60 backdrop-blur-md hover:bg-[#FDF8F0] hover:border-[#A98159]/50 transition-colors"
          >
            <Bell size={18} weight="thin" className="text-[#6D6E71]" />
            {newCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md"
                style={{ animation: 'badgePulse 2s ease-in-out infinite' }}
              >
                {newCount > 99 ? '99+' : newCount}
              </motion.span>
            )}
          </motion.button>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <style>{`
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50%       { transform: scale(1.08); box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  );
}
