import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../lib/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SquaresFour as LayoutDashboard,
  Siren,
  Stack as Boxes,
  Gauge,
  FlowArrow as Workflow,
  ChefHat,
  ListChecks as ListTodo,
  Buildings as Building2,
  MapPinArea,
  FileText,
  ClipboardText,
  CaretDown,
  CalendarBlank,
  FileArrowDown,
  Users as UsersRound,
  UserGear as UserRoundCog,
  BellRinging as BellRing,
  MoonStars,
  Palette,
  SidebarSimple as PanelLeft,
  X,
  CaretRight as ChevronRight,
  CaretLeft as ChevronLeft,
  SignOut as LogOut,
} from '@phosphor-icons/react';
import { getCaterer } from '../../config/centers.js';
import UploadToastListener from '../../components/UploadToastListener.jsx';
import { useBrand } from '../../context/BrandContext.jsx';
import { formatHijri, toHijriParts } from '../../lib/hijri.js';

/* Two levels. A `children` entry is a group: it has no destination of its own
   and expands to its sections. Grouping is what keeps a sidebar that has grown
   to fourteen destinations readable — flat, it reads as a list to search
   rather than a structure to navigate.

   Notifications are deliberately absent: they are an interruption, not a
   place, and they live in the bell at the top of every screen. */
const NAV = [
  { to: '/admin/dashboard',  label: 'نظرة عامة',          icon: LayoutDashboard },
  { to: '/admin/reports',    label: 'البلاغات الميدانية', icon: Siren           },
  { to: '/admin/logistics',  label: 'الإسناد اللوجستي',   icon: Boxes           },

  { key: 'readiness', label: 'جاهزية المشاعر', icon: Gauge, children: [
    { to: '/admin/readiness/mina',   label: 'جاهزية منى',    icon: Gauge        },
    { to: '/admin/readiness/arafat', label: 'جاهزية عرفة',   icon: Gauge        },
    { to: '/admin/readiness/drill',  label: 'فرضية الوزارة', icon: ClipboardText },
  ]},

  { key: 'meals', label: 'متابعة الوجبات', icon: Workflow, children: [
    { to: '/admin/phases', label: 'المراحل',      icon: Workflow },
    { to: '/admin/menu',   label: 'المنيو',        icon: ChefHat  },
    { to: '/admin/tasks',  label: 'إسناد المهام', icon: ListTodo },
  ]},

  /* Centers before caterers: a center exists first, then a caterer is assigned
     to it, so the reading order matches the order of work. */
  { key: 'caterers', label: 'إدارة المتعهدين', icon: Building2, children: [
    { to: '/admin/caterers', label: 'المتعهدين', icon: Building2  },
    { to: '/admin/centers',  label: 'المراكز',    icon: MapPinArea },
    { to: '/admin/forms',    label: 'النماذج',    icon: FileText   },
  ]},

  { key: 'people', label: 'المستخدمين', icon: UsersRound, children: [
    { to: '/admin/users', label: 'المراقبين والمشرفين', icon: UsersRound   },
    { to: '/admin/staff', label: 'الموظفين',             icon: UserRoundCog },
  ]},

  { to: '/admin/reports-center', label: 'التقارير',      icon: FileArrowDown },
  { to: '/admin/brand',          label: 'تصميم الهوية', icon: Palette       },
];

const NOTIF_COLS = [
  'reports', 'logistics_requests', 'meal_evaluations',
  'mina_readiness', 'arafat_readiness',
];

const spring = { type: 'spring', stiffness: 400, damping: 18 };

/* ── Nav pieces ───────────────────────────────────────────── */

const iconBox = (isActive) => ({
  background:  isActive ? 'rgb(var(--c-accent) / 0.18)' : 'rgba(255,255,255,0.06)',
  borderColor: isActive ? 'rgb(var(--c-accent) / 0.45)' : 'rgba(255,255,255,0.10)',
});

