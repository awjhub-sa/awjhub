import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase.js';
import { db as supaDb, rowFromDb } from '../../lib/db.js';
import {
  ForkKnife as Utensils,
  Warning as AlertTriangle,
  Bell,
  User,
  CaretDown as ChevronDown,
  CaretLeft as ChevronLeft,
  TrendUp as TrendingUp,
  ClipboardText as ClipboardCheck,
  MapPin,
  House as HomeIcon,
  Mountains as Mountain,
  Buildings as Building2,
  Package,
  Clock,
  SignOut as LogOut,
  CheckCircle as CheckCircle2,
  ArrowsLeftRight as ArrowLeftRight,
  CircleNotch as Loader2,
  Envelope as Mail,
  Hash,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import TodayMenuCard from '../../components/TodayMenuCard.jsx';
import { formatHijri } from '../../lib/hijri.js';
import { BRAND } from '../../config/brand.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const NAVY  = 'rgb(var(--c-primary))';
const INFO  = 'rgb(var(--c-info))';
const RED   = '#DC2626';
const GREEN = '#15803D';
const AMBER = '#D97706';

const GoldRule = () => (
  <svg width="100" height="6" viewBox="0 0 100 6" fill="none">
    <line x1="0" y1="3" x2="32" y2="3" stroke="rgb(var(--c-primary))" strokeWidth="0.75" />
    <circle cx="40" cy="3" r="1.2" fill="rgb(var(--c-primary))" opacity="0.5" />
    <circle cx="50" cy="3" r="2.5" fill="rgb(var(--c-primary))" />
    <circle cx="60" cy="3" r="1.2" fill="rgb(var(--c-primary))" opacity="0.5" />
    <line x1="68" y1="3" x2="100" y2="3" stroke="rgb(var(--c-primary))" strokeWidth="0.75" />
  </svg>
);

/* One chip at one size. The tint is derived from the status colour so a row of
   them reads as a family rather than a paint chart. */
const Chip = ({ children, color, Icon }) => (
  <span
    className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded-md leading-none whitespace-nowrap"
    style={{ background: tint(color, 11), color }}
  >
    {Icon && <Icon size={10} weight="bold" />}
    {children}
  </span>
);

const MenuCard = ({ icon: Icon, title, subtitle, badge, doneBadge, onClick, color = NAVY }) => (
  <button
    onClick={onClick}
    type="button"
    className="group/menu relative w-full text-start rounded-[14px] border p-4 flex items-center gap-3.5 overflow-hidden
               shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]
               cursor-pointer transition-all duration-200 hover:-translate-y-0.5
               hover:shadow-[0_8px_22px_-8px_rgb(var(--c-ink)/0.22)]
               active:translate-y-0 active:shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
    style={{ background: tint(color, 12), borderColor: tint(color, 28) }}
  >
    <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: color }} />
    <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ms-1"
      style={{ background: tint(color, 9), borderColor: tint(color, 22) }}>
      <Icon size={21} weight="duotone" style={{ color }} />
    </span>

    <span className="flex-1 min-w-0">
      <span className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] font-bold text-ink">{title}</span>
        {badge && <Chip color={RED}>{badge}</Chip>}
        {doneBadge && <Chip color={GREEN} Icon={CheckCircle2}>{doneBadge}</Chip>}
      </span>
      {subtitle && <span className="block text-[11.5px] font-medium text-muted mt-1.5 truncate">{subtitle}</span>}
    </span>

    <ChevronLeft size={15} weight="bold" className="shrink-0 text-muted/40 group-hover/menu:text-muted transition-colors" />
  </button>
);

const ACTIVITY_CFG = {
  reports:           { label: 'بلاغ طارئ',      Icon: AlertTriangle,  color: RED },
  meal_evaluations:  { label: 'تقييم وجبات',      Icon: Utensils,       color: NAVY },
  mina_readiness:    { label: 'جاهزية منى',        Icon: HomeIcon,       color: '#3D6795' },
  arafat_readiness:  { label: 'جاهزية عرفة',      Icon: Mountain,       color: '#9E5741' },
  logistics_requests:{ label: 'طلب إسناد',         Icon: Package,        color: INFO },
  task_completions:  { label: 'مهمة مكتملة',      Icon: ClipboardCheck, color: GREEN },
};

const TASK_TYPE_LABELS = {
  meal_evaluation:  'تقييم جودة الوجبات',
  mina_readiness:   'جاهزية مشعر منى',
  arafat_readiness: 'جاهزية مشعر عرفة',
};
const TASK_TYPE_META = {
  meal_evaluation:  { Icon: Utensils, color: NAVY },
  mina_readiness:   { Icon: HomeIcon, color: '#3D6795' },
  arafat_readiness: { Icon: Mountain, color: '#9E5741' },
};
const MEAL_LABELS = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };

