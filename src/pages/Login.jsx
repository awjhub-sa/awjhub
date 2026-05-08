// src/pages/Login.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Decorative geometric ornament ─────────────────────── */
const GoldOrnament = () => (
  <svg width="120" height="8" viewBox="0 0 120 8" fill="none" className="mx-auto">
    <line x1="0" y1="4" x2="42" y2="4" stroke="#A98159" strokeWidth="0.75" />
    <circle cx="52" cy="4" r="1.5" fill="#A98159" opacity="0.6" />
    <circle cx="60" cy="4" r="3"   fill="#A98159" />
    <circle cx="68" cy="4" r="1.5" fill="#A98159" opacity="0.6" />
    <line x1="78" y1="4" x2="120" y2="4" stroke="#A98159" strokeWidth="0.75" />
  </svg>
);

/* ── OTP single-digit box ───────────────────────────────── */
const OtpBox = ({ id, prevId, nextId, inputRef }) => {
  const handleInput = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val.slice(-1);
    if (val && nextId) document.getElementById(nextId)?.focus();
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && !e.target.value && prevId)
      document.getElementById(prevId)?.focus();
  };
  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      maxLength={1}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      className="
        w-14 h-16 text-center text-2xl font-bold
        bg-background border-2 border-appBorder rounded-xl
        text-dark caret-primary
        focus:border-primary focus:ring-2 focus:ring-primary/20
        focus:outline-none transition-all duration-200
        shadow-sm
      "
    />
  );
};

/* ══════════════════════════════════════════════════════════
   LOGIN PAGE
   ══════════════════════════════════════════════════════════ */
