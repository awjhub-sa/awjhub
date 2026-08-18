/**
 * src/pages/caterer/CatererLayout.jsx
 *
 * The shell an outside company sees.
 *
 * Deliberately not the admin shell. That one carries twenty-three sections, a
 * command palette and a live operations wall; a caterer has three places to be,
 * and a chrome built for twenty-three would imply the other twenty are behind
 * a permission they lack. Three tabs is the whole navigation.
 *
 * Everything under here is scoped to one caterer, resolved once from the
 * signed-in profile and handed down. A screen that had to work out whose data
 * it was showing would eventually get it wrong.
 */

import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { House, Siren, FileText, SignOut } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBrand } from '../../context/BrandContext.jsx';
import { db } from '../../lib/db.js';

const TABS = [
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

  /* An account with no caterer attached can see nothing and must not be shown
     an empty portal as if it were working. */
  if (!loading && !catererId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-2xl border border-line p-6 max-w-sm text-center">
          <p className="text-[14px] font-black text-ink">الحساب غير مرتبط بمتعهد</p>
          <p className="text-[12px] text-muted leading-relaxed mt-2">
            راجع إدارة النظام لربط حسابك بملف المنشأة.
          </p>
          <button onClick={signOut}
            className="mt-4 h-9 px-5 rounded-xl border border-line text-[12px] font-bold text-muted hover:text-ink">
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <header className="sticky top-0 z-40 text-white"
        style={{ background: 'rgb(var(--c-primary))' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {brand?.logo?.fullOnDark && (
            <img src={brand.logo.fullOnDark} alt="" className="h-6 w-auto opacity-95" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-black truncate">{caterer?.name || '—'}</p>
            <p className="text-[10px] font-bold opacity-60">
              بوابة المتعهد
              {centers.length > 0 && ` · ${centers.length} مركز`}
            </p>
          </div>
          <button onClick={signOut}
            className="w-8 h-8 rounded-lg bg-white/12 border border-white/20 flex items-center justify-center flex-shrink-0"
            title="تسجيل الخروج">
            <SignOut size={14} weight="bold" />
          </button>
        </div>

        <nav className="max-w-4xl mx-auto px-2 flex">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to}
              className={({ isActive }) =>
                `flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-black border-b-2 transition-colors ${
                  isActive ? 'border-accent text-white' : 'border-transparent text-white/60 hover:text-white/85'
                }`}>
              <t.Icon size={14} weight="bold" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-4">
        {loading
          ? <div className="py-20 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          : <Outlet context={ctx} />}
      </main>
    </div>
  );
}
