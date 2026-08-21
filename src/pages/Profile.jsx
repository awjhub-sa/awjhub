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
      <header className="bg-white border-b border-line px-4 py-4 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-[rgb(var(--c-bg))] rounded-full transition-colors text-muted">
          <ChevronRight size={24} />
        </button>
        <h1 className="text-lg font-bold text-ink">الملف الشخصي</h1>
        <div className="w-10"></div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="rounded-[18px] p-8 mb-8 text-center bg-[rgb(var(--c-ink))]">
          <div className="mx-auto mb-4 w-24 h-24 bg-white/10 rounded-full border border-white/20 flex items-center justify-center">
            <User size={48} className="text-white" weight="light" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {profile?.nameAr || profile?.name || 'مراقب ميداني'}
          </h2>

          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/10 rounded-full border border-white/20">
            <Briefcase size={14} className="text-accent" />
            <span className="text-white text-[12px] font-bold uppercase tracking-wider">
              {role === 'admin' ? 'مدير النظام' : 'مراقب ميداني'}
            </span>
          </div>
        </div>
        <div className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] overflow-hidden mb-8">
          <div className="p-4 border-b border-line bg-[rgb(var(--c-bg))]">
            <p className="text-[11px] font-bold text-muted tracking-widest uppercase">بيانات الارتباط</p>
          </div>

          <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-[11px] border flex items-center justify-center shrink-0"
                style={{
                  background: 'color-mix(in srgb, rgb(var(--c-primary)) 9%, #fff)',
                  borderColor: 'color-mix(in srgb, rgb(var(--c-primary)) 22%, #fff)',
                }}>
                <MapPin size={22} weight="duotone" className="text-primary" />
              </div>
              <div className="flex-1 text-start">
                <p className="text-[10.5px] text-muted font-bold">المركز الحالي</p>
                <p className="text-[15px] font-bold text-ink">{profile?.center || 'غير محدد'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-[11px] border flex items-center justify-center shrink-0"
                style={{
                  background: 'color-mix(in srgb, rgb(var(--c-primary)) 9%, #fff)',
                  borderColor: 'color-mix(in srgb, rgb(var(--c-primary)) 22%, #fff)',
                }}>
                <Mail size={22} weight="duotone" className="text-primary" />
              </div>
              <div className="flex-1 text-start min-w-0">
                <p className="text-[10.5px] text-muted font-bold">البريد الإلكتروني</p>
                <p className="text-[13px] font-bold text-ink truncate">{profile?.email}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <button
            onClick={handleSignOut}
            className="w-full bg-red-50 text-red-600 text-[13.5px] font-bold py-4 rounded-[12px] flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-200"
          >
            <LogOut size={20} />
            تسجيل الخروج من النظام
          </button>

          <div className="text-center pt-2">
            <span className="text-[10px] font-bold text-muted bg-[rgb(var(--c-bg))] px-4 py-1.5 rounded-full border border-line uppercase tracking-tighter">
              الإصدار 1.0.0
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}