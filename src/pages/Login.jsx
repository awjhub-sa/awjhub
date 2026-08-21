/**
 * src/pages/Login.jsx
 *
 * Two doors, and nothing else on the page.
 *
 * The field roles used to sign in here with a national ID; they moved to the
 * mobile app, and the entrances that remain both authenticate the same way —
 * an email and a password against Supabase Auth. What differs is which kind of
 * account is allowed through, and that check happens after the credentials are
 * accepted, never before: signing a caterer into the admin console would be a
 * far worse failure than refusing a valid login.
 *
 * The screen is split. Identity sits on the right, where Arabic begins; the
 * form on the left, where the eye settles to act. The navy half moves — slowly
 * — and the white half does not, because a field that drifts while you type
 * into it is a field you mistype.
 *
 * Choosing a door changes the accent of the whole card. That is not decoration:
 * on a page with two entrances that take the same two fields, the colour is the
 * only thing telling you which one you are about to walk through.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  ShieldCheck, Storefront, EnvelopeSimple, LockKey, Eye, EyeSlash,
  ArrowLeft, CircleNotch, WarningCircle, DeviceMobile,
} from '@phosphor-icons/react';
import { BRAND } from '../config/brand.js';
import './login.css';

/* The two entrances. `roles` is the guard: what this door is allowed to open
   for, checked against the account the credentials actually belong to. */
const DOORS = {
  admin: {
    label:  'الإدارة',
    Icon:   ShieldCheck,
    accent: 'rgb(var(--c-primary))',
    title:  'دخول الإدارة',
    hint:   'لوحة تشغيل الموسم والمتابعة الميدانية',
    roles:  ['admin', 'staff'],
    reject: 'هذا الحساب غير مسجّل كمسؤول إداري',
    home:   '/admin/dashboard',
  },
  caterer: {
    label:  'المتعهد',
    Icon:   Storefront,
    accent: 'rgb(var(--c-accent-600))',
    title:  'دخول المتعهد',
    hint:   'بلاغات مراكزك والنماذج المطلوبة منك',
    roles:  ['caterer'],
    reject: 'هذا الحساب غير مسجّل كمتعهد',
    home:   '/caterer/home',
  },
};

