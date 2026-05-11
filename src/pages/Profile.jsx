import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { User, MapPin, Briefcase, Mail, LogOut, ChevronRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/db.js';

export default function Profile() {
  const navigate = useNavigate();
  const { profile, role } = useAuth(); // سحب البيانات من الـ Context الذي زودتني به

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('حدث خطأ أثناء تسجيل الخروج:', error);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] font-arabic">
      {/* ── الشريط العلوي ── */}
      <header className="bg-white border-b border-[#D1C4B9] px-4 py-4 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors text-[#6D6E71]">
          <ChevronRight size={24} />
        </button>
        <h1 className="text-lg font-bold text-[#2D2926]">الملف الشخصي</h1>
        <div className="w-10"></div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        
        {/* ── كارت الهوية الأساسي ── */}
        <div 
          className="rounded-[2.5rem] p-8 mb-8 text-center shadow-lg relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)' }}
        >
          <div className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, #A98159 0, #A98159 1px, transparent 0, transparent 50%)', backgroundSize: '15px 15px' }} />

          <div className="relative z-10 w-24 h-24 bg-white/10 rounded-full mx-auto mb-4 border-2 border-[#A98159]/30 flex items-center justify-center">
            <User size={48} className="text-[#A98159]" strokeWidth={1.5} />
          </div>

          <h2 className="relative z-10 text-2xl font-bold text-white mb-2">
            {profile?.nameAr || profile?.name || 'مراقب ميداني'}
          </h2>
          
          <div className="relative z-10 inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#A98159]/20 rounded-full border border-[#A98159]/20">
            <Briefcase size={14} className="text-[#A98159]" />
            <span className="text-[#A98159] text-xs font-bold uppercase tracking-wider">
              {role === 'admin' ? 'مدير النظام' : 'مراقب ميداني - ١٤٤٧ هـ'}
            </span>
          </div>
        </div>

        {/* ── تفاصيل البيانات ── */}
        <div className="bg-white rounded-3xl border border-[#D1C4B9] shadow-sm overflow-hidden mb-8">
          <div className="p-4 border-b border-[#D1C4B9] bg-gray-50/50">
            <p className="text-xs font-bold text-[#6D6E71] tracking-widest uppercase">بيانات الارتباط</p>
          </div>
          
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#FDF8F0] flex items-center justify-center text-[#A98159]">
                <MapPin size={22} />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] text-[#6D6E71] font-bold">المركز الحالي</p>
                <p className="text-base font-bold text-[#2D2926]">{profile?.center || 'غير محدد'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#FDF8F0] flex items-center justify-center text-[#A98159]">
                <Mail size={22} />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] text-[#6D6E71] font-bold">البريد الإلكتروني</p>
                <p className="text-sm font-bold text-[#2D2926] truncate">{profile?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── إجراءات الحساب ── */}
        <div className="space-y-4">
          <button 
            onClick={handleSignOut}
            className="w-full bg-red-50 text-red-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-all border border-red-100 shadow-sm active:scale-[0.98]"
          >
            <LogOut size={20} />
            تسجيل الخروج من النظام
          </button>

          <div className="text-center pt-2">
            <span className="text-[9px] font-black text-[#A98159] bg-[#FDF8F0] px-4 py-1.5 rounded-full border border-[#A98159]/10 uppercase tracking-tighter">
              إصدار المنظومة 1.0.0 — ١٤٤٧ هـ
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}