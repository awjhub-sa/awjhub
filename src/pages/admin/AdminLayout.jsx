import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import CommandPalette from '../../components/CommandPalette.jsx';
import { db } from '../../lib/db.js';
import { useSectionAlerts, groupAlert, rowTime } from '../../lib/sectionAlerts.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SquaresFour as LayoutDashboard,
  Warning,
  Siren,
  Stack as Boxes,
  Gauge,
  FlowArrow as Workflow,
  ChefHat,
  ListChecks as ListTodo,
  Buildings as Building2,
  MapPinArea,
  Globe as Earth,
  Eye,
  ShieldCheck,
  FileText,
  ClipboardText,
  CaretDown,
  CalendarBlank,
  FileArrowDown,
  Users as UsersRound,
  UserGear as UserRoundCog,
  BellRinging as BellRing,
  MoonStars,
  ChartLineUp,
  Broadcast,
  PushPin,
  ClipboardText as Clipboard,
  Palette,
  SidebarSimple as PanelLeft,
  X,
  CaretRight as ChevronRight,
  CaretLeft as ChevronLeft,
  SignOut as LogOut,
} from '@phosphor-icons/react';
import { getCaterer } from '../../config/centers.js';
import UploadToastListener from '../../components/UploadToastListener.jsx';
import ToastStack from '../../components/ToastStack.jsx';
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
    { to: '/admin/nationalities', label: 'جنسيات الحجاج', icon: Earth },
    { to: '/admin/forms',    label: 'النماذج',    icon: FileText   },
    { to: '/admin/violations', label: 'المخالفات', icon: Warning },
    { to: '/admin/evaluations', label: 'التقييمات', icon: Clipboard },
  ]},

  { key: 'people', label: 'المستخدمين', icon: UsersRound, children: [
    { to: '/admin/observers',   label: 'المراقبون', icon: Eye         },
    { to: '/admin/supervisors', label: 'المشرفون',  icon: ShieldCheck },
    { to: '/admin/staff', label: 'الموظفين',             icon: UserRoundCog },
  ]},

  /* Sits above the rest and outside every group: it is not a section you work
     in, it is the wall you put the season on. */
  { to: '/admin/live',           label: 'الشاشة المباشرة', icon: Broadcast, standalone: true },
  { to: '/admin/insights',       label: 'التحليلات',    icon: ChartLineUp   },
  { to: '/admin/reports-center', label: 'التقارير',      icon: FileArrowDown },
  { to: '/admin/brand',          label: 'تصميم الهوية', icon: Palette       },
];

/* Every navigable section, flattened out of NAV. Derived rather than repeated
   so a section added to the menu is searchable the same day. */
const SECTIONS = NAV.flatMap(item =>
  item.children
    ? item.children.map(c => ({ to: c.to, label: c.label, hint: item.label }))
    : [{ to: item.to, label: item.label, hint: '' }],
);
const LABEL_BY_PATH = Object.fromEntries(SECTIONS.map(s => [s.to, s.label]));

const NOTIF_COLS = [
  'reports', 'logistics_requests', 'meal_evaluations',
  'mina_readiness', 'arafat_readiness',
];

const spring = { type: 'spring', stiffness: 400, damping: 18 };

/* ── Nav pieces ───────────────────────────────────────────── */

const iconBox = (isActive) => ({
  background: isActive
    ? 'linear-gradient(150deg, rgb(var(--c-accent) / 0.32), rgb(var(--c-accent) / 0.12))'
    : 'rgba(255,255,255,0.055)',
  borderColor: isActive ? 'rgb(var(--c-accent) / 0.45)' : 'rgba(255,255,255,0.09)',
  boxShadow: isActive ? 'inset 0 1px 0 rgb(255 255 255 / 0.16)' : 'none',
});

/* One badge, three readings: how many, whether any of it is new, and — by
   colour — whether it is work owed or merely something that arrived. Gold for
   uploads you have not looked at, red for a queue with your name on it, and
   a ring only while it is still unseen. */
function Badge({ alert }) {
  if (!alert) return null;
  const owed = alert.kind !== 'new';
  const bg = alert.fresh ? (owed ? '#DC2626' : 'rgb(var(--c-accent))') : 'rgba(255,255,255,0.16)';
  const fg = alert.fresh ? (owed ? '#fff' : 'rgb(var(--c-primary-900))') : 'rgba(255,255,255,0.82)';
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      title={owed ? 'بانتظار مراجعتك' : 'وصل ولم تطّلع عليه'}
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[19px] text-center tabular-nums flex-shrink-0"
      style={{
        background: bg, color: fg,
        boxShadow: alert.fresh ? `0 0 0 3px ${owed ? 'rgb(220 38 38 / 0.22)' : 'rgb(var(--c-accent) / 0.22)'}` : 'none',
      }}
    >
      {alert.n > 99 ? '99+' : alert.n}
    </motion.span>
  );
}