export default function Login() {
  const navigate = useNavigate();
  const [step,    setStep]    = useState('id');   // 'id' | 'otp'
  const [idVal,   setIdVal]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const firstOtpRef = useRef(null);

  useEffect(() => {
    if (step === 'otp') setTimeout(() => firstOtpRef.current?.focus(), 150);
  }, [step]);

  const handleSendOtp = () => {
    if (idVal.length !== 10) { setError('يرجى إدخال رقم هوية مكوّن من 10 أرقام'); return; }
    setError('');
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep('otp'); }, 1200);
  };

  const handleVerifyOtp = () => {
    const otp = ['otp1','otp2','otp3','otp4']
      .map(id => document.getElementById(id)?.value ?? '')
      .join('');
    if (otp.length < 4) { setError('يرجى إدخال الرمز كاملاً'); return; }
    setError('');
    setLoading(true);
    setTimeout(() => { setLoading(false); navigate('/home'); }, 1400);
  };

  const maskedId = idVal.length >= 4
    ? idVal.slice(0, 3) + '****' + idVal.slice(-3)
    : idVal;

  return (
    <div
      dir="rtl"
      className="
        min-h-screen bg-cream-texture flex flex-col items-center justify-center
        px-4 py-10 font-arabic relative overflow-hidden
      "
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #F5EDE0 0%, #FDFCFB 65%)' }}
    >
      {/* Background decorative circles */}
      <div className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full bg-primary/5 pointer-events-none" />
      <div className="absolute bottom-[-60px] left-[-60px] w-56 h-56 rounded-full bg-primary/5 pointer-events-none" />

      {/* ── Brand header ── */}
      <div className="mb-8 text-center animate-fade-in" style={{ animation: 'fadeSlideUp 0.5s ease forwards' }}>
        {/* Logo circle */}
        <div className="
          w-24 h-24 rounded-3xl bg-gold-gradient mx-auto mb-4
          flex items-center justify-center shadow-gold-lg
        ">
          <span className="text-4xl font-bold text-white" style={{ fontFamily: 'serif', letterSpacing: '-1px' }}>ض</span>
        </div>
        <h1 className="text-2xl font-bold text-dark tracking-wide">ضيوف البيت</h1>
        <p className="text-secondary text-sm mt-1">نظام مراقبة الخدمات الميدانية</p>
        <div className="mt-3"><GoldOrnament /></div>
      </div>

      {/* ── Card ── */}
      <div
        className="w-full max-w-sm bg-background rounded-2xl shadow-card-lg border border-appBorder overflow-hidden"
        style={{ animation: 'fadeSlideUp 0.6s ease 0.1s both' }}
      >
        {/* Card top accent */}
        <div className="h-1 w-full bg-gold-gradient" />

        <div className="px-7 py-8">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${step === 'id' ? 'bg-primary text-white' : 'bg-success text-white'}`}>
              {step === 'id' ? '١' : '✓'}
            </div>
            <div className={`flex-1 h-0.5 ${step === 'otp' ? 'bg-primary' : 'bg-appBorder'} transition-all`} />
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${step === 'otp' ? 'bg-primary text-white' : 'bg-appBorder text-secondary'}`}>
              ٢
            </div>
          </div>

          {/* ── Step 1: National ID ── */}
          {step === 'id' && (
            <div style={{ animation: 'fadeSlideUp 0.35s ease forwards' }}>
              <h2 className="text-xl font-bold text-dark mb-1">تسجيل الدخول</h2>
              <p className="text-secondary text-sm mb-6">أدخل رقم هويتك الوطنية للمتابعة</p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-dark mb-2">
                  رقم الهوية الوطنية
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={idVal}
                  onChange={e => { setIdVal(e.target.value.replace(/\D/g,'')); setError(''); }}
                  placeholder="١٠ أرقام"
                  className="
                    w-full h-13 px-4 py-3.5 text-base text-center tracking-[0.2em]
                    bg-background border-2 border-appBorder rounded-xl
                    text-dark placeholder-secondary/50
                    focus:border-primary focus:ring-2 focus:ring-primary/20
                    focus:outline-none transition-all duration-200
                  "
                />
                <div className="flex justify-between mt-1.5 px-1">
                  <span className="text-xs text-secondary">مثال: 1023456789</span>
                  <span className={`text-xs font-medium ${idVal.length === 10 ? 'text-success' : 'text-secondary'}`}>
                    {idVal.length}/10
                  </span>
                </div>
              </div>

              {error && (
                <p className="text-error text-sm mb-3 text-center bg-error/5 border border-error/20 rounded-lg py-2 px-3">
                  {error}
                </p>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="
                  w-full py-4 rounded-xl font-bold text-white text-base
                  bg-gold-gradient shadow-gold
                  hover:opacity-90 active:scale-[0.98]
                  transition-all duration-200 disabled:opacity-60
                  flex items-center justify-center gap-2
                "
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جارٍ الإرسال...</span>
                  </>
                ) : (
                  <>
                    <span>إرسال رمز التحقق</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="rotate-180"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <div style={{ animation: 'fadeSlideUp 0.35s ease forwards' }}>
              <h2 className="text-xl font-bold text-dark mb-1">رمز التحقق</h2>
              <p className="text-secondary text-sm mb-1">
                تم الإرسال إلى الجوال المرتبط بـ
              </p>
              <p className="text-primary font-bold text-sm mb-6 dir-ltr text-right">{maskedId}</p>

              {/* OTP boxes — LTR order but RTL page */}
              <div className="flex justify-center gap-3 mb-5 flex-row-reverse" dir="ltr">
                <OtpBox id="otp1" nextId="otp2" inputRef={firstOtpRef} />
                <OtpBox id="otp2" prevId="otp1" nextId="otp3" />
                <OtpBox id="otp3" prevId="otp2" nextId="otp4" />
                <OtpBox id="otp4" prevId="otp3" />
              </div>

              {/* Demo hint */}
              <div className="text-center mb-4 text-xs text-secondary bg-primary-50 rounded-lg py-2 px-3 border border-primary-100">
                للتجربة: أدخل أي 4 أرقام
              </div>

              {error && (
                <p className="text-error text-sm mb-3 text-center bg-error/5 border border-error/20 rounded-lg py-2 px-3">
                  {error}
                </p>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="
                  w-full py-4 rounded-xl font-bold text-white text-base
                  bg-gold-gradient shadow-gold
                  hover:opacity-90 active:scale-[0.98]
                  transition-all duration-200 disabled:opacity-60
                  flex items-center justify-center gap-2
                "
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جارٍ التحقق...</span>
                  </>
                ) : 'دخول'}
              </button>

              <div className="flex items-center justify-between mt-5">
                <button
                  onClick={() => { setStep('id'); setError(''); }}
                  className="text-sm text-secondary hover:text-primary transition-colors"
                >
                  ← تغيير الرقم
                </button>
                <button className="text-sm text-primary font-medium hover:opacity-75 transition-opacity">
                  إعادة الإرسال
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-secondary/60 text-center">
        © ١٤٤٦ هـ — ضيوف البيت لخدمات الحج والعمرة
      </p>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .font-arabic { font-family: 'IBM Plex Sans Arabic', 'Noto Kufi Arabic', Tahoma, sans-serif; }
        .h-13 { height: 3.25rem; }
      `}</style>
    </div>
  );
}
