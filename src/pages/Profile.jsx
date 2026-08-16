import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  User,
  MapPin,
  Briefcase,
  Envelope as Mail,
  SignOut as LogOut,
  CaretRight as ChevronRight,
  Sparkle as Sparkles,
} from '@phosphor-icons/react';

export default function Profile() {
  const navigate = useNavigate();
  const { profile, role, logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('حدث خطأ أثناء تسجيل الخروج:', error);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-canvas font-arabic">
      {}
      <header className="bg-white border-b border-line px-4 py-4 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors text-muted">
          <ChevronRight size={24} />
        </button>
        <h1 className="text-lg font-bold text-ink">الملف الشخصي</h1>
        <div className="w-10"></div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        
        {}
        <div 
          className="rounded-[2.5rem] p-8 mb-8 text-center shadow-lg relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgb(var(--c-ink-800)) 0%, rgb(var(--c-ink)) 100%)' }}
        >
          <div className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgb(var(--c-primary)) 0, rgb(var(--c-primary)) 1px, transparent 0, transparent 50%)', backgroundSize: '15px 15px' }} />

          <div className="relative z-10 group/avatar mx-auto mb-4 w-fit">
            <div className="absolute inset-0 rounded-full blur-2xl bg-primary opacity-50 group-hover/avatar:opacity-90 transition-opacity" />
            <div className="relative w-24 h-24 bg-white/10 rounded-full border-2 border-primary/30 flex items-center justify-center group-hover/avatar:scale-105 transition-transform duration-300">
              <User size={48} className="text-primary" weight="light" />
              <Sparkles size={14} className="absolute top-1 right-1 text-yellow-200 drop-shadow animate-pulse" />
            </div>
          </div>

          <h2 className="relative z-10 text-2xl font-bold text-white mb-2">
            {profile?.nameAr || profile?.name || 'مراقب ميداني'}
          </h2>
          
          <div className="relative z-10 inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary/20 rounded-full border border-primary/20">
            <Briefcase size={14} className="text-primary" />
            <span className="text-primary text-xs font-bold uppercase tracking-wider">
              {role === 'admin' ? 'مدير النظام' : 'مراقب ميداني'}
            </span>
          </div>
        </div>

        {}
        <div className="bg-white rounded-3xl border border-line shadow-sm overflow-hidden mb-8">
          <div className="p-4 border-b border-line bg-gray-50/50">
            <p className="text-xs font-bold text-muted tracking-widest uppercase">بيانات الارتباط</p>
          </div>
          
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-background flex items-center justify-center text-primary">
                <MapPin size={22} />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] text-muted font-bold">المركز الحالي</p>
                <p className="text-base font-bold text-ink">{profile?.center || 'غير محدد'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-background flex items-center justify-center text-primary">
                <Mail size={22} />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] text-muted font-bold">البريد الإلكتروني</p>
                <p className="text-sm font-bold text-ink truncate">{profile?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="space-y-4">
          <button 
            onClick={handleSignOut}
            className="w-full bg-red-50 text-red-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-all border border-red-100 shadow-sm active:scale-[0.98]"
          >
            <LogOut size={20} />
            تسجيل الخروج من النظام
          </button>

          <div className="text-center pt-2">
            <span className="text-[9px] font-black text-primary bg-background px-4 py-1.5 rounded-full border border-primary/10 uppercase tracking-tighter">
              الإصدار 1.0.0
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}