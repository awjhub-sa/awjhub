import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../config/db.js';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/logo.png';

/* ── الزخرفة الذهبية العلويّة ── */
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
  const navigate = useNavigate();
  const { role, loading } = useAuth();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [selectedType, setSelectedType] = useState('observer');
  const [error,        setError]        = useState('');
  const [busy,         setBusy]         = useState(false);

  /* ── Admin login modal ── */
  const [adminModal,    setAdminModal]    = useState(false);
  const [adminEmail,    setAdminEmail]    = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError,    setAdminError]    = useState('');
  const [adminBusy,     setAdminBusy]     = useState(false);

  /* loginFlow tracks which login path triggered auth: 'observer' | 'supervisor' | 'admin' | null */
  const loginFlow = useRef(null);

  /* ── Role-aware redirect ── */
  useEffect(() => {
    if (!loading && role) {
      const flow = loginFlow.current;

      /* Role mismatch — sign out and show error */
      if (flow === 'observer' && role !== 'observer') {
        signOut(auth);
        setBusy(false);
        setError('هذا الحساب غير مسجّل كمراقب ميداني');
        loginFlow.current = null;
        return;
      }
      if (flow === 'supervisor' && role !== 'supervisor') {
        signOut(auth);
        setBusy(false);
        setError('هذا الحساب غير مسجّل كمشرف ميداني');
        loginFlow.current = null;
        return;
      }
      if (flow === 'admin' && role !== 'admin') {
        signOut(auth);
        setAdminBusy(false);
        setAdminError('هذا الحساب غير مسجّل كمسؤول إداري');
        loginFlow.current = null;
        return;
      }

      loginFlow.current = null;
      if (role === 'admin') navigate('/admin/dashboard', { replace: true });
      else if (role === 'supervisor') navigate('/supervisor-home', { replace: true });
      else if (role === 'observer') navigate('/home', { replace: true });
      setBusy(false);
    }
  }, [role, loading, navigate]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) { setAdminError('يرجى تعبئة جميع الحقول'); return; }
    setAdminBusy(true);
    setAdminError('');
    loginFlow.current = 'admin';
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    } catch (err) {
      loginFlow.current = null;
      setAdminBusy(false);
      const map = {
        'auth/user-not-found':    'البريد الإلكتروني غير مسجّل',
        'auth/wrong-password':    'كلمة المرور غير صحيحة',
        'auth/invalid-email':     'صيغة البريد الإلكتروني غير صحيحة',
        'auth/invalid-credential':'بيانات الدخول غير صحيحة',
        'auth/too-many-requests': 'تم تجاوز عدد المحاولات، حاول لاحقاً',
      };
      setAdminError(map[err.code] || 'حدث خطأ غير متوقع');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('يرجى تعبئة جميع الحقول'); return; }
    setBusy(true);
    setError('');
    loginFlow.current = selectedType; // 'observer' or 'supervisor'
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      loginFlow.current = null;
      setBusy(false);
      const map = {
        'auth/user-not-found':    'البريد الإلكتروني غير مسجّل',
        'auth/wrong-password':    'كلمة المرور غير صحيحة',
        'auth/invalid-email':     'صيغة البريد الإلكتروني غير صحيحة',
        'auth/invalid-credential':'بيانات الدخول غير صحيحة أو نوع الحساب خاطئ',
        'auth/too-many-requests': 'تم تجاوز عدد المحاولات، حاول لاحقاً بعد دقائق',
      };
      setError(map[err.code] || 'حدث خطأ غير متوقع، يرجى المحاولة ثانية');
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 font-arabic relative overflow-hidden"
      style={{ 
        background: 'radial-gradient(ellipse at 30% 20%, #F5EDE0 0%, #FDFCFB 65%)', 
        fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif" 
      }}
    >
      {/* عناصر زخرفية في الخلفية */}
      <div className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full bg-[#A98159]/5 pointer-events-none" />
      <div className="absolute bottom-[-60px] left-[-60px] w-56 h-56 rounded-full bg-[#A98159]/5 pointer-events-none" />

      {/* الشعار والهوية */}
      <div className="mb-8 text-center" style={{ animation: 'fadeUp 0.5s ease forwards' }}>
        <img src={logo} alt="شعار ضيوف البيت" className="w-36 h-36 mx-auto mb-4 object-contain drop-shadow-lg" />
        <h1 className="text-2xl font-bold text-[#2D2926]">ضيوف البيت</h1>
        <p className="text-[#6D6E71] text-sm mt-1">منظومة المراقبة الميدانية — موسم ١٤٤٧ هـ</p>
        <div className="mt-3"><GoldOrnament /></div>
      </div>

      {/* بطاقة تسجيل الدخول */}
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

          {/* أزرار اختيار نوع الدخول (مراقب / مشرف) */}
          <div className="flex bg-[#F5EDE0] p-1 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => { setSelectedType('observer'); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                selectedType === 'observer'
                  ? 'bg-white text-[#A98159] shadow-sm'
                  : 'text-[#6D6E71] hover:text-[#2D2926]'
              }`}
            >
              مراقب ميداني
            </button>
            <button
              type="button"
              onClick={() => { setSelectedType('supervisor'); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                selectedType === 'supervisor'
                  ? 'bg-white text-[#A98159] shadow-sm'
                  : 'text-[#6D6E71] hover:text-[#2D2926]'
              }`}
            >
              مشرف ميداني
            </button>
          </div>

          {/* حقل البريد الإلكتروني */}
          <div>
            <label className="block text-sm font-medium text-[#2D2926] mb-1.5">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="example@domain.sa"
              className="w-full px-4 py-3 border-2 border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] placeholder-[#6D6E71]/30 focus:border-[#A98159] focus:ring-2 focus:ring-[#A98159]/20 outline-none transition-all"
              dir="ltr"
            />
          </div>

          {/* حقل كلمة المرور */}
          <div>
            <label className="block text-sm font-medium text-[#2D2926] mb-1.5">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              className="w-full px-4 py-3 border-2 border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] placeholder-[#6D6E71]/30 focus:border-[#A98159] focus:ring-2 focus:ring-[#A98159]/20 outline-none transition-all"
              dir="ltr"
            />
          </div>

          {error && (
            <p className="text-[#BA1A1A] text-sm text-center bg-red-50 border border-red-100 rounded-xl py-2 px-3 animate-shake">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3"
            style={{ 
              background: 'linear-gradient(135deg,#C4A46E,#A98159,#8B6840)', 
              boxShadow: '0 4px 20px rgba(169,129,89,0.25)' 
            }}
          >
            {busy ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>جارٍ التحقق...</span>
              </>
            ) : 'دخول الآمن'}
          </button>
        </div>
      </form>

      <p className="mt-8 text-xs text-[#6D6E71]/60 text-center">© ١٤٤٧ هـ — ضيوف البيت لخدمات الحج والعمرة</p>

      <button
        type="button"
        onClick={() => { setAdminModal(true); setAdminError(''); setAdminEmail(''); setAdminPassword(''); }}
        className="mt-4 text-xs text-[#6D6E71]/40 hover:text-[#6D6E71]/70 transition-colors"
      >
        دخول الإدارة
      </button>

      {/* Admin Login Modal */}
      {adminModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,41,38,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setAdminModal(false); }}
        >
          <form
            onSubmit={handleAdminLogin}
            className="w-full max-w-sm bg-white rounded-2xl shadow-[0_16px_48px_rgba(45,41,38,0.2)] border border-[#D1C4B9] overflow-hidden"
            style={{ animation: 'fadeUp 0.25s ease forwards' }}
          >
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#4B4B4B,#2D2926)' }} />
            <div className="px-7 py-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#2D2926]">دخول الإدارة</h2>
                  <p className="text-[#6D6E71] text-xs mt-0.5">للمسؤولين المخوّلين فقط</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminModal(false)}
                  className="w-8 h-8 rounded-xl border border-[#D1C4B9] flex items-center justify-center text-[#6D6E71] hover:bg-[#F5EDE0] transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2D2926] mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => { setAdminEmail(e.target.value); setAdminError(''); }}
                  placeholder="admin@domain.sa"
                  className="w-full px-4 py-3 border-2 border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] placeholder-[#6D6E71]/30 focus:border-[#2D2926] focus:ring-2 focus:ring-[#2D2926]/10 outline-none transition-all"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2D2926] mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => { setAdminPassword(e.target.value); setAdminError(''); }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border-2 border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] placeholder-[#6D6E71]/30 focus:border-[#2D2926] focus:ring-2 focus:ring-[#2D2926]/10 outline-none transition-all"
                  dir="ltr"
                />
              </div>

              {adminError && (
                <p className="text-[#BA1A1A] text-sm text-center bg-red-50 border border-red-100 rounded-xl py-2 px-3 animate-shake">
                  {adminError}
                </p>
              )}

              <button
                type="submit"
                disabled={adminBusy}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3"
                style={{ background: 'linear-gradient(135deg,#4B4B4B,#2D2926)' }}
              >
                {adminBusy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جارٍ التحقق...</span>
                  </>
                ) : 'دخول'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* تأثيرات CSS للحركة */}
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-3px); }
          40%, 80% { transform: translateX(3px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}