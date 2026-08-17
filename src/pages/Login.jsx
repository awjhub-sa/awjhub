import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Fingerprint,
} from '@phosphor-icons/react';
import { BRAND } from '../config/brand.js';


const GoldOrnament = () => (
  <svg width="120" height="8" viewBox="0 0 120 8" fill="none" className="mx-auto">
    <line x1="0" y1="4" x2="42" y2="4" stroke="rgb(var(--c-primary))" strokeWidth="0.75" />
    <circle cx="52" cy="4" r="1.5" fill="rgb(var(--c-primary))" opacity="0.6" />
    <circle cx="60" cy="4" r="3" fill="rgb(var(--c-primary))" />
    <circle cx="68" cy="4" r="1.5" fill="rgb(var(--c-primary))" opacity="0.6" />
    <line x1="78" y1="4" x2="120" y2="4" stroke="rgb(var(--c-primary))" strokeWidth="0.75" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const { role, loading, loginAsMonitor, loginAsAdmin, logout } = useAuth();

  const [idNumber,     setIdNumber]     = useState('');
  const [selectedType, setSelectedType] = useState('observer');
  const [error,        setError]        = useState('');
  const [busy,         setBusy]         = useState(false);

  
  const [adminModal,    setAdminModal]    = useState(false);
  const [adminEmail,    setAdminEmail]    = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError,    setAdminError]    = useState('');
  const [adminBusy,     setAdminBusy]     = useState(false);

  /* loginFlow tracks the admin path — observer/supervisor are resolved synchronously */
  const loginFlow = useRef(null);

  
  useEffect(() => {
    if (loading || !role) return;
    const flow = loginFlow.current;

    /* Admin path: role mismatch */
    if (flow === 'admin' && role !== 'admin' && role !== 'staff') {
      logout();
      setAdminBusy(false);
      setAdminError('هذا الحساب غير مسجّل كمسؤول إداري');
      loginFlow.current = null;
      return;
    }

    loginFlow.current = null;
    if (role === 'admin' || role === 'staff') navigate('/admin/dashboard',  { replace: true });
    else if (role === 'supervisor')           navigate('/supervisor-home',  { replace: true });
    else if (role === 'observer')             navigate('/home',             { replace: true });
    setBusy(false);
    setAdminBusy(false);
  }, [role, loading, navigate]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) { setAdminError('يرجى تعبئة جميع الحقول'); return; }
    setAdminBusy(true);
    setAdminError('');
    loginFlow.current = 'admin';
    try {
      await loginAsAdmin(adminEmail, adminPassword);
    } catch (err) {
      loginFlow.current = null;
      setAdminBusy(false);
      setAdminError(err.message || 'حدث خطأ غير متوقع');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const id = idNumber.trim();
    if (!id)             { setError('أدخل رقم الهوية'); return; }
    if (id.length !== 10){ setError('رقم الهوية يجب أن يكون 10 أرقام'); return; }

    setBusy(true);
    try {
      await loginAsMonitor(id, selectedType);
      /* AuthContext sets role → the useEffect above will redirect */
    } catch (err) {
      setBusy(false);
      setError(err.message || 'تعذّر التحقق، حاول مرة أخرى');
    }
  };

  const numOnly = (v) => v.replace(/\D/g, '');

  const idProgress = Math.min(idNumber.length / 10, 1);

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 font-arabic relative overflow-hidden bg-background"
      style={{ fontFamily: "'Cairo', Tahoma, sans-serif" }}
    >
      {/* Mesh gradient — drifting warm blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />
        <div className="mesh-blob mesh-blob-4" />
      </div>

      {/* الشعار والهوية */}
      <div className="mb-8 text-center" style={{ animation: 'fadeUp 0.5s ease forwards' }}>
        {/* The lockup already carries the name and tagline, so the separate
            heading underneath it would just repeat them. 340px keeps the
            wordmark at the height 280 gave the older, narrower lockup. */}
        <img
          src={BRAND.logo.full}
          alt={BRAND.companyName}
          className="w-[340px] max-w-[80vw] h-auto mx-auto"
        />
        <div className="mt-3"><GoldOrnament /></div>
      </div>

      {/* بطاقة تسجيل الدخول */}
      <form
        onSubmit={handleLogin}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden backdrop-blur-xl"
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.85), rgb(var(--c-bg) / 0.75))',
          border: '1px solid rgb(var(--c-line) / 0.6)',
          boxShadow: '0 20px 50px -12px rgb(var(--c-primary) / 0.25), 0 8px 24px -6px rgb(var(--c-ink) / 0.08)',
          animation: 'fadeUp 0.6s ease 0.1s both',
        }}
      >
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)),rgb(var(--c-primary-700)))' }} />

        <div className="px-7 py-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-ink">تسجيل الدخول</h2>
            <p className="text-muted text-sm mt-1">أدخل بيانات حسابك للمتابعة</p>
          </div>

          {/* أزرار اختيار نوع الدخول (مراقب / مشرف) */}
          <div className="flex bg-primary-50 p-1 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => { setSelectedType('observer'); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                selectedType === 'observer'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              مراقب ميداني
            </button>
            <button
              type="button"
              onClick={() => { setSelectedType('supervisor'); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                selectedType === 'supervisor'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              مشرف ميداني
            </button>
          </div>

          {/* حقل رقم الهوية */}
          <div>
            <label className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-ink">رقم الهوية</span>
              <span className="text-[11px] font-bold tabular-nums text-primary">
                {idNumber.length} / 10
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none">
                <Fingerprint size={19} className="text-primary" weight="regular" />
              </div>
              <input
                type="text"
                value={idNumber}
                onChange={e => {
                  const v = numOnly(e.target.value);
                  if (v.length <= 10) { setIdNumber(v); setError(''); }
                }}
                placeholder="1xxxxxxxxx"
                inputMode="numeric"
                maxLength={10}
                autoFocus
                className="w-full pr-11 pl-4 py-4 border-2 border-line rounded-2xl text-xl text-ink placeholder-muted/30 focus:border-primary focus:ring-4 focus:ring-primary/15 outline-none transition-all tabular-nums tracking-[0.2em] text-center font-bold bg-white/70"
                dir="ltr"
              />
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-primary-50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${idProgress * 100}%`,
                  background: idProgress === 1
                    ? 'linear-gradient(90deg, #16A34A, #15803D)'
                    : 'linear-gradient(90deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))',
                }}
              />
            </div>
            <p className="text-[10px] text-muted mt-2 text-center">
              أدخل رقم هويتك المسجل في النظام (10 أرقام)
            </p>
          </div>

          {error && (
            <p className="text-error text-sm text-center bg-red-50 border border-red-100 rounded-xl py-2 px-3 animate-shake">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3"
            style={{ 
              background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)),rgb(var(--c-primary-700)))', 
              boxShadow: '0 4px 20px rgb(var(--c-primary) / 0.25)' 
            }}
          >
            {busy ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>جارٍ التحقق...</span>
              </>
            ) : 'تسجيل الدخول'}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => { setAdminModal(true); setAdminError(''); setAdminEmail(''); setAdminPassword(''); }}
        /* Navy text on the accent, matching the report button — white would
           sit at ~1.7:1 against the accent. */
        className="mt-6 w-full max-w-sm py-3 rounded-xl font-bold text-sm text-primary transition-all hover:opacity-95 active:scale-[0.98] flex items-center justify-center gap-2"
        style={{
          background: 'rgb(var(--c-accent))',
          boxShadow: '0 4px 16px rgb(var(--c-accent) / 0.40)',
          animation: 'fadeUp 0.7s ease 0.2s both'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        دخول الإدارة
      </button>

      {/* Year comes from the clock rather than a literal, so the notice does
          not quietly go stale next January. */}
      <footer className="mt-6 text-center leading-relaxed" dir="rtl">
        <p className="text-[11px] font-semibold text-muted/80">
          © {new Date().getFullYear()} {BRAND.companyFullAr}
          <span className="mx-1.5 text-muted/40">·</span>
          <span dir="ltr">{BRAND.companyFullEn}</span>
        </p>
        <p className="text-[10px] text-muted/55 mt-0.5">جميع الحقوق محفوظة</p>
      </footer>

      {/* Admin Login Modal */}
      {adminModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgb(var(--c-ink) / 0.45)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setAdminModal(false); }}
        >
          <form
            onSubmit={handleAdminLogin}
            className="w-full max-w-sm bg-white rounded-2xl shadow-[0_16px_48px_rgb(var(--c-ink)/0.2)] border border-line overflow-hidden"
            style={{ animation: 'fadeUp 0.25s ease forwards' }}
          >
            <div className="h-1 w-full" style={{ background: 'rgb(var(--c-accent))' }} />
            <div className="px-7 py-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink">دخول الإدارة</h2>
                  <p className="text-muted text-xs mt-0.5">للمسؤولين المخوّلين فقط</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminModal(false)}
                  className="w-8 h-8 rounded-xl border border-line flex items-center justify-center text-muted hover:bg-primary-50 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => { setAdminEmail(e.target.value); setAdminError(''); }}
                  placeholder="admin@domain.sa"
                  className="w-full px-4 py-3 border-2 border-line rounded-xl text-sm text-ink placeholder-muted/30 focus:border-ink focus:ring-2 focus:ring-ink/10 outline-none transition-all"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => { setAdminPassword(e.target.value); setAdminError(''); }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border-2 border-line rounded-xl text-sm text-ink placeholder-muted/30 focus:border-ink focus:ring-2 focus:ring-ink/10 outline-none transition-all"
                  dir="ltr"
                />
              </div>

              {adminError && (
                <p className="text-error text-sm text-center bg-red-50 border border-red-100 rounded-xl py-2 px-3 animate-shake">
                  {adminError}
                </p>
              )}

              <button
                type="submit"
                disabled={adminBusy}
                className="w-full py-3.5 rounded-xl font-bold text-primary text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3"
                style={{ background: 'rgb(var(--c-accent))' }}
              >
                {adminBusy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
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

        .mesh-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.7;
          will-change: transform;
        }
        .mesh-blob-1 {
          width: 520px; height: 520px;
          top: -150px; right: -120px;
          background: radial-gradient(circle, rgb(var(--c-primary-200)) 0%, transparent 70%);
          animation: drift1 22s ease-in-out infinite;
        }
        .mesh-blob-2 {
          width: 460px; height: 460px;
          top: 30%; left: -140px;
          background: radial-gradient(circle, rgb(var(--c-primary-400)) 0%, transparent 70%);
          animation: drift2 28s ease-in-out infinite;
        }
        .mesh-blob-3 {
          width: 580px; height: 580px;
          bottom: -180px; right: 10%;
          background: radial-gradient(circle, rgb(var(--c-primary-100)) 0%, transparent 70%);
          animation: drift3 26s ease-in-out infinite;
        }
        .mesh-blob-4 {
          width: 380px; height: 380px;
          bottom: 20%; left: 30%;
          background: radial-gradient(circle, rgb(var(--c-primary-400)) 0%, transparent 70%);
          opacity: 0.45;
          animation: drift4 32s ease-in-out infinite;
        }
        @keyframes drift1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-40px, 60px) scale(1.1); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(50px, -40px) scale(0.95); }
        }
        @keyframes drift3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-30px, -50px) scale(1.05); }
        }
        @keyframes drift4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(40px, 40px) scale(1.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mesh-blob { animation: none; }
        }
      `}</style>
    </div>
  );
}