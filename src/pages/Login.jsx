import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/db.js';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/logo.png';

const GoldOrnament = () => (
  <svg width="120" height="8" viewBox="0 0 120 8" fill="none" className="mx-auto">
    <line x1="0" y1="4" x2="42" y2="4" stroke="#A98159" strokeWidth="0.75" />
    <circle cx="52" cy="4" r="1.5" fill="#A98159" opacity="0.6" />
    <circle cx="60" cy="4" r="3" fill="#A98159" />
    <circle cx="68" cy="4" r="1.5" fill="#A98159" opacity="0.6" />
    <line x1="78" y1="4" x2="120" y2="4" stroke="#A98159" strokeWidth="0.75" />
  </svg>
);

export default function Login() {
  const navigate          = useNavigate();
  const { role, loading } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  /* Redirect already-authed users */
  useEffect(() => {
    if (!loading && role === 'admin')    navigate('/admin/dashboard', { replace: true });
    if (!loading && role === 'observer') navigate('/home', { replace: true });
  }, [role, loading]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('يرجى تعبئة جميع الحقول'); return; }
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in AuthContext will update role → App.jsx redirects omar
    } catch (err) {
      const map = {
        'auth/user-not-found':  'البريد الإلكتروني غير مسجّل',
        'auth/wrong-password':  'كلمة المرور غير صحيحة',
        'auth/invalid-email':   'صيغة البريد الإلكتروني غير صحيحة',
        'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
        'auth/too-many-requests': 'تم تجاوز عدد المحاولات، حاول لاحقاً',
      };
      setError(map[err.code] || 'حدث خطأ، حاول مجدداً');
    }
    setBusy(false);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 font-arabic relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #F5EDE0 0%, #FDFCFB 65%)', fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif" }}
    >
      <div className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full bg-[#A98159]/5 pointer-events-none" />
      <div className="absolute bottom-[-60px] left-[-60px] w-56 h-56 rounded-full bg-[#A98159]/5 pointer-events-none" />

      {/* Brand */}
      <div className="mb-8 text-center" style={{ animation: 'fadeUp 0.5s ease forwards' }}>
        <img src={logo} alt="شعار" className="w-36 h-36 mx-auto mb-4 object-contain drop-shadow-lg" />
        <h1 className="text-2xl font-bold text-[#2D2926]">ضيوف البيت</h1>
        <p className="text-[#6D6E71] text-sm mt-1">منظومة المراقبة الميدانية — موسم ١٤٤٧ هـ</p>
        <div className="mt-3"><GoldOrnament /></div>
      </div>

      {/* Card */}
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white rounded-2xl shadow-[0_8px_32px_rgba(45,41,38,0.12)] border border-[#D1C4B9] overflow-hidden"
        style={{ animation: 'fadeUp 0.6s ease 0.1s both' }}
      >
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#C4A46E,#A98159,#8B6840)' }} />

        <div className="px-7 py-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-[#2D2926]">تسجيل الدخول</h2>
            <p className="text-[#6D6E71] text-sm mt-1">أدخل بيانات حسابك للمتابعة</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#2D2926] mb-1.5">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="example@moraqeb.sa"
              className="w-full px-4 py-3 border-2 border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] placeholder-[#6D6E71]/50 focus:border-[#A98159] focus:ring-2 focus:ring-[#A98159]/20 outline-none transition-all"
              dir="ltr"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#2D2926] mb-1.5">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              className="w-full px-4 py-3 border-2 border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] placeholder-[#6D6E71]/50 focus:border-[#A98159] focus:ring-2 focus:ring-[#A98159]/20 outline-none transition-all"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-[#BA1A1A] text-sm text-center bg-red-50 border border-red-100 rounded-xl py-2 px-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159,#8B6840)', boxShadow: '0 4px 24px rgba(169,129,89,0.3)' }}
          >
            {busy ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جارٍ التحقق...</>
            ) : 'دخول'}
          </button>
        </div>
      </form>

      <p className="mt-8 text-xs text-[#6D6E71]/60 text-center">© ١٤٤٧ هـ — ضيوف البيت لخدمات الحج والعمرة</p>

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
