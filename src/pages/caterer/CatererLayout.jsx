/**
 * src/pages/caterer/CatererLayout.jsx
 *
 * The shell an outside company sees — the same system, fewer rooms.
 *
 * The first attempt was a narrow column with a tab bar, which read as a phone
 * app blown up on a desktop. A caterer opening this on an office machine is
 * doing office work: reading findings, filing forms. So it takes the shape the
 * rest of the system takes — a navy rail on the side, a masthead on each
 * section, tables on a light canvas — and simply has three destinations instead
 * of twenty-three.
 *
 * Everything under here is scoped to one caterer, resolved once from the
 * signed-in profile and handed down through the outlet. A screen that had to
 * work out whose data it was showing would eventually get it wrong.
 */

import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  House, Siren, FileText, SignOut, List, X, Buildings,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBrand } from '../../context/BrandContext.jsx';
import { db } from '../../lib/db.js';

const NAV = [
  { to: '/caterer/home',    label: 'الرئيسية', Icon: House },
  { to: '/caterer/reports', label: 'البلاغات', Icon: Siren },
  { to: '/caterer/forms',   label: 'النماذج',  Icon: FileText },
];

export default function CatererLayout() {
  const { profile, logout } = useAuth();
  const { brand } = useBrand();
  const nav = useNavigate();

  const [caterer, setCaterer] = useState(null);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);          // drawer, on narrow screens

  const catererId = profile?.catererId || null;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!catererId) { setLoading(false); return; }
      const [c, ce] = await Promise.all([
        db.caterers.get(catererId),
        db.centers.list({ filter: { catererId }, columns: [
          'id', 'code', 'facilityName', 'pilgrimsCount', 'pilgrimsNationality',
          'kitchenLocationMina', 'kitchenLocationArafat', 'active', 'catererName',
        ] }),
      ]);
      if (!alive) return;
      setCaterer(c); setCenters(ce); setLoading(false);
    })();
    return () => { alive = false; };
  }, [catererId]);

  const ctx = useMemo(
    () => ({ catererId, caterer, centers, loading }),
    [catererId, caterer, centers, loading],
  );

  const signOut = async () => { await logout(); nav('/login', { replace: true }); };

  /* An account with no caterer attached can see nothing, and must not be shown
     an empty portal as though it were working. */
  if (!loading && !catererId) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-2xl border border-line p-7 max-w-sm text-center">
          <p className="text-[16px] font-black text-ink">الحساب غير مرتبط بمنشأة</p>
          <p className="text-[13.5px] text-muted leading-relaxed mt-2">
            راجع إدارة النظام لربط حسابك بملف المتعهد.
          </p>
          <button onClick={signOut}
            className="mt-4 h-9 px-5 rounded-xl border border-line text-[13.5px] font-bold text-muted hover:text-ink">
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  const Rail = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-white/10">
        {brand?.logo?.fullOnDark && (
          <img src={brand.logo.fullOnDark} alt={brand.companyName}
            className="w-full max-w-[176px] h-auto" />
        )}
        <p className="text-[10.5px] font-semibold tracking-widest uppercase opacity-40 text-white mt-1.5">
          بوابة المتعهد
        </p>
      </div>

      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 mx-0 text-sm transition-colors ${
                isActive ? 'text-white font-bold' : 'text-white/75 font-semibold hover:text-white'
              }`}
            style={({ isActive }) => isActive
              ? { background: 'rgb(255 255 255 / 0.12)', borderRight: '3px solid rgb(var(--c-accent))' }
              : { borderRight: '3px solid transparent' }}>
            {({ isActive }) => (
              <>
                <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border"
                  style={{
                    background: isActive ? 'rgb(var(--c-accent) / 0.18)' : 'rgba(255,255,255,0.06)',
                    borderColor: isActive ? 'rgb(var(--c-accent) / 0.45)' : 'rgba(255,255,255,0.10)',
                  }}>
                  <item.Icon size={19} weight={isActive ? 'bold' : 'regular'}
                    color={isActive ? 'rgb(var(--c-accent))' : 'rgba(255,255,255,0.75)'} />
                </span>
                <span className="text-[15px]">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-1 mb-2">
          <span className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
            <Buildings size={17} weight="bold" className="text-white/75" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-white truncate">{caterer?.name || '—'}</span>
            <span className="block text-[11px] text-white/45 font-semibold">
              {centers.length ? `${centers.length} مركز` : 'بلا مراكز'}
            </span>
          </span>
        </div>
        <button onClick={signOut}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-white/10 border border-white/15
                     text-white/85 hover:text-white hover:bg-white/16 text-[13.5px] font-bold transition-colors">
          <SignOut size={14} weight="bold" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-canvas" dir="rtl">

      {/* ── the rail ── */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'rgb(var(--c-primary))' }}>
        <Rail />
      </aside>

      {open && (
        <>
          <button className="lg:hidden fixed inset-0 z-40 bg-ink/50" onClick={() => setOpen(false)} aria-label="إغلاق" />
          <aside className="lg:hidden fixed inset-y-0 right-0 z-50 w-64 flex flex-col shadow-2xl"
            style={{ background: 'rgb(var(--c-primary))' }}>
            <button onClick={() => setOpen(false)}
              className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-white/12 border border-white/20
                         flex items-center justify-center text-white">
              <X size={17} weight="bold" />
            </button>
            <Rail />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* A bar only where the rail is not: on a wide screen the rail already
            names the company, and a second header repeating it is furniture. */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 flex-shrink-0 text-white"
          style={{ background: 'rgb(var(--c-primary))' }}>
          <button onClick={() => setOpen(true)}
            className="w-9 h-9 rounded-lg bg-white/12 border border-white/20 flex items-center justify-center">
            <List size={18} weight="bold" />
          </button>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-black truncate">{caterer?.name || '—'}</span>
            <span className="block text-[11px] font-bold opacity-55">بوابة المتعهد</span>
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {loading
            ? <div className="py-24 flex justify-center">
                <div className="w-9 h-9 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            : <Outlet context={ctx} />}
        </main>
      </div>
    </div>
  );
}