function NavItem({ item, idx, onNavigate, pendingCount, nested }) {
  const { to, label, icon: Icon } = item;
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl text-sm transition-colors duration-150 ${
          nested ? 'px-2.5 py-2' : 'px-3 py-2.5'
        } ${isActive ? 'text-white font-bold' : 'text-white/80 font-semibold hover:text-white'}`
      }
      style={({ isActive }) => isActive
        ? { background: 'rgb(255 255 255 / 0.12)', borderRight: '3px solid rgb(var(--c-accent))' }
        : { borderRight: '3px solid transparent' }}
    >
      {({ isActive }) => (
        <>
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: Math.min(idx, 8) * 0.04 }}
            whileHover={{ scale: 1.18 }}
            whileTap={{ scale: 0.88 }}
            className={`flex items-center justify-center rounded-xl flex-shrink-0 backdrop-blur-md border ${
              nested ? 'w-7 h-7' : 'w-8 h-8'
            }`}
            style={iconBox(isActive)}
          >
            <Icon
              size={nested ? 14 : 17}
              weight={isActive ? 'bold' : 'regular'}
              color={isActive ? 'rgb(var(--c-accent))' : 'rgba(255,255,255,0.75)'}
            />
          </motion.div>

          <span className={`flex-1 ${nested ? 'text-[12px]' : 'text-[13px]'}`}>{label}</span>

          {/* Reports carries what is still pending — the one count that belongs
              beside a destination rather than in the bell. */}
          {to === '/admin/reports' && pendingCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
            >
              {pendingCount > 99 ? '99+' : pendingCount}
            </motion.span>
          )}

          {isActive && <ChevronRight size={12} weight="bold" className="opacity-40 flex-shrink-0" />}
        </>
      )}
    </NavLink>
  );
}

/* Its own component, and therefore its own re-render: a clock ticking once a
   second inside the layout would re-render every screen under it once a second
   for the sake of two digits. */
function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* No box. Three facts set as one line of type, parted by hairlines rather
     than by punctuation — a boxed chip beside a boxed chip beside a boxed chip
     was what made the old bar read as a toolbar instead of a masthead. */
  return (
    <div className="hidden sm:flex items-stretch gap-3 pl-1 whitespace-nowrap">
      <CalendarBlank size={15} weight="light" className="text-accent/70 self-center flex-shrink-0" />

      <div className="flex flex-col justify-center leading-none">
        <span className="text-[12px] font-black text-white">{formatHijri(now)}</span>
        <span className="text-[9.5px] font-bold text-white/45 mt-1" dir="ltr">
          {now.toISOString().slice(0, 10)}
        </span>
      </div>

      <span className="w-px bg-white/15 my-1" />

      <span className="self-center text-[15px] font-black text-accent tabular-nums tracking-tight">
        {now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true })}
      </span>
    </div>
  );
}

/* The gold card. Every control on the bar is cut from it, so the header reads
   as one set of objects rather than a row of unrelated chips.

   Text on it is the deep navy, not white: white on the brand gold is about
   2.3:1 and unreadable, while the navy is 6:1 and looks like ink on brass. */
const goldCard = {
  background: 'linear-gradient(135deg, rgb(var(--c-accent)) 0%, rgb(var(--c-accent-600)) 100%)',
  boxShadow: '0 4px 16px rgb(var(--c-accent) / 0.32), inset 0 1px 0 rgb(255 255 255 / 0.28)',
};

/* Zero is shown, not hidden: "٠ بلاغ معلّق" is information, and a chip that
   vanishes when clear makes the header jump every time one is resolved.
 *
 * The card is gold either way — that is the identity, not a state. What the
 * state changes is the bubble holding the icon: hollow while the queue is
 * clear, filled navy with a pulsing dot the moment something is waiting. So
 * the bar is scannable without reading a single digit. */
function HeaderStat({ count, label, Icon, onClick }) {
  const live = count > 0;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      className="group relative flex items-center gap-2 pr-1.5 pl-3.5 py-1.5 rounded-full"
      style={goldCard}
    >
      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        live ? 'shadow-[0_2px_6px_rgb(var(--c-primary-900)/0.35)]' : ''
      }`}
        style={{ background: live ? 'rgb(var(--c-primary))' : 'rgb(255 255 255 / 0.3)' }}>
        <Icon size={14} weight="bold"
          style={{ color: live ? 'rgb(var(--c-accent))' : 'rgb(var(--c-primary-900))' }} />
      </span>
      <span className="text-[14px] font-black tabular-nums leading-none"
        style={{ color: 'rgb(var(--c-primary-900))' }}>
        {count}
      </span>
      <span className="text-[11px] font-bold whitespace-nowrap"
        style={{ color: 'rgb(var(--c-primary-900) / 0.72)' }}>
        {label}
      </span>
      {live && (
        <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[rgb(var(--c-primary))]"
          style={{ animation: 'badgePulse 2s ease-in-out infinite' }} />
      )}
    </motion.button>
  );
}

