import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../config/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  LayoutDashboard, FileText, Truck, ClipboardList,
  Users, LogOut, Menu, X, Bell, ChevronRight,
} from 'lucide-react';
import logo from '../../assets/logo.png';
import { getCaterer } from '../../config/centers.js';

const NAV = [
  { to: '/admin/dashboard',  label: 'نظرة عامة',        icon: LayoutDashboard },
  { to: '/admin/reports',    label: 'البلاغات الميدانية', icon: FileText        },
  { to: '/admin/logistics',  label: 'الإسناد اللوجستي',  icon: Truck           },
  { to: '/admin/analytics',  label: 'التقييمات',          icon: ClipboardList   },
  { to: '/admin/users',      label: 'إدارة المستخدمين',  icon: Users           },
];

export default function AdminLayout() {
  const navigate              = useNavigate();
  const { profile }           = useAuth();
  const [open, setOpen]       = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'reports'), where('status', '==', 'pending'));
    return onSnapshot(q, snap => setPendingCount(snap.size));
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut(auth).catch(() => {});
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="relative px-6 py-5 border-b border-white/10 overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 80% 50%, #C4A46E 0%, transparent 65%)' }} />
        <div className="relative flex items-center gap-3 group cursor-default">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-300"
              style={{ background: '#A98159' }} />
            <img src={logo} alt="logo" className="w-10 h-10 object-contain transition-transform duration-300 group-hover:scale-110 relative z-10" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-wide">ضيوف البيت</p>
            <p className="text-[10px] leading-tight font-semibold" style={{ color: '#C4A46E' }}>لوحة الإدارة</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'text-white shadow-[0_4px_20px_rgba(169,129,89,0.45)]'
                  : 'text-white/65 hover:bg-white/8 hover:text-white'
              }`
            }
            style={({ isActive }) => isActive
              ? { background: 'linear-gradient(135deg, #C4A46E, #A98159)' }
              : {}
            }
          >
            {({ isActive }) => (
              <>
                <div className={`transition-all duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-3'}`}>
                  <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
                </div>
                <span className="flex-1">{label}</span>
                {to === '/admin/reports' && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                    {pendingCount}
                  </span>
                )}
                {isActive && (
                  <ChevronRight size={14} className="opacity-60" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile + Logout */}
      <div className="px-4 py-4 border-t border-white/10">
        {/* Avatar + info */}
        <div className="flex items-center gap-3 mb-2 px-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C4A46E] to-[#A98159] flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-white text-sm font-bold">
              {(profile?.nameAr || profile?.name)?.charAt(0) || 'أ'}
            </span>
          </div>
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
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="group w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-white/60 hover:bg-red-500/20 hover:text-red-300 text-sm transition-all duration-200 disabled:opacity-50"
        >
          {loggingOut
            ? <span className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin flex-shrink-0" />
            : <LogOut size={16} className="flex-shrink-0 transition-all duration-300 group-hover:-translate-x-1" />}
          <span>{loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}</span>
        </button>
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
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-64 flex flex-col z-50 shadow-2xl"
            style={{ background: 'linear-gradient(180deg,#4A3B35 0%,#2D2926 60%,#231F1C 100%)' }}>
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 left-4 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all duration-200 hover:rotate-90"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="border-b border-[#D9CEBC] px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-[0_1px_8px_rgba(45,41,38,0.08)]"
          style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FDF8F2 100%)' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="group lg:hidden p-2 rounded-xl hover:bg-[#F5EEE4] transition-all duration-200"
            >
              <Menu size={20} className="text-[#2D2926] transition-transform duration-300 group-hover:scale-110" />
            </button>
            <div>
              <p className="text-[11px] font-semibold text-[#9D8F85]">موسم الحج ١٤٤٧ هـ</p>
              <p className="text-sm font-bold text-[#2D2926]">لوحة التحكم الميدانية</p>
            </div>
          </div>

          {/* Bell */}
          <button
            onClick={() => navigate('/admin/reports')}
            className="group relative p-2.5 rounded-xl border border-[#D9CEBC] hover:bg-[#FDF8F0] hover:border-[#A98159]/60 hover:shadow-md transition-all duration-200"
          >
            <Bell
              size={18}
              className="text-[#6D6E71] transition-all duration-300 group-hover:text-[#A98159] group-hover:scale-110 group-hover:rotate-12"
            />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md"
                style={{ animation: 'badgePulse 2s ease-in-out infinite' }}>
                {pendingCount}
              </span>
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
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