export default function Login() {
  const navigate = useNavigate();
  const { role, loading, loginAsAdmin, logout } = useAuth();

  const [door,     setDoor]     = useState('admin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [reveal,   setReveal]   = useState(false);
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  /* Set while a sign-in is in flight, so the effect below can tell an arrival
     it caused from a session that was already open when the page loaded. */
  const attempt = useRef(null);

  const d = DOORS[door];

  useEffect(() => {
    if (loading || !role) return;

    const asked = attempt.current;
    if (asked) {
      attempt.current = null;
      if (!DOORS[asked].roles.includes(role)) {
        /* Right password, wrong kind of account. Out again, and say which. */
        logout();
        setBusy(false);
        setError(DOORS[asked].reject);
        return;
      }
    }

    setBusy(false);
    if (role === 'admin' || role === 'staff') navigate('/admin/dashboard', { replace: true });
    else if (role === 'caterer')              navigate('/caterer/home',    { replace: true });
    else if (role === 'supervisor')           navigate('/supervisor-home', { replace: true });
    else if (role === 'observer')             navigate('/home',            { replace: true });
  }, [role, loading, navigate, logout]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('أدخل البريد وكلمة المرور'); return; }
    setBusy(true);
    setError('');
    attempt.current = door;
    try {
      await loginAsAdmin(email.trim(), password);
      /* The role arrives through context; the effect above decides. */
    } catch (err) {
      attempt.current = null;
      setBusy(false);
      setError(err.message || 'تعذّر تسجيل الدخول');
    }
  };

  const pick = (next) => {
    if (next === door) return;
    setDoor(next);
    setError('');
  };

  return (
    <div
      className="lg-page"
      dir="rtl"
      style={{ '--lg-accent': d.accent }}
    >

      {/* ── identity ─────────────────────────────────────── */}
      <aside className="lg-brand">
        <span aria-hidden className="lg-aurora lg-aurora-1" />
        <span aria-hidden className="lg-aurora lg-aurora-2" />
        <span aria-hidden className="lg-aurora lg-aurora-3" />
        <span aria-hidden className="lg-grid" />
        <span aria-hidden className="lg-seam" />

        <div className="relative max-w-lg mx-auto lg:mx-0 text-center lg:text-right">
          {/* Lockup, name, line. One block, sized so it reads as the masthead
              of the system rather than a logo with captions under it. */}
          <div className="lg-rise" style={{ animationDelay: '.05s' }}>
            <img
              src={BRAND.logo.fullOnDark}
              alt={BRAND.companyFullAr}
              className="w-[400px] max-w-[82vw] h-auto mx-auto lg:mx-0"
            />
          </div>

          <div className="lg-rise mt-8 flex items-center gap-3 justify-center lg:justify-start"
            style={{ animationDelay: '.12s' }}>
            <span className="h-px w-10 bg-accent/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="h-px flex-1 max-w-[9rem] bg-gradient-to-l from-accent/50 to-transparent" />
          </div>

          <h2 className="lg-rise mt-6 text-[30px] lg:text-[42px] font-extrabold text-white leading-[1.35] tracking-tight"
            style={{ animationDelay: '.18s' }}>
            منظومة إدارة الإعاشة
            <span className="block text-accent">في المشاعر المقدّسة</span>
          </h2>

          <p className="lg-rise mt-5 text-[15px] lg:text-[17px] font-bold text-white/60 leading-[2.1] max-w-lg mx-auto lg:mx-0"
            style={{ animationDelay: '.26s' }}>
            من تجهيز الوجبة إلى تسليمها، ومن بلاغ المراقب إلى قرار الإدارة —
            في مكان واحد، ولحظة بلحظة.
          </p>
        </div>
      </aside>

      {/* ── the form ─────────────────────────────────────── */}
      <main className="lg-form">
        <span aria-hidden className="lg-warm" style={{ opacity: door === 'caterer' ? 1 : 0 }} />
        <span aria-hidden className="lg-orb lg-orb-1" />
        <span aria-hidden className="lg-orb lg-orb-2" />
        <span aria-hidden className="lg-orb lg-orb-3" />
        <span aria-hidden className="lg-orb lg-orb-4" />
        <form onSubmit={submit} className="lg-card lg-rise" style={{ animationDelay: '.12s' }}>

          <div className="text-center mb-6">
            <span
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 transition-colors duration-300"
              style={{ background: `color-mix(in srgb, ${d.accent} 12%, #fff)` }}
            >
              <d.Icon size={26} weight="duotone" style={{ color: d.accent }} />
            </span>
            <h1 className="text-[21px] font-bold text-ink">{d.title}</h1>
            <p className="text-[12.5px] font-bold text-muted mt-1">{d.hint}</p>
          </div>

          {/* which door */}
          <div className="lg-seg mb-5" role="tablist">
            <span
              aria-hidden
              className="lg-seg-pill"
              style={{ transform: door === 'admin' ? 'translateX(0)' : 'translateX(-100%)' }}
            />
            {Object.entries(DOORS).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={door === key}
                data-on={door === key}
                onClick={() => pick(key)}
                className="lg-seg-btn"
              >
                <meta.Icon size={15} weight={door === key ? 'fill' : 'regular'} />
                {meta.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="lg-field">
              <EnvelopeSimple size={17} weight="bold" className="lg-input-icon" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="البريد الإلكتروني"
                autoComplete="username"
                dir="ltr"
                className="lg-input text-left"
              />
            </div>

            <div className="lg-field">
              <LockKey size={17} weight="bold" className="lg-input-icon" />
              <input
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                autoComplete="current-password"
                dir="ltr"
                className="lg-input text-left"
              />
              <button
                type="button"
                onClick={() => setReveal(v => !v)}
                className="lg-eye"
                aria-label={reveal ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {reveal ? <EyeSlash size={17} weight="bold" /> : <Eye size={17} weight="bold" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 border border-red-200 bg-red-50">
              <WarningCircle size={16} weight="fill" className="text-red-500 flex-shrink-0 mt-px" />
              <p className="text-[12.5px] font-bold text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          <button type="submit" disabled={busy} className="lg-submit mt-5">
            {busy
              ? <CircleNotch size={19} weight="bold" className="lg-spin" />
              : <>
                  دخول {d.label}
                  <ArrowLeft size={17} weight="bold" />
                </>}
          </button>

          {/* The field team is not turned away without being told where to go. */}
          <div className="mt-5 pt-4 border-t border-line flex items-start gap-2.5">
            <DeviceMobile size={16} weight="duotone" className="text-muted flex-shrink-0 mt-0.5" />
            <p className="text-[11.5px] font-bold text-muted leading-relaxed">
              المراقبون والمشرفون يدخلون من تطبيق الجوال
            </p>
          </div>

          <p className="mt-5 text-center text-[10.5px] font-bold text-muted/60">
            © {new Date().getFullYear()} {BRAND.companyFullAr}
          </p>
        </form>
      </main>
    </div>
  );
}
