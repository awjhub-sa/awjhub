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
import { Warning,
  House, Siren, FileText, SignOut, List, X, Buildings, WarningCircle, Clock,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBrand } from '../../context/BrandContext.jsx';
import { db } from '../../lib/db.js';
import ToastStack from '../../components/ToastStack.jsx';

/* Arabic-Indic, as the rest of the portal counts. */
const AR = (n) => String(n ?? '').replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

/* One figure and what it counts. The colour carries the urgency, so the number
   does not have to be read to know whether it matters. */
const Tile = ({ n, label, tone }) => (
  <div className="rounded-xl px-2.5 py-2 border"
    style={{ background: 'rgb(255 255 255 / 0.05)', borderColor: 'rgb(255 255 255 / 0.10)' }}>
    <p className="text-[20px] font-black leading-none tabular-nums" style={{ color: tone }}>{AR(n)}</p>
    <p className="text-[10.5px] font-bold text-white/50 mt-1 leading-tight">{label}</p>
  </div>
);

const NAV = [
  { to: '/caterer/home',    label: 'الرئيسية', Icon: House },
  { to: '/caterer/reports', label: 'البلاغات', Icon: Siren },
  { to: '/caterer/forms',   label: 'النماذج',  Icon: FileText },
  { to: '/caterer/violations', label: 'المخالفات', Icon: Warning },
];