function StatMini({ label, value, accent, Icon }) {
  return (
    <div
      className="rounded-[14px] border p-3.5 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
      style={{ background: tint(accent, 12), borderColor: tint(accent, 28) }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-muted truncate">{label}</p>
        <Icon size={16} weight="duotone" style={{ color: accent }} className="shrink-0 mt-px" />
      </div>
      <p className="text-[26px] font-extrabold tabular-nums leading-none mt-3" style={{ color: accent }}>{value}</p>
    </div>
  );
}

/* The register row. The leading rail carries the row's category so the body can
   stay typography rather than a shelf of coloured boxes. */
function Row({ color, Icon, last, onClick, children }) {
  /* A register row cannot lift without tearing the divider it sits on, so it
     answers the pointer the way the shared ListRow does: the surface warms and
     the category rail thickens. Rendered inert when there is nowhere to go. */
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag onClick={onClick}
      type={clickable ? 'button' : undefined}
      className={`group/row relative w-full text-start flex items-center gap-3.5 ps-5 pe-4 py-3.5
                  transition-colors ${last ? '' : 'border-b border-line'}
                  ${clickable ? 'cursor-pointer hover:bg-[rgb(var(--c-bg))] active:bg-[rgb(var(--c-line)/0.5)]' : ''}`}
    >
      <span className={`absolute inset-y-0 start-0 w-[3px] transition-all duration-200 ${
        clickable ? 'group-hover/row:w-[5px]' : ''}`} style={{ background: color }} />
      <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover/row:scale-105"
        style={{ background: tint(color, 9), borderColor: tint(color, 22) }}>
        <Icon size={18} weight="duotone" style={{ color }} />
      </span>
      <span className="flex-1 min-w-0">{children}</span>
      {clickable && (
        <ChevronLeft size={15} weight="bold"
          className="shrink-0 text-muted/40 transition-all duration-200
                     group-hover/row:text-muted group-hover/row:-translate-x-0.5" />
      )}
    </Tag>
  );
}

function PendingTaskRow({ task, onClick }) {
  const meta = TASK_TYPE_META[task.taskType] || TASK_TYPE_META.meal_evaluation;
  const label = TASK_TYPE_LABELS[task.taskType] || task.taskType;
  const mealLabel = task.mealType ? MEAL_LABELS[task.mealType] || task.mealType : null;
  return (
    <Row color={meta.color} Icon={meta.Icon} onClick={onClick}>
      <span className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[13.5px] font-bold text-ink leading-tight">{label}</span>
        {mealLabel && <Chip color={meta.color}>{mealLabel}</Chip>}
      </span>
      <span className="block text-[11.5px] text-muted mt-1.5 truncate">
        <span className="font-medium text-ink/75">{task.center}</span>
        {task.scheduledDate && <> · <span className="font-medium">{task.scheduledDate}</span></>}
      </span>
    </Row>
  );
}

const REPORT_STATUS_LBL = {
  pending:     { label: 'قيد الانتظار', color: AMBER },
  in_progress: { label: 'جارٍ التنفيذ', color: INFO },
};
const LOGISTICS_STATUS_LBL = {
  pending:  { label: 'قيد الانتظار', color: AMBER },
  approved: { label: 'معتمد',        color: INFO },
};

function ReportRow({ report, onClick }) {
  const status = REPORT_STATUS_LBL[report.status] || REPORT_STATUS_LBL.pending;
  return (
    <Row color={RED} Icon={AlertTriangle} onClick={onClick}>
      <span className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[13.5px] font-bold text-ink leading-tight truncate">بلاغ ميداني</span>
        {report.reportNumber && <Chip color={RED}>#{report.reportNumber}</Chip>}
        <Chip color={status.color}>{status.label}</Chip>
      </span>
      <span className="block text-[11.5px] text-muted mt-1.5 truncate">
        <span className="font-medium text-ink/75">{report.center}</span>
        {report.observer && <> · بواسطة: <span className="font-medium text-ink/75">{report.observer}</span></>}
      </span>
    </Row>
  );
}

function LogisticsRow({ item, onClick }) {
  const status = LOGISTICS_STATUS_LBL[item.status] || LOGISTICS_STATUS_LBL.pending;
  return (
    <Row color={INFO} Icon={Package} onClick={onClick}>
      <span className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[13.5px] font-bold text-ink leading-tight truncate">طلب إسناد</span>
        {item.requestNumber && <Chip color={INFO}>#{item.requestNumber}</Chip>}
        <Chip color={status.color}>{status.label}</Chip>
      </span>
      <span className="block text-[11.5px] text-muted mt-1.5 truncate">
        <span className="font-medium text-ink/75">{item.center}</span>
        {item.observer && <> · بواسطة: <span className="font-medium text-ink/75">{item.observer}</span></>}
      </span>
    </Row>
  );
}

function CenterCard({ centerId, stats, onClick }) {
  const pending   = stats?.pending   ?? 0;
  const completed = stats?.completed ?? 0;
  const total     = stats?.total     ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const bar = pct === 100 ? GREEN : pct > 0 ? AMBER : NAVY;
  return (
    <button onClick={onClick}
      type="button"
      className="group text-start rounded-[14px] border p-4 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]
                 cursor-pointer transition-all duration-200 hover:-translate-y-0.5
                 hover:shadow-[0_8px_22px_-8px_rgb(var(--c-ink)/0.22)]
                 active:translate-y-0 active:shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
      style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}
    >
      <div className="flex items-center gap-2.5 mb-3 min-w-0">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
          style={{ background: tint(NAVY, 9), borderColor: tint(NAVY, 22) }}>
          <Building2 size={15} weight="duotone" style={{ color: NAVY }} />
        </span>
        <p className="text-[13px] font-bold text-ink truncate">{centerId}</p>
      </div>
      {total === 0 ? (
        <p className="text-[11px] text-muted font-medium">لا توجد مهام مُسندة</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-[10.5px] font-bold mb-1.5">
            <span className="text-muted">التقدم</span>
            <span className="tabular-nums" style={{ color: bar }}>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: tint(NAVY, 22) }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: bar }} />
          </div>
          <div className="flex items-center justify-between mt-2.5 text-[10.5px] font-bold">
            <span style={{ color: AMBER }}>{pending} معلّقة</span>
            <span style={{ color: GREEN }}>{completed} مكتملة</span>
          </div>
        </>
      )}
    </button>
  );
}