function NavGroup({ item, idx, openGroups, toggle, onNavigate, pendingCount }) {
  const { key, label, icon: Icon, children } = item;
  const location = useLocation();
  /* A group holding the current page stays open regardless of what the admin
     last collapsed — otherwise the sidebar hides where you are. */
  const hasActive = children.some(c => location.pathname.startsWith(c.to));
  const expanded  = hasActive || !!openGroups[key];

  return (
    <div>
      <button
        onClick={() => toggle(key)}
        className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 ${
          hasActive ? 'text-white font-bold' : 'text-white/80 font-semibold hover:text-white'
        }`}
        style={{ borderRight: '3px solid transparent' }}
      >
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: Math.min(idx, 8) * 0.04 }}
          whileHover={{ scale: 1.18 }}
          className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 backdrop-blur-md border"
          style={iconBox(hasActive)}
        >
          <Icon size={17} weight={hasActive ? 'bold' : 'regular'}
            color={hasActive ? 'rgb(var(--c-accent))' : 'rgba(255,255,255,0.75)'} />
        </motion.div>

        <span className="flex-1 text-[13px] text-right">{label}</span>
        <CaretDown size={11} weight="bold"
          className={`opacity-50 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {/* The rail makes the indent read as containment rather than as an
                accidental margin. */}
            <div className="mr-5 pr-3 my-0.5 space-y-0.5 border-r border-white/12">
              {children.map((child, i) => (
                <NavItem key={child.to} item={child} idx={i} nested
                  onNavigate={onNavigate} pendingCount={pendingCount} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminLayout() {
  const navigate              = useNavigate();
  const location              = useLocation();
  const { profile, logout }   = useAuth();
  const { brand }             = useBrand();
  const [open, setOpen]       = useState(false);
  /* Which groups the admin has opened by hand. A group containing the current
     page opens regardless, so this only records deliberate expansions. */
  const [openGroups, setOpenGroups] = useState({});
  const toggleGroup = (key) => setOpenGroups(p => ({ ...p, [key]: !p[key] }));
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [newCount,     setNewCount]     = useState(0);
  const [logisticsCount, setLogisticsCount] = useState(0);
  const [today,        setToday]        = useState(() => new Date());

  /* Arabic-Indic digits to match formatHijri beside it, and grouping off so
     1448 does not render as ١٬٤٤٨. */
  const hijriYear = toHijriParts(today).y
    .toLocaleString('ar-SA', { useGrouping: false });
  const [lastSeen,     setLastSeen]     = useState(
    () => Number(localStorage.getItem('notif_last_seen') || 0)
  );

  /* Reports sidebar badge */
  useEffect(() => {
    return db.reports.subscribe(rows =>
      setPendingCount(rows.filter(r => (r.status || 'pending') === 'pending').length)
    );
  }, []);

  /* Header figures: what an operations lead checks without being asked. */
  useEffect(() => db.logistics_requests.subscribe(rows =>
    setLogisticsCount(rows.filter(r => (r.status || 'pending') === 'pending').length)
  ), []);

  /* The header prints today's date, so it has to notice midnight passing on a
     screen left open overnight — which in an operations room is most of them. */
  useEffect(() => {
    const id = setInterval(() => setToday(new Date()), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /* Bell badge */
  useEffect(() => {
    const counts = {};
    const unsubs = NOTIF_COLS.map(col => {
      counts[col] = 0;
      return db[col].subscribe(rows => {
        counts[col] = rows.filter(d => (d.timestamp?.toMillis?.() ?? 0) > lastSeen).length;
        setNewCount(Object.values(counts).reduce((a, b) => a + b, 0));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [lastSeen]);

  /* Reset badge on notifications page */
  useEffect(() => {
    if (location.pathname === '/admin/notifications') {
      const now = Date.now();
      localStorage.setItem('notif_last_seen', now.toString());
      setLastSeen(now);
      setNewCount(0);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="relative px-5 py-4 border-b border-white/10 overflow-hidden">
        <div className="absolute inset-0 opacity-15"
          style={{ background: 'radial-gradient(ellipse at 70% 50%, rgb(var(--c-primary-400)) 0%, transparent 70%)' }} />
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative flex flex-col items-center gap-1 cursor-default"
        >
          <img
            src={brand.logo.fullOnDark}
            alt={brand.companyName}
            className="w-full max-w-[186px] h-auto"
          />
          <p className="text-[9px] font-semibold tracking-widest uppercase opacity-40 text-white">لوحة الإدارة</p>
        </motion.div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item, idx) =>
          item.children
            ? <NavGroup key={item.key} item={item} idx={idx} openGroups={openGroups}
                toggle={toggleGroup} onNavigate={() => setOpen(false)} pendingCount={pendingCount} />
            : <NavItem key={item.to} item={item} idx={idx}
                onNavigate={() => setOpen(false)} pendingCount={pendingCount} />,
        )}
      </nav>

      {/* Profile + Logout */}
      <div className="px-4 py-4 border-t border-white/10">
        {/* Avatar + info */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <motion.div
            whileHover={{ scale: 1.08 }}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary flex items-center justify-center flex-shrink-0 shadow-md cursor-default"
          >
            <span className="text-white text-sm font-bold">
              {(profile?.nameAr || profile?.name)?.charAt(0) || 'أ'}
            </span>
          </motion.div>
          <div className="min-w-0">
            <p className="text-white text-xs font-bold truncate">{profile?.nameAr || profile?.name || 'المشرف'}</p>
            <p className="text-white/40 text-[10px] truncate">{profile?.email || ''}</p>
          </div>
        </div>

        {/* Centers */}
        {profile?.centers?.length > 0 && (
          <div className="mb-2 px-1 max-h-24 overflow-y-auto space-y-1">
            {profile.centers.map(cid => (
              <div key={cid} className="bg-white/5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 transition-colors duration-150">
                <p className="text-primary text-[10px] font-bold">{cid}</p>
                <p className="text-white/50 text-[9px] truncate leading-tight">
                  {profile.caterers?.[cid] || getCaterer(cid)}
                </p>
              </div>
            ))}
          </div>
        )}
        {profile?.center && !profile?.centers?.length && (
          <div className="mb-2 px-1">
            <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
              <p className="text-primary text-[10px] font-bold">{profile.center}</p>
              <p className="text-white/50 text-[9px] truncate leading-tight">
                {profile.caterer || getCaterer(profile.center)}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <motion.button
          onClick={handleLogout}
          disabled={loggingOut}
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.96 }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/55 hover:bg-red-500/15 hover:text-red-300 text-sm transition-colors duration-200 disabled:opacity-50"
        >
          {loggingOut
            ? <span className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin flex-shrink-0" />
            : <LogOut size={16} weight="regular" className="flex-shrink-0" />}
          <span className="text-xs font-semibold">{loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}</span>
        </motion.button>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="flex h-screen font-arabic overflow-hidden bg-canvas"
      style={{ fontFamily: "'Cairo', Tahoma, sans-serif" }}>

      {/* Desktop sidebar — navy deepening toward the base so the brand mark at
          the top sits on the lightest part of the gradient. */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary-700)) 55%, rgb(var(--c-primary-900)) 100%)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: 240 }}
              animate={{ x: 0 }}
              exit={{ x: 240 }}
              transition={spring}
              className="relative w-64 flex flex-col z-50 shadow-2xl"
              style={{ background: 'linear-gradient(180deg,rgb(var(--c-ink-800)) 0%,rgb(var(--c-ink)) 60%,rgb(var(--c-ink)) 100%)' }}
            >
              <motion.button
                onClick={() => setOpen(false)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="absolute top-4 left-4 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X size={16} weight="thin" />
              </motion.button>
              <SidebarContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Notifications left the sidebar: an alert is an interruption, not a
            destination, and buried in a list of fourteen it was neither. It now
            has one place on every screen at both sizes, and announces itself
            when something is waiting. */}
        {/* A masthead, not a toolbar.
            The bar carries the deep navy so it and the sidebar close around the
            canvas as one frame, and the gold arrives where an accent belongs —
            a hairline along the edge, the season crest, the clock, a live
            count. A full-width field of the accent made every control on it
            need its own navy box to stay legible, and eight boxes in a row is
            what the bar had become. */}
        <header className="relative px-3 sm:px-4 h-16 flex items-center gap-3 flex-shrink-0 overflow-hidden shadow-[0_4px_20px_rgb(var(--c-primary-900)/0.35)]"
          style={{ background: 'rgb(var(--c-primary))' }}>

          {/* The gold rule that closes the bar. The field itself is one flat
              navy — the same one the sidebar starts on, so the two meet at the
              corner without a seam; a second navy laid over the first only ever
              looked like one colour dropped on another. */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent)), rgb(var(--c-accent-600)), transparent)' }} />

          <div className="relative flex items-center gap-2.5 min-w-0">
            <motion.button
              onClick={() => setOpen(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="lg:hidden p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="فتح القائمة"
            >
              <PanelLeft size={22} weight="bold" />
            </motion.button>

            {/* The season as a crest rather than a chip: a ringed mark and two
                lines of type. It is the one fixed fact on the bar, so it reads
                as a title instead of another button.
                Derived from today's Hijri date rather than from the season row:
                a label that says which Hajj season we are in must follow the
                calendar, not a record someone forgot to roll over. */}
            <span className="flex items-center gap-2.5 flex-shrink-0 pr-1.5 pl-4 py-1.5 rounded-full"
              style={goldCard}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white/30">
                <MoonStars size={15} weight="fill" style={{ color: 'rgb(var(--c-primary-900))' }} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[8.5px] font-bold tracking-[0.2em]"
                  style={{ color: 'rgb(var(--c-primary-900) / 0.68)' }}>موسم حج</span>
                <span className="text-[14px] font-black mt-1 tabular-nums"
                  style={{ color: 'rgb(var(--c-primary-900))' }}>{hijriYear}هـ</span>
              </span>
            </span>
          </div>

          {/* Centred, and given the slack so the two counts sit in the middle
              of the bar rather than drifting with the width of what flanks
              them. Two counts an operations lead checks first thing, each a
              shortcut to the screen that clears it. */}
          <div className="relative flex-1 hidden md:flex items-center justify-center gap-2.5">
            <HeaderStat count={pendingCount}   label="بلاغ معلّق"  Icon={Siren}
              onClick={() => navigate('/admin/reports')} />
            <HeaderStat count={logisticsCount} label="إسناد معلّق" Icon={Boxes}
              onClick={() => navigate('/admin/logistics')} />
          </div>
          <div className="flex-1 md:hidden" />

          {/* Clock and bell travel together at the far end. */}
          <div className="relative flex items-center gap-3 flex-shrink-0">
          <HeaderClock />

          {/* The same gold card as the rest. Quiet it carries the word alone;
              waiting, the bubble fills navy, the bell swings, the count takes
              the label's place and a red dot rides the corner — the state
              reads from shape, not from a colour change alone. */}
          <motion.button
            onClick={() => navigate('/admin/notifications')}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.94 }}
            className="relative flex items-center gap-2 pr-1.5 pl-3.5 py-1.5 rounded-full"
            style={goldCard}
            aria-label="التنبيهات"
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: newCount > 0 ? 'rgb(var(--c-primary))' : 'rgb(255 255 255 / 0.3)' }}>
              <BellRing size={15} weight="fill"
                style={{
                  color: newCount > 0 ? 'rgb(var(--c-accent))' : 'rgb(var(--c-primary-900))',
                  animation: newCount > 0 ? 'bellSwing 2.4s ease-in-out infinite' : undefined,
                }} />
            </span>
            {newCount > 0 && (
              <span className="text-[14px] font-black tabular-nums leading-none"
                style={{ color: 'rgb(var(--c-primary-900))' }}>
                {newCount > 99 ? '99+' : newCount}
              </span>
            )}
            <span className="text-[11px] font-bold whitespace-nowrap"
              style={{ color: 'rgb(var(--c-primary-900) / 0.72)' }}>
              {newCount > 0 ? 'تنبيه جديد' : 'التنبيهات'}
            </span>
            {newCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[rgb(var(--c-primary))]"
                style={{ animation: 'badgePulse 2s ease-in-out infinite' }} />
            )}
          </motion.button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-canvas p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Global toast notifications for new readiness uploads */}
      <UploadToastListener />

      <style>{`
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50%       { transform: scale(1.08); box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        /* A short swing every few seconds — enough to catch the eye in
           peripheral vision, not enough to nag. */
        @keyframes bellSwing {
          0%, 70%, 100% { transform: rotate(0deg); }
          75%           { transform: rotate(-12deg); }
          80%           { transform: rotate(10deg); }
          85%           { transform: rotate(-6deg); }
          90%           { transform: rotate(4deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="bellSwing"], [style*="badgePulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