/* Collapsed, the rail has no room for a count — so the badge becomes a dot on
   the icon's corner. The section still says it is holding something; it just
   says it in the space available. */
function AlertDot({ alert }) {
  if (!alert) return null;
  const owed = alert.kind !== 'new';
  return (
    <span
      className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full ring-2 ring-[rgb(var(--c-primary-700))]"
      style={{ background: owed ? '#DC2626' : 'rgb(var(--c-accent))' }}
    />
  );
}

function NavItem({ item, onNavigate, alerts, nested, expanded = true }) {
  const { to, label, icon: Icon } = item;
  const alert = alerts?.[to];
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={expanded ? undefined : label}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl text-sm transition-colors duration-200 mx-2 ${
          nested ? 'px-2.5 py-2' : 'px-3 py-2.5'
        } ${isActive ? 'text-white font-bold' : 'text-white/75 font-semibold hover:text-white hover:bg-white/[0.07]'}`
      }
      style={({ isActive }) => isActive
        ? {
            background: 'linear-gradient(100deg, rgb(var(--c-accent) / 0.20), rgb(255 255 255 / 0.06))',
            boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.12)',
          }
        : undefined}
    >
      {({ isActive }) => (
        <>
          <span
            className={`relative flex items-center justify-center rounded-xl flex-shrink-0 border transition-transform duration-150 group-hover:scale-105 ${
              nested ? 'w-7 h-7' : 'w-8 h-8'
            }`}
            style={iconBox(isActive)}
          >
            <Icon
              size={nested ? 15 : 18}
              weight={isActive ? 'fill' : 'duotone'}
              color={isActive ? 'rgb(var(--c-accent))' : 'rgba(255,255,255,0.78)'}
            />
            {!expanded && <AlertDot alert={alert} />}
          </span>

          {expanded && (
            <>
              <span className={`flex-1 whitespace-nowrap ${nested ? 'text-[12px]' : 'text-[13px]'}`}>{label}</span>
              {/* Whatever this section is holding. The bell keeps the feed; this
                  keeps the count, beside the door it belongs to. */}
              <Badge alert={alert} />
            </>
          )}

          {isActive && (
            <span aria-hidden className="absolute inset-y-2 right-0 w-[3px] rounded-full"
              style={{ background: 'rgb(var(--c-accent))' }} />
          )}
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
    <div className="hidden md:flex items-center gap-2.5 whitespace-nowrap">
      <CalendarBlank size={14} weight="regular" className="text-white/35 flex-shrink-0" />
      <div className="flex flex-col leading-none">
        <span className="text-[11.5px] font-bold text-white/85">{formatHijri(now)}</span>
        <span className="text-[10px] font-medium text-white/40 mt-1 tabular-nums" dir="ltr">
          {now.toISOString().slice(0, 10)} ·{' '}
          {now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </span>
      </div>
    </div>
  );
}

/* The gold card. Every control on the bar is cut from it, so the header reads
   as one set of objects rather than a row of unrelated chips.

   Text on it is the deep navy, not white: white on the brand gold is about
   2.3:1 and unreadable, while the navy is 6:1 and looks like ink on brass. */
/* Gold is the identity, so it appears on the bar once — as the outline of the
   season chip and on the bell when something is waiting. Four gold plates in a
   row spent it on decoration and left nothing to mark an alert with. */
const goldChip = {
  background: 'rgb(var(--c-accent) / 0.12)',
  borderColor: 'rgb(var(--c-accent) / 0.45)',
};

/* Zero is shown, not hidden: "٠ بلاغ معلّق" is information, and a chip that
   vanishes when clear makes the header jump every time one is resolved.
 *
 * A count on the bar is a figure, not a plate. Colour carries the state — the
 * numeral turns red the moment something is waiting — so the shape stays put
 * and only the meaning changes. */
function HeaderStat({ count, label, Icon, onClick }) {
  const live = count > 0;
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-colors hover:bg-white/[0.08]"
    >
      <span
        className="relative w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 border transition-colors"
        style={{
          background:  live ? 'rgb(239 68 68 / 0.20)'   : 'rgb(255 255 255 / 0.06)',
          borderColor: live ? 'rgb(248 113 113 / 0.45)' : 'rgb(255 255 255 / 0.12)',
        }}
      >
        <Icon size={15} weight="fill"
          style={{ color: live ? '#FCA5A5' : 'rgb(255 255 255 / 0.55)' }} />
        {live && (
          <span className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[rgb(var(--c-primary))]"
            style={{ animation: 'badgePulse 2s ease-in-out infinite' }} />
        )}
      </span>
      <span className="flex flex-col items-start leading-none">
        <span className="text-[17px] font-extrabold tabular-nums"
          style={{ color: live ? '#FCA5A5' : '#fff' }}>
          {count}
        </span>
        <span className="text-[10px] font-semibold text-white/50 mt-1 whitespace-nowrap">{label}</span>
      </span>
    </button>
  );
}

/* The rail's two widths. Set inline rather than as Tailwind classes so the
   value is the same number the spacer and the overlay both read. */
const RAIL_W      = 68;
const RAIL_OPEN_W = 248;

function NavGroup({ item, openGroups, toggle, onNavigate, alerts, railOpen = true }) {
  const { key, label, icon: Icon, children } = item;
  const location = useLocation();
  /* Collapsed, a group is a lid. Without this the two counts that matter most
     — a form filed, a violation answered — sit under «إدارة المتعهدين» and are
     invisible until someone opens it. */
  const rollup = groupAlert(alerts || {}, children);
  /* A group holding the current page stays open regardless of what the admin
     last collapsed — otherwise the sidebar hides where you are. */
  const hasActive = children.some(c => location.pathname.startsWith(c.to));
  const open      = hasActive || !!openGroups[key];

  /* On the narrow rail there is no room for a disclosure list, so the group
     collapses to its children rendered flat as icons. The lid only exists when
     there are labels to hide. */
  if (!railOpen) {
    return (
      <div className="space-y-0.5">
        {children.map(child => (
          <NavItem key={child.to} item={child} onNavigate={onNavigate}
            alerts={alerts} expanded={false} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => toggle(key)}
        className={`w-full group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 ${
          hasActive ? 'text-white font-bold' : 'text-white/80 font-semibold hover:text-white hover:bg-white/[0.05]'
        }`}
        style={{ width: 'calc(100% - 1rem)' }}
      >
        <span
          className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 border transition-transform duration-150 group-hover:scale-105"
          style={iconBox(hasActive)}
        >
          <Icon size={17} weight={hasActive ? 'fill' : 'duotone'}
            color={hasActive ? 'rgb(var(--c-accent))' : 'rgba(255,255,255,0.75)'} />
        </span>

        <span className="flex-1 text-[13px] text-right whitespace-nowrap">{label}</span>
        {!open && <Badge alert={rollup} />}
        <CaretDown size={11} weight="bold"
          className={`opacity-50 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {/* The rail makes the indent read as containment rather than as an
                accidental margin. */}
            <div className="mr-6 pr-1 my-0.5 space-y-0.5 border-r border-white/12">
              {children.map(child => (
                <NavItem key={child.to} item={child} nested
                  onNavigate={onNavigate} alerts={alerts} />
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

  /* The desktop sidebar is a 68px rail that widens on hover. Pinning it open is
     remembered, because an admin who works from the nav all day should not have
     to re-open it every morning. */
  const [railPinned, setRailPinned] = useState(
    () => localStorage.getItem('admin_rail_pinned') === '1'
  );
  const [railHover, setRailHover] = useState(false);
  const railOpen = railPinned || railHover;
  const toggleRailPin = () => setRailPinned(p => {
    localStorage.setItem('admin_rail_pinned', p ? '0' : '1');
    return !p;
  });

  const { alerts, see } = useSectionAlerts();
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
        counts[col] = rows.filter(d => rowTime(d) > lastSeen).length;
        setNewCount(Object.values(counts).reduce((a, b) => a + b, 0));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [lastSeen]);

  /* Opening a section is what «seen» means. For a queue this only calms the
     colour; for a feed of uploads it clears the count. */
  useEffect(() => { see(location.pathname); }, [location.pathname, see]);

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

  /* A plain function rather than a component, because declaring a component
     inside the render remounts the whole sidebar on every state change — which
     on a rail that expands on hover means the nav rebuilds sixty times a
     second. */
  const sidebarContent = (railOpen = true) => (
    <div className="flex flex-col h-full">

      {/* Logo — the lockup when there is width for it, the square mark when
          there is not. */}
      <div className={`relative border-b border-white/10 overflow-hidden flex items-center justify-center ${railOpen ? 'px-5 py-4' : 'px-2 py-4'}`}>
        {railOpen ? (
          <div className="relative flex flex-col items-center gap-1 cursor-default">
            <img src={brand.logo.fullOnDark} alt={brand.companyName}
              className="w-full max-w-[190px] h-auto" />
            <p className="text-[10px] font-semibold tracking-widest uppercase opacity-40 text-white">لوحة الإدارة</p>
          </div>
        ) : (
          <img src={brand.logo.icon} alt={brand.companyName}
            className="w-9 h-9 rounded-lg" />
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden ${railOpen ? 'px-1' : 'px-0'}`}>
        {NAV.map(item =>
          item.children
            ? <NavGroup key={item.key} item={item} openGroups={openGroups} railOpen={railOpen}
                toggle={toggleGroup} onNavigate={() => setOpen(false)} alerts={alerts} />
            : <NavItem key={item.to} item={item} expanded={railOpen}
                onNavigate={() => setOpen(false)} alerts={alerts} />,
        )}
      </nav>

      {/* Profile + Logout */}
      <div className={`py-3 border-t border-white/10 ${railOpen ? 'px-4' : 'px-2'}`}>
        <div className={`flex items-center gap-3 mb-2 ${railOpen ? 'px-1' : 'justify-center'}`}>
          <span
            title={railOpen ? undefined : (profile?.nameAr || profile?.name || 'المشرف')}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary flex items-center justify-center flex-shrink-0 shadow-md cursor-default"
          >
            <span className="text-white text-sm font-bold">
              {(profile?.nameAr || profile?.name)?.charAt(0) || 'أ'}
            </span>
          </span>
          {railOpen && (
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate">{profile?.nameAr || profile?.name || 'المشرف'}</p>
              <p className="text-white/40 text-[10px] truncate">{profile?.email || ''}</p>
            </div>
          )}
        </div>

        {/* Centers */}
        {railOpen && profile?.centers?.length > 0 && (
          <div className="mb-2 px-1 max-h-24 overflow-y-auto space-y-1">
            {profile.centers.map(cid => (
              <div key={cid} className="bg-white/5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 transition-colors duration-150">
                <p className="text-primary text-[10px] font-bold">{cid}</p>
                <p className="text-white/50 text-[10px] truncate leading-tight">
                  {profile.caterers?.[cid] || getCaterer(cid)}
                </p>
              </div>
            ))}
          </div>
        )}
        {railOpen && profile?.center && !profile?.centers?.length && (
          <div className="mb-2 px-1">
            <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
              <p className="text-primary text-[10px] font-bold">{profile.center}</p>
              <p className="text-white/50 text-[10px] truncate leading-tight">
                {profile.caterer || getCaterer(profile.center)}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={railOpen ? undefined : 'تسجيل الخروج'}
          className={`w-full flex items-center gap-2.5 py-2.5 rounded-xl text-white/55 hover:bg-red-500/15 hover:text-red-300 text-sm transition-colors duration-200 disabled:opacity-50 ${
            railOpen ? 'px-3' : 'justify-center px-0'
          }`}
        >
          {loggingOut
            ? <span className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin flex-shrink-0" />
            : <LogOut size={16} weight="regular" className="flex-shrink-0" />}
          {railOpen && (
            <span className="text-xs font-semibold whitespace-nowrap">
              {loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="flex h-screen font-arabic overflow-hidden bg-canvas"
      style={{ fontFamily: 'var(--font-arabic), Tahoma, sans-serif' }}>

      {/* Desktop sidebar — a 68px rail that widens over the canvas on hover.
          The spacer holds the rail's collapsed width in the flex row so the
          content never reflows when the overlay opens. */}
      <div
        className="hidden lg:block flex-shrink-0 transition-[width] duration-200"
        style={{ width: railPinned ? RAIL_OPEN_W : RAIL_W }}
      />
      <aside
        onMouseEnter={() => setRailHover(true)}
        onMouseLeave={() => setRailHover(false)}
        className="hidden lg:flex flex-col fixed inset-y-0 right-0 z-30 transition-[width] duration-200 ease-out overflow-hidden"
        style={{
          width: railOpen ? RAIL_OPEN_W : RAIL_W,
          background: 'linear-gradient(180deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary-700)) 55%, rgb(var(--c-primary-900)) 100%)',
          boxShadow: railOpen && !railPinned ? '0 0 40px -8px rgb(0 0 0 / 0.45)' : undefined,
        }}
      >
        {sidebarContent(railOpen)}

        {/* Pin — only offered once the rail is open, since collapsed there is
            no room and nothing to pin. */}
        {railOpen && (
          <button
            onClick={toggleRailPin}
            title={railPinned ? 'إلغاء التثبيت' : 'تثبيت القائمة'}
            className={`absolute top-4 left-3 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              railPinned ? 'bg-accent/20 text-accent' : 'bg-white/10 text-white/50 hover:text-white hover:bg-white/20'
            }`}
          >
            <PushPin size={13} weight={railPinned ? 'fill' : 'bold'} />
          </button>
        )}
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
              {sidebarContent(true)}
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

          <div className="relative flex items-center gap-3 min-w-0">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="فتح القائمة"
            >
              <PanelLeft size={22} weight="bold" />
            </button>

            {/* Where you are. The bar used to say only which season it is, which
                every screen already knew; the one fact it never carried was the
                name of the page under it. */}
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.16em] text-accent/70 uppercase leading-none">
                لوحة الإدارة
              </p>
              <p className="text-[15px] font-bold text-white truncate leading-tight mt-1.5">
                {LABEL_BY_PATH[location.pathname] || brand.companyName}
              </p>
            </div>

            {/* The season, spent as one gold outline rather than a filled plate.
                Derived from today's Hijri date rather than from the season row:
                a label that says which Hajj season we are in must follow the
                calendar, not a record someone forgot to roll over. */}
            <span
              className="hidden sm:flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-full border"
              style={goldChip}
            >
              <MoonStars size={13} weight="fill" className="text-accent" />
              <span className="text-[11px] font-bold text-accent tabular-nums whitespace-nowrap">
                موسم {hijriYear}هـ
              </span>
            </span>
          </div>

          {/* Centred, and given the slack so the two counts sit in the middle
              of the bar rather than drifting with the width of what flanks
              them. Two counts an operations lead checks first thing, each a
              shortcut to the screen that clears it. */}
          <div className="relative flex-1 hidden md:flex items-center justify-center gap-1">
            <HeaderStat count={alerts['/admin/reports']?.n || 0} label="بلاغ معلّق"  Icon={Siren}
              onClick={() => navigate('/admin/reports')} />
            <span className="w-px h-7 bg-white/12" />
            <HeaderStat count={logisticsCount} label="إسناد معلّق" Icon={Boxes}
              onClick={() => navigate('/admin/logistics')} />
          </div>
          <div className="flex-1 md:hidden" />

          {/* Clock and bell travel together at the far end. */}
          <div className="relative flex items-center gap-3 flex-shrink-0">
            <HeaderClock />

            <span className="hidden md:block w-px h-7 bg-white/12" />

            {/* One icon button carrying its own count, the way a bell is spelled
                everywhere else. The label that used to sit beside it said
                "التنبيهات" on a screen whose only bell is this one. */}
            <button
              onClick={() => navigate('/admin/notifications')}
              className="relative w-9 h-9 rounded-[11px] flex items-center justify-center border flex-shrink-0 transition-colors"
              style={{
                background:  newCount > 0 ? 'rgb(var(--c-accent) / 0.16)' : 'rgb(255 255 255 / 0.06)',
                borderColor: newCount > 0 ? 'rgb(var(--c-accent) / 0.5)'  : 'rgb(255 255 255 / 0.12)',
              }}
              aria-label="التنبيهات"
            >
              <BellRing size={17} weight="fill"
                style={{
                  color: newCount > 0 ? 'rgb(var(--c-accent))' : 'rgb(255 255 255 / 0.6)',
                  animation: newCount > 0 ? 'bellSwing 2.4s ease-in-out infinite' : undefined,
                }} />
              {newCount > 0 && (
                <span
                  className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500
                             text-white text-[10px] font-bold tabular-nums flex items-center justify-center
                             ring-2 ring-[rgb(var(--c-primary))]"
                  style={{ animation: 'badgePulse 2s ease-in-out infinite' }}
                >
                  {newCount > 99 ? '99+' : newCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-canvas p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Global toast notifications for new readiness uploads */}
      <UploadToastListener />
      <ToastStack />

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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; }
      `}</style>

      {/* Ctrl K, mounted at the shell so it answers from any section. */}
      <CommandPalette sections={SECTIONS} />
    </div>
  );
}