const STATUS_DATA = {
  pending:     { label: 'قيد الانتظار', color: AMBER },
  in_progress: { label: 'جارٍ التنفيذ', color: INFO },
  resolved:    { label: 'تم الحل',      color: GREEN },
};

export default function SupervisorHome() {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const [clock, setClock] = useState({ hijri: '', time: '' });
  const [activities, setActivities] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [assignedCenters, setAssignedCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [assignedForCenter,    setAssignedForCenter]    = useState([]);
  const [completionsForCenter, setCompletionsForCenter] = useState([]);
  const [notifOpen,      setNotifOpen]      = useState(false);
  const [globalNotifs,   setGlobalNotifs]   = useState([]);  // cross-center observer notifs
  const [observerNotifs, setObserverNotifs] = useState([]);  // per-center activity feed
  const [view, setView] = useState('actions');  // 'actions' | 'menu' | 'activity'

  const [allAssignedTasks, setAllAssignedTasks] = useState([]);
  const [allCompletions,   setAllCompletions]   = useState([]);
  const [openReports,      setOpenReports]      = useState([]);
  const [openLogistics,    setOpenLogistics]    = useState([]);

  useEffect(() => {
    const fetchCenters = async () => {
      if (!user?.uid) return;
      try {
        const userRow = await supaDb.users.get(user.uid);
        if (userRow) {
          const centers = userRow.assignedCenters || userRow.centers || [];
          const sorted = [...centers].sort((a, b) => {
            const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
            const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
            return numA - numB;
          });
          setAssignedCenters(sorted);
          /* Default to the unified dashboard (null). Center context only
             activates when supervisor explicitly drills into a center. */
          const saved = sessionStorage.getItem('sup_selected_center');
          setSelectedCenter(saved && sorted.includes(saved) ? saved : null);
        }
      } catch (e) { console.error(e); }
      finally { setLoadingData(false); }
    };
    fetchCenters();

    const tick = () => {
      const now = new Date();
      setClock({
        hijri: formatHijri(now),
        time: now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', hour12: true }),
      });
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!selectedCenter || !user?.uid) return;
    /* Clear stale per-center state immediately on switch so we never flash
       the previous center's completed badges before new data arrives. */
    setActivities([]);
    setCompletionsForCenter([]);
    setObserverNotifs([]);
    setAssignedForCenter([]);

    const todayMs = new Date().setHours(0, 0, 0, 0);

    /* Regular activity collections — meals/mina/arafat are excluded because
       they each create a corresponding task_completions row, which already
       produces a "تم الرفع" notification. Listening to both was causing the
       supervisor's feed to show every evaluation twice. */
    let mounted = true;
    const regularCols = ['reports', 'logistics_requests'];
    const loadCol = async (col) => {
      const { data } = await supabase.from(col).select('*').eq('center', selectedCenter);
      if (!mounted) return;
      const docs = (data || []).map(rowFromDb)
        .map(d => ({ ...d, _col: col, _sortTs: d.timestamp?.toMillis?.() || 0 }))
        .filter(d => d._sortTs >= todayMs);
      setActivities(prev => {
        const others = prev.filter(a => a._col !== col);
        return [...others, ...docs].sort((a, b) => (b._sortTs || 0) - (a._sortTs || 0));
      });
    };
    const channels = regularCols.map(col => {
      loadCol(col);
      return supabase.channel(`sup-${col}-${selectedCenter}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: col }, () => loadCol(col))
        .subscribe();
    });

    /* assigned_tasks for this center */
    const unsubAssigned = supaDb.assigned_tasks.subscribe(rows =>
      setAssignedForCenter(rows.filter(t => (t.targetCenters || []).includes(selectedCenter)))
    );

    /* task_completions */
    const unsubTc = supaDb.task_completions.subscribe(rows => {
      const allDocs = rows.filter(c => c.center === selectedCenter);
      setCompletionsForCenter(allDocs);
      const todayCompletions = allDocs
        .filter(d => d.uid !== user.uid && (d.timestamp?.toMillis?.() || 0) >= todayMs)
        .map(d => ({ ...d, _col: 'task_completions', _sortTs: d.timestamp?.toMillis?.() || 0 }));
      setObserverNotifs(todayCompletions);
      setActivities(prev => {
        const others = prev.filter(a => a._col !== 'task_completions');
        const withTs = others.map(a => ({ ...a, _sortTs: a._sortTs ?? (a.timestamp?.toMillis?.() || 0) }));
        return [...withTs, ...todayCompletions].sort((a, b) => (b._sortTs || 0) - (a._sortTs || 0));
      });
    });

    return () => {
      mounted = false;
      channels.forEach(ch => supabase.removeChannel(ch));
      unsubAssigned(); unsubTc();
    };
  }, [selectedCenter, user?.uid]);

  /* Cross-center listeners: tracks every assigned task and every completion
     across ALL of the supervisor's assigned centers — drives the unified
     dashboard's pending list, stats cards, and bell notifications. */
  useEffect(() => {
    if (!user?.uid || !assignedCenters.length) {
      setGlobalNotifs([]);
      setAllAssignedTasks([]);
      setAllCompletions([]);
      setOpenReports([]);
      setOpenLogistics([]);
      return;
    }
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const allowed = new Set(assignedCenters);

    const unsubAssigned = supaDb.assigned_tasks.subscribe(rows => {
      setAllAssignedTasks(
        rows.filter(t => (t.targetCenters || []).some(c => allowed.has(c)))
      );
    });

    const unsubCompletions = supaDb.task_completions.subscribe(rows => {
      const all = rows.filter(c => allowed.has(c.center));
      setAllCompletions(all);

      const notifs = all
        .filter(c => c.uid !== user.uid && (c.timestamp?.toMillis?.() || 0) >= todayMs)
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setGlobalNotifs(notifs);
    });

    /* Open field reports across all of the supervisor's centers — anything
       still pending or in-progress is actionable. Resolved are hidden. */
    const unsubReports = supaDb.reports.subscribe(rows => {
      const open = rows
        .filter(r => allowed.has(r.center) && r.status !== 'resolved')
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setOpenReports(open);
    });

    /* Same for logistics — delivered + rejected are terminal, hide them. */
    const unsubLogistics = supaDb.logistics_requests.subscribe(rows => {
      const open = rows
        .filter(r => allowed.has(r.center) && r.status !== 'delivered' && r.status !== 'rejected')
        .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setOpenLogistics(open);
    });

    return () => { unsubAssigned(); unsubCompletions(); unsubReports(); unsubLogistics(); };
  }, [user?.uid, assignedCenters]);

  const handleLogout = async () => {
    try {
      setIsProfileOpen(false);
      localStorage.clear();
      sessionStorage.removeItem('sup_selected_center');
      await logout();
      window.location.replace('./login');
    } catch (e) {
      console.error('Logout Error:', e);
      window.location.replace('./login');
    }
  };

  if (loadingData) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={40} />
    </div>
  );

  /* Task badges per center — only count completions whose taskType is still
     in the active assignment list for that center. */
  const activeTaskTypes = new Set(
    assignedForCenter.flatMap(t => t.taskTypes || [])
  );
  const taskBadges = {};
  completionsForCenter.forEach(c => {
    if (activeTaskTypes.has(c.taskType)) {
      taskBadges[c.taskType] = (taskBadges[c.taskType] || 0) + 1;
    }
  });

  /* Cross-center pending tasks — expand each assigned task into per-center
     and (for meal_evaluation) per-meal instances; a task is pending when no
     matching completion exists. */
  const pendingTasks = (() => {
    const list = [];
    const allowedCenters = new Set(assignedCenters);
    allAssignedTasks.forEach(task => {
      const centers = (task.targetCenters || [])
        .filter(c => allowedCenters.has(c));
      const types = task.taskTypes || [];
      centers.forEach(center => {
        types.forEach(type => {
          if (type === 'meal_evaluation') {
            (task.mealTypes || []).forEach(mealType => {
              const done = allCompletions.some(c =>
                c.taskId === task.id && c.center === center &&
                c.taskType === type && c.mealType === mealType
              );
              if (!done) list.push({
                key: `${task.id}__${center}__${type}__${mealType}`,
                taskId: task.id, center, taskType: type, mealType,
                scheduledDate: task.scheduledDate,
                createdAt: task.createdAt?.toMillis?.() || 0,
              });
            });
          } else {
            const done = allCompletions.some(c =>
              c.taskId === task.id && c.center === center && c.taskType === type
            );
            if (!done) list.push({
              key: `${task.id}__${center}__${type}`,
              taskId: task.id, center, taskType: type, mealType: null,
              scheduledDate: task.scheduledDate,
              createdAt: task.createdAt?.toMillis?.() || 0,
            });
          }
        });
      });
    });
    return list.sort((a, b) => b.createdAt - a.createdAt);
  })();

  const centerStats = (() => {
    const map = {};
    assignedCenters.forEach(c => { map[c] = { pending: 0, completed: 0, total: 0 }; });
    pendingTasks.forEach(p => {
      if (map[p.center]) {
        map[p.center].pending += 1;
        map[p.center].total += 1;
      }
    });
    /* Count completions matching active tasks only */
    const activeTaskIds = new Set(allAssignedTasks.map(t => t.id));
    allCompletions.forEach(c => {
      if (map[c.center] && activeTaskIds.has(c.taskId)) {
        map[c.center].completed += 1;
        map[c.center].total += 1;
      }
    });
    return map;
  })();

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const completedToday = allCompletions.filter(c =>
    (c.timestamp?.toMillis?.() || 0) >= todayMs
  ).length;

  /* Navigate to the correct upload page for a pending task */
  const goToTaskUpload = (task) => {
    const stateObj = { centerId: task.center };
    const map = {
      meal_evaluation:  '/sup-mealcheck',
      mina_readiness:   '/sup-mina-readiness',
      arafat_readiness: '/sup-arafat-readiness',
    };
    navigate(map[task.taskType] || '/sup-mealcheck', { state: stateObj });
  };

  const caterer = getCaterer(selectedCenter) || '—';
  const displayed = showAll ? activities : activities.slice(0, 4);

  return (
    <div dir="rtl" className="min-h-screen bg-canvas font-arabic pb-10 overflow-x-hidden text-start">

      {(isSheetOpen || isProfileOpen) && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300"
          onClick={() => { setIsSheetOpen(false); setIsProfileOpen(false); }}
        />
      )}

      {notifOpen && (
        <div
          className="fixed inset-0 z-[40]"
          onClick={() => setNotifOpen(false)}
        />
      )}

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={BRAND.logo.icon} alt={BRAND.companyName} className="w-10 h-10" />
            <div>
              <p className="text-[12px] font-bold text-ink">{BRAND.companyName}</p>
              <p className="text-[10px] font-semibold text-muted leading-tight mt-0.5">لوحة تحكم المشرف</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="w-10 h-10 rounded-[10px] border border-line flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors relative"
              >
                <Bell size={18} weight="duotone" className="text-muted" />
                {globalNotifs.length > 0 && (
                  <span
                    className="absolute -top-1 -left-1 min-w-[19px] h-[19px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white tabular-nums"
                    style={{ background: RED }}
                  >
                    {globalNotifs.length > 99 ? '99+' : globalNotifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute top-12 left-0 w-80 max-w-[90vw] bg-white border border-line rounded-[14px] shadow-[0_12px_34px_-10px_rgb(var(--c-ink)/0.28)] z-[102] overflow-hidden">
                  <div
                    className="px-4 py-3 border-b flex items-center justify-between"
                    style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}
                  >
                    <span className="text-[13px] font-bold" style={{ color: NAVY }}>إشعارات اليوم</span>
                    <span className="text-[10.5px] font-bold text-muted">{globalNotifs.length} جديد</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {globalNotifs.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell size={24} weight="duotone" className="mx-auto text-muted/35" />
                        <p className="text-[12.5px] font-semibold text-muted mt-2.5">لا توجد إشعارات اليوم</p>
                      </div>
                    ) : (
                      globalNotifs.map(n => (
                        <div key={n.id} className="px-4 py-3 border-b border-line last:border-b-0">
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2 size={14} weight="duotone" style={{ color: GREEN }} className="mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0 text-start">
                              <p className="text-[12.5px] font-bold text-ink leading-snug">
                                تم رفع {TASK_TYPE_LABELS[n.taskType] || n.taskType}
                                {n.mealType ? ` — ${MEAL_LABELS[n.mealType] || ''}` : ''}
                              </p>
                              <p className="text-[11px] font-medium text-ink/75 mt-1">
                                {n.center} · بواسطة: {n.observerName || 'مراقب'}
                              </p>
                              <p className="text-[10px] font-medium text-muted mt-1 tabular-nums">
                                {new Date(n.timestamp?.toMillis?.() || 0).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-[10px] border border-line flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors"
            >
              <User size={18} weight="duotone" className="text-muted" />
            </button>
          </div>
        </div>
      </header>

      {!selectedCenter && (
        <main className="max-w-5xl mx-auto px-4 md:px-8 py-6 pb-32 space-y-6">

          {/* Welcome strip */}
          <div className="animate-fade-slide-up rounded-[14px] border p-5 sm:p-6 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
            style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase leading-none text-primary/55">مرحباً (مشرف ميداني)،</p>
                <h2 className="text-[21px] sm:text-[23px] font-extrabold text-ink mt-1.5 truncate leading-tight">{profile?.nameAr || profile?.name || 'المشرف الميداني'}</h2>
                <div className="flex items-center gap-1.5 mt-2">
                  <MapPin size={13} weight="duotone" style={{ color: NAVY }} />
                  <span className="text-[12px] font-bold" style={{ color: NAVY }}>
                    {assignedCenters.length} {assignedCenters.length === 1 ? 'مركز' : 'مراكز'} ضمن نطاقك
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-[11px] px-4 py-2.5 border shrink-0 self-start flex sm:flex-col items-center sm:text-center gap-2 sm:gap-0"
                style={{ borderColor: tint(NAVY, 22) }}>
                <Clock size={13} weight="duotone" className="text-muted sm:hidden" />
                <p className="text-[10px] font-semibold text-muted sm:mb-1">{clock.hijri}</p>
                <p className="text-[13px] font-bold text-ink tabular-nums">{clock.time}</p>
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatMini label="مهام معلّقة"  value={pendingTasks.length}      accent={RED}   Icon={Clock} />
            <StatMini label="مكتملة اليوم" value={completedToday}           accent={GREEN} Icon={CheckCircle2} />
            <StatMini label="مراكز مُسندة" value={assignedCenters.length}   accent={INFO}  Icon={Building2} />
            <StatMini label="مهام مُسندة"  value={allAssignedTasks.length}  accent={NAVY}  Icon={ClipboardCheck} />
          </div>

          {/* TEMP: Sweep mode banner — tap to start sweeping any center freely.
              Remove this block (and the buttons inside it) to restore the
              assigned-task-only flow. */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MenuCard icon={MapPin} title="جاهزية منى" color="#3D6795"
              onClick={() => navigate('/sup-mina-readiness', { state: { sweepMode: true } })} />
            <MenuCard icon={Mountain} title="جاهزية عرفة" color="#9E5741"
              onClick={() => navigate('/sup-arafat-readiness', { state: { sweepMode: true } })} />
          </section>

          {view === 'actions' && (<>
          {/* Pending tasks (cross-center) */}
          {(() => {
            const totalActionable = pendingTasks.length + openReports.length + openLogistics.length;
            return (
          <section className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b flex items-center justify-between gap-3"
              style={{ background: tint(RED, 12), borderColor: tint(RED, 28) }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                  style={{ background: tint(RED, 9), borderColor: tint(RED, 22) }}>
                  <Clock size={18} weight="duotone" style={{ color: RED }} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-bold leading-tight" style={{ color: RED }}>مهام تحتاج إجراء</h2>
                  <p className="text-[11.5px] text-muted mt-1 font-medium truncate">
                    {totalActionable === 0
                      ? 'كل شيء مكتمل 🎉'
                      : `${totalActionable} ${totalActionable === 1 ? 'بند' : 'بنود'} عبر مراكزك`}
                  </p>
                </div>
              </div>
              {totalActionable > 0 && <Chip color={RED}>{totalActionable}</Chip>}
            </div>

            {totalActionable === 0 ? (
              <div className="py-14 px-5 text-center">
                <CheckCircle2 size={26} weight="duotone" className="mx-auto" style={{ color: GREEN }} />
                <p className="text-[13px] font-semibold mt-3" style={{ color: GREEN }}>جميع البنود مكتملة!</p>
                <p className="text-[11.5px] font-medium text-muted/70 mt-1">لا توجد مهام أو بلاغات أو طلبات معلّقة</p>
              </div>
            ) : (
              <div className="[&>*:last-child]:border-b-0">
                {pendingTasks.slice(0, 10).map(task => (
                  <PendingTaskRow key={task.key} task={task} onClick={() => goToTaskUpload(task)} />
                ))}

                {openReports.slice(0, 10).map(r => (
                  <ReportRow key={`report-${r.id}`} report={r}
                    onClick={() => {
                      setSelectedCenter(r.center);
                      sessionStorage.setItem('sup_selected_center', r.center);
                      setView('activity');
                    }} />
                ))}

                {openLogistics.slice(0, 10).map(l => (
                  <LogisticsRow key={`log-${l.id}`} item={l}
                    onClick={() => {
                      setSelectedCenter(l.center);
                      sessionStorage.setItem('sup_selected_center', l.center);
                      setView('activity');
                    }} />
                ))}
              </div>
            )}

            {(pendingTasks.length > 10 || openReports.length > 10 || openLogistics.length > 10) && (
              <div className="px-5 py-3 bg-[rgb(var(--c-bg))] border-t border-line text-center">
                <p className="text-[11.5px] text-muted font-medium">
                  معروض ١٠ من كل فئة
                </p>
              </div>
            )}
          </section>
            );
          })()}

          {/* Centers grid — actions tab */}
          <section className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b flex items-center gap-3"
              style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}>
              <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                style={{ background: tint(NAVY, 9), borderColor: tint(NAVY, 22) }}>
                <Building2 size={18} weight="duotone" style={{ color: NAVY }} />
              </span>
              <h2 className="text-[14px] font-bold leading-tight" style={{ color: NAVY }}>مراكزي</h2>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {assignedCenters.map(c => (
                <CenterCard key={c} centerId={c} stats={centerStats[c]}
                  onClick={() => {
                    setSelectedCenter(c);
                    sessionStorage.setItem('sup_selected_center', c);
                  }}
                />
              ))}
            </div>
          </section>
          </>)}

          {/* Today's activity feed (cross-center) — ORIGINAL POSITION (will be hidden in old slot) */}
          {view === 'activity' && (
          <section className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b flex items-center gap-3"
              style={{ background: tint(GREEN, 12), borderColor: tint(GREEN, 28) }}>
              <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                style={{ background: tint(GREEN, 9), borderColor: tint(GREEN, 22) }}>
                <ClipboardCheck size={18} weight="duotone" style={{ color: GREEN }} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[14px] font-bold leading-tight" style={{ color: GREEN }}>نشاط اليوم</h2>
                <p className="text-[11.5px] text-muted mt-1 font-medium truncate">
                  {globalNotifs.length === 0 ? 'لا يوجد رفع اليوم بعد' : `${globalNotifs.length} رفع من مراقبيك`}
                </p>
              </div>
            </div>
            <div className="[&>*:last-child]:border-b-0">
              {globalNotifs.length === 0 ? (
                <div className="py-14 px-5 text-center">
                  <Clock size={26} weight="duotone" className="mx-auto text-muted/35" />
                  <p className="text-[13px] font-semibold text-muted mt-3">لا يوجد نشاط من المراقبين اليوم</p>
                </div>
              ) : (
                globalNotifs.slice(0, 8).map(n => (
                  <div key={n.id} className="relative flex items-center gap-3.5 ps-5 pe-4 py-3.5 border-b border-line">
                    <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: GREEN }} />
                    <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                      style={{ background: tint(GREEN, 9), borderColor: tint(GREEN, 22) }}>
                      <CheckCircle2 size={18} weight="duotone" style={{ color: GREEN }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold text-ink truncate leading-tight">
                        تم رفع {TASK_TYPE_LABELS[n.taskType] || n.taskType}
                        {n.mealType ? ` — ${MEAL_LABELS[n.mealType] || ''}` : ''}
                      </p>
                      <p className="text-[11.5px] text-muted mt-1.5 truncate">
                        <span className="font-medium text-ink/75">{n.center}</span> · بواسطة: {n.observerName || 'مراقب'}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted font-bold tabular-nums shrink-0">
                      {new Date(n.timestamp?.toMillis?.() || 0).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
          )}

          {/* Today's menu — supervisor sees menu per assigned center */}
          {view === 'menu' && assignedCenters.length > 0 && (
            <TodayMenuCard centerIds={assignedCenters} />
          )}
        </main>
      )}

      {selectedCenter && (
      <main className="max-w-5xl mx-auto px-4 md:px-8 pb-32 space-y-6">
        <button
          onClick={() => { setSelectedCenter(null); sessionStorage.removeItem('sup_selected_center'); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[11px] border border-line bg-white hover:bg-[rgb(var(--c-bg))] text-ink text-[12px] font-bold transition-colors"
        >
          <ChevronLeft size={14} weight="bold" />
          العودة للوحة الرئيسية
        </button>

        <div className="space-y-6">
          {/* Header card always visible */}

          <div className="animate-fade-slide-up rounded-[14px] border overflow-hidden shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
            style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}>
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.18em] uppercase leading-none text-primary/55">مرحباً بك (مشرف)،</p>
                  <h2 className="text-[21px] sm:text-[23px] font-extrabold text-ink mt-1.5 truncate leading-tight">{profile?.nameAr || profile?.name || 'المشرف الميداني'}</h2>
                  <div className="flex items-center gap-1.5 mt-2">
                    <MapPin size={13} weight="duotone" style={{ color: NAVY }} />
                    <span className="text-[12px] font-bold" style={{ color: NAVY }}>نطاق الإشراف الميداني</span>
                  </div>
                </div>
                <button onClick={() => setIsSheetOpen(true)}
                  className="bg-white hover:bg-[rgb(var(--c-bg))] transition-colors rounded-[11px] px-4 py-2.5 text-center border flex flex-col items-center min-w-[100px] shrink-0"
                  style={{ borderColor: tint(NAVY, 22) }}>
                  <p className="text-[10px] font-semibold text-muted mb-1">المركز الحالي</p>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[17px] font-extrabold text-ink">{selectedCenter?.replace('مركز ', '') || '—'}</span>
                    <ChevronDown size={14} weight="bold" className="text-muted" />
                  </span>
                </button>
              </div>
              <div className="mb-5 w-48"><GoldRule /></div>
              <div className="bg-white rounded-[11px] px-4 py-3.5 border flex items-start gap-3" style={{ borderColor: tint(NAVY, 22) }}>
                <Building2 size={17} weight="duotone" className="mt-0.5 shrink-0" style={{ color: NAVY }} />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-muted mb-1">{selectedCenter} · المتعهد المسجل</p>
                  <p className="text-[13px] font-bold text-ink leading-snug">{caterer}</p>
                </div>
              </div>
            </div>
            <div className="bg-white px-5 py-3 flex items-center justify-between border-t" style={{ borderColor: tint(NAVY, 28) }}>
              <div className="flex items-center gap-2">
                <TrendingUp size={14} weight="duotone" style={{ color: NAVY }} />
                <span className="text-[12px] font-bold text-ink">{clock.hijri}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={13} weight="duotone" className="text-muted" />
                <span className="text-[12px] text-muted font-bold tabular-nums">{clock.time}</span>
              </div>
            </div>
          </div>

          {/* Today's menu — menu tab only */}
          {view === 'menu' && selectedCenter && (
            <TodayMenuCard centerId={selectedCenter} />
          )}

          {view === 'activity' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <ClipboardCheck size={18} weight="duotone" style={{ color: NAVY }} />
              <span className="text-[15px] font-bold text-ink">نشاط مراقبي {selectedCenter}</span>
            </div>
            {activities.length === 0 ? (
              <div className="bg-white border border-line rounded-[14px] py-14 px-5 text-center shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
                <Clock size={26} weight="duotone" className="mx-auto text-muted/35" />
                <p className="text-[13px] font-semibold text-muted mt-3">لا يوجد نشاط مسجل للمركز اليوم</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {displayed.map(item => {
                  const cfg = ACTIVITY_CFG[item._col];
                  const statusInfo = STATUS_DATA[item.status] || { label: item.status, color: 'rgb(var(--c-muted))' };
                  return (
                    <div key={item.id}
                      className="relative bg-white border rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
                      style={{ borderColor: tint(cfg.color, 28) }}>
                      <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: cfg.color }} />
                      <div className="ps-5 pe-4 py-3.5 flex items-center gap-3.5">
                        <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                          style={{ background: tint(cfg.color, 9), borderColor: tint(cfg.color, 22) }}>
                          <cfg.Icon size={18} weight="duotone" style={{ color: cfg.color }} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            {item._col === 'task_completions' ? (
                              <p className="text-[13.5px] font-bold text-ink leading-tight">
                                تم رفع <span style={{ color: GREEN }}>{TASK_TYPE_LABELS[item.taskType] || item.taskType}</span>
                                {item.mealType ? ` — ${MEAL_LABELS[item.mealType] || ''}` : ''}
                              </p>
                            ) : (
                              <p className="text-[13.5px] font-bold text-ink truncate leading-tight">{item.reportType || item.type || cfg.label}</p>
                            )}
                            <span className="text-[11px] text-muted font-bold tabular-nums shrink-0">
                              {new Date(item._sortTs || item.timestamp?.toMillis?.() || 0).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            <p className="text-[11.5px] text-muted font-medium flex items-center gap-1 truncate">
                              <User size={11} weight="duotone" className="shrink-0" />
                              {item._col === 'task_completions'
                                ? `بواسطة: ${item.observerName || 'مراقب'}`
                                : `بواسطة: ${item.observer || 'مراقب ميداني'}`}
                            </p>
                            {item.status && item._col !== 'task_completions' && (
                              <Chip color={statusInfo.color}>{statusInfo.label}</Chip>
                            )}
                          </div>
                        </div>
                      </div>
                      {item.adminNotes && (item._col === 'reports' || item._col === 'logistics_requests') && (
                        <div className="border-t border-line bg-[rgb(var(--c-bg))] ps-5 pe-4 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted mb-1.5">ملاحظات غرفة العمليات</p>
                          <p className="text-[12px] text-ink font-medium leading-relaxed whitespace-pre-wrap">{item.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {activities.length > 4 && <button onClick={() => setShowAll(!showAll)} className="w-full py-3 text-[12px] font-bold text-ink bg-white hover:bg-[rgb(var(--c-bg))] rounded-[11px] transition-colors border border-dashed border-line mt-2">{showAll ? 'عرض أقل' : `عرض الكل (${activities.length})`}</button>}
              </div>
            )}
          </div>
          )}

          {view === 'actions' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3"><div className="h-px flex-1 bg-line" /><span className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">إجراءات المشرف</span><div className="h-px flex-1 bg-line" /></div>
            <div className="grid grid-cols-1 gap-3">
              <MenuCard icon={Utensils} title="تقييم جودة الوجبات" color={NAVY}
                doneBadge={taskBadges['meal_evaluation'] ? `${taskBadges['meal_evaluation']} مكتملة` : undefined}
                onClick={() => navigate('/sup-mealcheck', { state: { centerId: selectedCenter } })} />
              <MenuCard icon={HomeIcon} title="جاهزية مشعر منى" color="#3D6795"
                doneBadge={taskBadges['mina_readiness'] ? `${taskBadges['mina_readiness']} مكتملة` : undefined}
                onClick={() => navigate('/sup-mina-readiness', { state: { centerId: selectedCenter } })} />
              <MenuCard icon={Mountain} title="جاهزية مشعر عرفة" color="#9E5741"
                doneBadge={taskBadges['arafat_readiness'] ? `${taskBadges['arafat_readiness']} مكتملة` : undefined}
                onClick={() => navigate('/sup-arafat-readiness', { state: { centerId: selectedCenter } })} />
              <MenuCard icon={Package} title="طلب إسناد لوجستي" color={INFO} onClick={() => navigate('/sup-logistics', { state: { centerId: selectedCenter } })} />
              <MenuCard icon={AlertTriangle} title="بلاغ ميداني" color={RED} onClick={() => navigate('/sup-report', { state: { centerId: selectedCenter } })} badge="عاجل" />
            </div>
          </div>
          )}
        </div>
      </main>
      )}

      {/* Side Profile Menu */}
      <div className={`fixed inset-y-0 left-0 z-[101] w-full max-w-sm bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform border-r border-line ${isProfileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col bg-[rgb(var(--c-bg))]">
          {/* Drawer chrome stays dark — it is the app's navy shell, not a panel. */}
          <div className="p-8 bg-primary text-white relative">
            <button onClick={() => setIsProfileOpen(false)} className="absolute top-6 end-6 w-8 h-8 rounded-[10px] bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><ChevronLeft size={18} weight="bold" className="rotate-180" /></button>
            <div className="mt-4 text-center">
              <div className="w-20 h-20 rounded-[18px] bg-white/10 border border-white/20 flex items-center justify-center mb-4 mx-auto"><User size={36} weight="duotone" className="text-white" /></div>
              <h3 className="text-[19px] font-extrabold">{profile?.nameAr || profile?.name}</h3>
              <p className="text-white/60 text-[10px] font-bold mt-1.5 uppercase tracking-[0.18em]">مشرف ميداني</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                 <Chip color={NAVY}>{assignedCenters.length} مراكز</Chip>
                 <p className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">نطاق الإشراف</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {assignedCenters.map(center => (
                  <div key={center} className="flex items-center justify-between px-4 py-3.5 bg-white border border-line rounded-[11px] shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
                    {selectedCenter === center ? <CheckCircle2 size={16} weight="duotone" style={{ color: GREEN }} /> : <div />}
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-bold text-ink">{center}</span>
                      <div className="w-2 h-2 rounded-full" style={{ background: NAVY }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-5 border-t border-line">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-[12px] border text-white text-[13px] font-bold transition-colors" style={{ background: RED, borderColor: RED }}><LogOut size={18} weight="bold" /> تسجيل الخروج</button>
          </div>
        </div>
      </div>

      {/* Bottom Sheet for Center Selection */}
      <div className={`fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-[20px] shadow-2xl transition-transform duration-500 transform border-t border-line ${isSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center py-4 cursor-pointer" onClick={() => setIsSheetOpen(false)}><div className="w-12 h-1 bg-line rounded-full" /></div>
        <div className="px-5 sm:px-8 pb-10 max-h-[70vh] overflow-y-auto text-center">
          <h3 className="text-[17px] font-extrabold text-ink mb-5">تبديل مركز الإشراف</h3>
          <div className="grid grid-cols-1 gap-2.5">
            {assignedCenters.map(centerItem => {
              const on = selectedCenter === centerItem;
              return (
              <button key={centerItem} onClick={() => { setSelectedCenter(centerItem); sessionStorage.setItem('sup_selected_center', centerItem); setTimeout(() => setIsSheetOpen(false), 200); }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-[11px] border text-[13px] font-bold transition-colors"
                style={on
                  ? { background: tint(NAVY, 12), borderColor: NAVY, color: NAVY }
                  : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-ink))' }}>
                <span className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: on ? NAVY : 'rgb(var(--c-line))' }} />
                  <span>{centerItem}</span>
                </span>
                {on && <CheckCircle2 size={18} weight="duotone" style={{ color: NAVY }} />}
              </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-line shadow-[0_-4px_20px_rgb(var(--c-ink)/0.06)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-5xl mx-auto grid grid-cols-3">
          {[
            { key: 'actions',  label: 'الإجراءات', Icon: ClipboardCheck, badge: pendingTasks.length || null },
            { key: 'menu',     label: 'المنيو',     Icon: Utensils,       badge: null },
            { key: 'activity', label: 'النشاط',     Icon: Bell,           badge: globalNotifs.length || null },
          ].map(tab => {
            const active = view === tab.key;
            const TIcon = tab.Icon;
            return (
              <button key={tab.key} onClick={() => setView(tab.key)}
                className={`relative flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                  active ? 'text-primary' : 'text-muted hover:text-primary'
                }`}
              >
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-b-full bg-primary" />}
                <div className="relative">
                  <TIcon size={21} weight={active ? 'duotone' : 'regular'} />
                  {tab.badge && (
                    <span className="absolute -top-1 -end-2 min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white tabular-nums" style={{ background: RED }}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <footer className="max-w-5xl mx-auto px-8 py-6 pb-28 text-center"><p className="text-[10px] text-muted/60 font-bold uppercase tracking-[0.18em]">© لوحة الإشراف</p></footer>
      <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-slide-up { animation: fadeSlideUp 0.5s ease-out forwards; } @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}