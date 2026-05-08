import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  LayoutDashboard, FileText, Truck, Utensils,
  Users, LogOut, Menu, X, Bell,
} from 'lucide-react';
import logo from '../../assets/logo.png';

const NAV = [
  { to: '/admin/dashboard',  label: 'نظرة عامة',        icon: LayoutDashboard },
  { to: '/admin/reports',    label: 'البلاغات الميدانية', icon: FileText        },
  { to: '/admin/logistics',  label: 'الإسناد اللوجستي',  icon: Truck           },
  { to: '/admin/analytics',  label: 'تقييم الوجبات',     icon: Utensils        },
  { to: '/admin/users',      label: 'إدارة المستخدمين',  icon: Users           },
];

export default function AdminLayout() {
  const navigate        = useNavigate();
  const { profile }     = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="logo" className="w-10 h-10 object-contain" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">ضيوف البيت</p>
            <p className="text-[#A98159] text-[10px] leading-tight">لوحة الإدارة</p>
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
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#A98159] text-white shadow-md'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Profile + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-[#A98159]/20 border border-[#A98159]/40 flex items-center justify-center">
            <span className="text-[#A98159] text-xs font-bold">
              {profile?.name?.charAt(0) || 'أ'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-bold truncate">{profile?.name || 'المشرف'}</p>
            <p className="text-white/40 text-[10px] truncate">{profile?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white text-sm transition-all"
        >
          <LogOut size={16} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="flex h-screen bg-[#F5F0EB] font-arabic overflow-hidden"
      style={{ fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif" }}>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg,#3D3330 0%,#2D2926 100%)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-64 flex flex-col z-50"
            style={{ background: 'linear-gradient(180deg,#3D3330 0%,#2D2926 100%)' }}>
            <button onClick={() => setOpen(false)} className="absolute top-4 left-4 text-white/60 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-[#D1C4B9] px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition">
              <Menu size={20} className="text-[#2D2926]" />
            </button>
            <div>
              <p className="text-xs text-[#6D6E71]">موسم الحج</p>
              <p className="text-sm font-bold text-[#2D2926]">١٤٤٧ هـ — لوحة التحكم</p>
            </div>
          </div>
          <button className="relative p-2 rounded-xl border border-[#D1C4B9] hover:bg-[#FDF8F0] transition">
            <Bell size={18} className="text-[#6D6E71]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