export default function CatererLayout() {
  const { profile, logout } = useAuth();
  const { brand } = useBrand();
  const nav = useNavigate();

  const [caterer, setCaterer] = useState(null);
  const [centers, setCenters] = useState([]);
  const [forms,   setForms]   = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);          // drawer, on narrow screens

  const catererId = profile?.catererId || null;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!catererId) { setLoading(false); return; }
      const [c, ce, fm, rp, tp] = await Promise.all([
        db.caterers.get(catererId),
        /* Narrowed on purpose — the portal must never request the office's
           internal notes. The identifiers below are added because the ministry
           minute prints them on a sheet this caterer signs: withholding them
           here does not protect anything, it just leaves holes in their own
           document. Anything the office keeps to itself stays off this list. */
        db.centers.list({ filter: { catererId }, columns: [
          'id', 'code', 'facilityName', 'facilityLicense', 'pilgrimsCount',
          'pilgrimsNationality', 'category', 'shakhisMina', 'shakhisArafat',
          'murabbaMina', 'kitchenLocationMina', 'kitchenLocationArafat',
          'active', 'catererName',
        ] }),
        db.form_assignments.list({ filter: { catererId },
          columns: ['id', 'status', 'dueAt', 'templateId'] }),
        db.reports.list({ columns: ['id', 'caterer', 'status', 'catererResponse'] }),
        /* Two columns, to tell a minute from a form. */
        db.form_templates.list({ columns: ['id', 'category'] }),
      ]);
      if (!alive) return;
      setCaterer(c); setCenters(ce);
      const violationTemplates = new Set(tp.filter(t => t.category === 'مخالفات').map(t => t.id));
      setForms(fm.map(f => ({ ...f, isViolation: violationTemplates.has(f.templateId) })));
      /* Reports carry the caterer by name, not by id — the field app writes
         them before a caterer record is ever looked up. */
      const name = String(c?.name ?? '').trim();
      setReports(rp.filter(r => String(r.caterer ?? '').trim() === name));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [catererId]);

  /* What is outstanding, in the two shapes the portal is about. */
  const standing = useMemo(() => {
    const ms = (v) => (v ? new Date(v).getTime() : 0);
    const now = Date.now();
    const answered = (f) => ['submitted', 'accepted'].includes(f.status);
    const due = forms.filter(f => !f.isViolation && !answered(f));
    const overdue = due.filter(f => f.dueAt && ms(f.dueAt) < now);
    const violations = forms.filter(f => f.isViolation && !answered(f));
    const violationsLate = violations.filter(f => f.dueAt && ms(f.dueAt) < now);
    const open = reports.filter(r => r.status !== 'resolved');
    const unanswered = open.filter(r => !r.catererResponse);
    /* The soonest thing still owed — a count says how many, a date says when. */
    const next = due
      .filter(f => f.dueAt && ms(f.dueAt) >= now)
      .sort((a, b) => ms(a.dueAt) - ms(b.dueAt))[0];
    return {
      due: due.length,
      overdue: overdue.length,
      open: open.length,
      unanswered: unanswered.length,
      violations: violations.length,
      violationsLate: violationsLate.length,
      nextDue: next?.dueAt || null,
    };
  }, [forms, reports]);

  const ctx = useMemo(
    () => ({ catererId, caterer, centers, loading, standing }),
    [catererId, caterer, centers, loading, standing],
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
                <span className="text-[15px] flex-1">{item.label}</span>
                {(() => {
                  /* A badge on the door, so the number is read on the way in
                     rather than after arriving. */
                  const n = item.to.endsWith('/forms') ? standing.due
                    : item.to.endsWith('/reports') ? standing.unanswered
                    : item.to.endsWith('/violations') ? standing.violations
                    : 0;
                  if (!n) return null;
                  /* A violation past its remedy date is always red — it is the
                     one number here that carries a consequence. */
                  const hot = item.to.endsWith('/forms') ? standing.overdue > 0
                    : item.to.endsWith('/violations') ? true
                    : standing.unanswered > 0;
                  return (
                    <span
                      className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-black
                                 flex items-center justify-center tabular-nums flex-shrink-0"
                      style={{
                        background: hot ? '#DC2626' : 'rgb(var(--c-accent))',
                        color: hot ? '#fff' : 'rgb(var(--c-primary-900))',
                      }}
                    >
                      {AR(n)}
                    </span>
                  );
                })()}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* What is on this caterer right now. It sits above the account block
          because it is the reason they opened the portal. */}
      {(standing.due > 0 || standing.open > 0) && (
        <div className="px-3 pb-3">
          <div className="rounded-2xl border border-white/12 p-3"
            style={{ background: 'rgb(255 255 255 / 0.06)' }}>
            <p className="text-[10px] font-black tracking-widest text-white/40 mb-2.5">عليك الآن</p>

            <div className="grid grid-cols-2 gap-2">
              <Tile n={standing.due}  label="نموذج مستحق"
                tone={standing.overdue ? '#F87171' : 'rgb(var(--c-accent))'} />
              <Tile n={standing.open} label="بلاغ مفتوح"
                tone={standing.unanswered ? '#F87171' : '#7DD3FC'} />
            </div>

            {standing.overdue > 0 && (
              <p className="mt-2.5 text-[11px] font-bold text-red-300 flex items-center gap-1.5">
                <WarningCircle size={13} weight="fill" />
                {AR(standing.overdue)} تجاوز موعده
              </p>
            )}
            {!standing.overdue && standing.nextDue && (
              <p className="mt-2.5 text-[11px] font-bold text-white/55 flex items-center gap-1.5">
                <Clock size={13} weight="bold" />
                أقرب موعد {AR(new Date(standing.nextDue).toISOString().slice(0, 10))}
              </p>
            )}
          </div>
        </div>
      )}

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
        style={{ background:
                      'radial-gradient(120% 60% at 50% 0%, rgb(var(--c-primary-400) / 0.30) 0%, transparent 60%),' +
                      'radial-gradient(90% 40% at 50% 100%, rgb(var(--c-accent) / 0.14) 0%, transparent 62%),' +
                      'linear-gradient(180deg, rgb(var(--c-primary-700)), rgb(var(--c-primary)) 45%, rgb(var(--c-primary-900)))', }}>
        <Rail />
      </aside>

      {open && (
        <>
          <button className="lg:hidden fixed inset-0 z-40 bg-ink/50" onClick={() => setOpen(false)} aria-label="إغلاق" />
          <aside className="lg:hidden fixed inset-y-0 right-0 z-50 w-64 flex flex-col shadow-2xl"
            style={{ background:
                      'radial-gradient(120% 60% at 50% 0%, rgb(var(--c-primary-400) / 0.30) 0%, transparent 60%),' +
                      'radial-gradient(90% 40% at 50% 100%, rgb(var(--c-accent) / 0.14) 0%, transparent 62%),' +
                      'linear-gradient(180deg, rgb(var(--c-primary-700)), rgb(var(--c-primary)) 45%, rgb(var(--c-primary-900)))', }}>
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

      <ToastStack />
    </div>
  );
}
