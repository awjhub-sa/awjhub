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
  Sparkle as Sparkles,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import TodayMenuCard from '../../components/TodayMenuCard.jsx';
import { formatHijri } from '../../lib/hijri.js';
import { BRAND } from '../../config/brand.js';

const GoldRule = () => (
  <svg width="100" height="6" viewBox="0 0 100 6" fill="none">
    <line x1="0" y1="3" x2="32" y2="3" stroke="rgb(var(--c-primary))" strokeWidth="0.75" />
    <circle cx="40" cy="3" r="1.2" fill="rgb(var(--c-primary))" opacity="0.5" />
    <circle cx="50" cy="3" r="2.5" fill="rgb(var(--c-primary))" />
    <circle cx="60" cy="3" r="1.2" fill="rgb(var(--c-primary))" opacity="0.5" />
    <line x1="68" y1="3" x2="100" y2="3" stroke="rgb(var(--c-primary))" strokeWidth="0.75" />
  </svg>
);

const MenuCard = ({ icon: Icon, title, subtitle, badge, doneBadge, onClick, variant = 'default' }) => {
  const isAccent = variant === 'accent';
  return (
    <button
      onClick={onClick}
      className={`group/menu relative w-full text-right rounded-2xl p-5 flex items-center gap-4 transition-all duration-300 active:scale-[0.97] border-2 overflow-hidden ${
        isAccent
          ? 'border-transparent text-white'
          : 'bg-gradient-to-br from-white via-white to-background/40 border-line hover:border-primary/40 hover:shadow-[0_8px_28px_rgb(var(--c-primary)/0.18)] text-ink'
      }`}
      style={isAccent
        ? { background: 'linear-gradient(135deg, rgb(var(--c-ink-800)) 0%, rgb(var(--c-ink)) 100%)', boxShadow: '0 6px 24px rgb(var(--c-ink) / 0.28)' }
        : { boxShadow: '0 2px 10px rgb(var(--c-ink) / 0.06)' }}
    >
      {isAccent && (
        <div className="absolute top-0 right-0 left-0 h-0.5 opacity-70"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-primary-400)), transparent)' }} />
      )}

      <div className="relative flex-shrink-0">
        <div className={`absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover/menu:opacity-60 transition-opacity duration-500 ${isAccent ? 'bg-primary-400' : 'bg-primary'}`} />
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-md border-2 transition-transform duration-300 group-hover/menu:scale-110 group-hover/menu:rotate-3"
          style={isAccent
            ? { background: 'linear-gradient(135deg, rgb(var(--c-primary-400) / 0.18), rgb(var(--c-primary) / 0.10))', borderColor: 'rgb(var(--c-primary-400) / 0.35)' }
            : { background: 'linear-gradient(135deg, rgb(var(--c-bg)), rgb(var(--c-primary-100)))', borderColor: 'rgb(var(--c-primary) / 0.25)' }}
        >
          <Icon size={26} className="text-primary" />
          <Sparkles size={9} className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-base">{title}</span>
          {badge && (
            <span className="badge-pulse-red inline-flex items-center min-w-[22px] h-[22px] bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-extrabold rounded-full px-1.5 ring-2 ring-white shadow-md tabular-nums">
              {badge}
            </span>
          )}
          {doneBadge && (
            <span className="inline-flex items-center gap-1 min-w-[22px] h-[22px] bg-gradient-to-br from-green-500 to-green-600 text-white text-[10px] font-extrabold rounded-full px-2 ring-2 ring-white shadow-sm tabular-nums">
              <CheckCircle2 size={10} weight="bold" />
              {doneBadge}
            </span>
          )}
        </div>
        <p className={`text-sm mt-1 truncate ${isAccent ? 'text-white/60' : 'text-muted'}`}>{subtitle}</p>
      </div>

      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 group-hover/menu:-translate-x-1 ${
        isAccent ? 'bg-white/10 group-hover/menu:bg-white/20' : 'bg-background group-hover/menu:bg-primary/15'
      }`}>
        <ChevronLeft size={16} weight="bold" className={isAccent ? 'text-white' : 'text-primary'} />
      </div>
    </button>
  );
};

const ACTIVITY_CFG = {
  reports:           { label: 'بلاغ طارئ',      Icon: AlertTriangle,  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  meal_evaluations:  { label: 'تقييم وجبات',      Icon: Utensils,       color: 'rgb(var(--c-primary))', bg: 'rgb(var(--c-bg))', border: 'rgb(var(--c-line))' },
  mina_readiness:    { label: 'جاهزية منى',        Icon: HomeIcon,       color: '#3D6795', bg: '#EEF4FB', border: '#C4D8ED' },
  arafat_readiness:  { label: 'جاهزية عرفة',      Icon: Mountain,       color: '#9E5741', bg: '#FBF3EF', border: '#EBCFC3' },
  logistics_requests:{ label: 'طلب إسناد',         Icon: Package,        color: '#4E7CB0', bg: '#EFF6FF', border: '#BFDBFE' },
  task_completions:  { label: 'مهمة مكتملة',      Icon: ClipboardCheck, color: 'rgb(var(--c-success))', bg: '#DCFCE7', border: '#86EFAC' },
};

const TASK_TYPE_LABELS = {
  meal_evaluation:  'تقييم جودة الوجبات',
  mina_readiness:   'جاهزية مشعر منى',
  arafat_readiness: 'جاهزية مشعر عرفة',
};
const TASK_TYPE_META = {
  meal_evaluation:  { Icon: Utensils,   color: 'rgb(var(--c-primary))', bg: 'rgb(var(--c-bg))', border: 'rgb(var(--c-line))' },
  mina_readiness:   { Icon: HomeIcon,   color: '#3D6795', bg: '#EEF4FB', border: '#C4D8ED' },
  arafat_readiness: { Icon: Mountain,   color: '#9E5741', bg: '#FBF3EF', border: '#EBCFC3' },
};
const MEAL_LABELS = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };

function StatMini({ label, value, accent, Icon }) {
  return (
    <div className="group/stat relative bg-gradient-to-br from-white to-background/40 rounded-2xl p-3 sm:p-3.5 border border-line shadow-[0_2px_8px_rgb(var(--c-ink)/0.05)] hover:shadow-[0_6px_18px_rgb(var(--c-primary)/0.15)] transition-all duration-300 overflow-hidden"
      style={{ borderRight: `3px solid ${accent}` }}>
      <div className="absolute top-0 right-0 left-0 h-0.5 opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-muted font-semibold mb-0.5 truncate">{label}</p>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums" style={{ color: accent }}>{value}</p>
        </div>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover/stat:opacity-50 transition-opacity"
            style={{ background: accent }} />
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center group-hover/stat:scale-110 transition-transform duration-300"
            style={{ background: `${accent}15` }}>
            <Icon size={16} style={{ color: accent }} weight="regular" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingTaskRow({ task, onClick }) {
  const meta = TASK_TYPE_META[task.taskType] || TASK_TYPE_META.meal_evaluation;
  const TIcon = meta.Icon;
  const label = TASK_TYPE_LABELS[task.taskType] || task.taskType;
  const mealLabel = task.mealType ? MEAL_LABELS[task.mealType] || task.mealType : null;
  return (
    <button onClick={onClick}
      className="group/row min-h-[64px] w-full flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-right hover:bg-gradient-to-l hover:from-[#FDFAF7] hover:to-transparent active:bg-background transition-all duration-300"
    >
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover/row:opacity-50 transition-opacity"
          style={{ background: meta.color }} />
        <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border-2 group-hover/row:scale-110 group-hover/row:rotate-3 transition-transform duration-300"
          style={{ background: meta.bg, borderColor: meta.border }}>
          <TIcon size={18} style={{ color: meta.color }} weight="regular" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold text-ink leading-tight">{label}</p>
          {mealLabel && (
            <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full text-white shrink-0"
              style={{ background: meta.color }}>
              {mealLabel}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted mt-0.5 truncate">
          <span className="font-bold text-primary">{task.center}</span>
          {task.scheduledDate && <> · <span className="text-[10px]">{task.scheduledDate}</span></>}
        </p>
      </div>
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-background group-hover/row:bg-primary flex items-center justify-center group-hover/row:-translate-x-1 transition-all duration-300">
        <ChevronLeft size={16} className="text-primary group-hover/row:text-white transition-colors" weight="bold" />
      </div>
    </button>
  );
}

const REPORT_STATUS_LBL = {
  pending:     { label: 'قيد الانتظار', bg: '#FEF9C3', text: '#854D0E' },
  in_progress: { label: 'جارٍ التنفيذ', bg: '#DBEAFE', text: '#26456A' },
};
const LOGISTICS_STATUS_LBL = {
  pending:  { label: 'قيد الانتظار', bg: '#FEF9C3', text: '#854D0E' },
  approved: { label: 'معتمد',        bg: '#DBEAFE', text: '#26456A' },
};

function ReportRow({ report, onClick }) {
  const status = REPORT_STATUS_LBL[report.status] || REPORT_STATUS_LBL.pending;
  return (
    <button onClick={onClick}
      className="group/row min-h-[64px] w-full flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-right hover:bg-gradient-to-l hover:from-red-50/40 hover:to-transparent active:bg-red-50 transition-all duration-300"
    >
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-xl blur-md bg-red-400 opacity-0 group-hover/row:opacity-40 transition-opacity" />
        <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border-2 group-hover/row:scale-110 group-hover/row:rotate-3 transition-transform duration-300"
          style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
          <AlertTriangle size={18} className="text-red-600" weight="regular" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold text-ink leading-tight truncate">بلاغ ميداني</p>
          {report.reportNumber && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums bg-red-50 border border-red-200 text-red-700">
              #{report.reportNumber}
            </span>
          )}
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: status.bg, color: status.text }}>
            {status.label}
          </span>
        </div>
        <p className="text-[11px] text-muted mt-0.5 truncate">
          <span className="font-bold text-primary">{report.center}</span>
          {report.observer && <> · بواسطة: <span className="font-bold text-ink">{report.observer}</span></>}
        </p>
      </div>
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-50 group-hover/row:bg-red-500 flex items-center justify-center group-hover/row:-translate-x-1 transition-all duration-300">
        <ChevronLeft size={16} className="text-red-600 group-hover/row:text-white transition-colors" weight="bold" />
      </div>
    </button>
  );
}

function LogisticsRow({ item, onClick }) {
  const status = LOGISTICS_STATUS_LBL[item.status] || LOGISTICS_STATUS_LBL.pending;
  return (
    <button onClick={onClick}
      className="group/row min-h-[64px] w-full flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-right hover:bg-gradient-to-l hover:from-blue-50/40 hover:to-transparent active:bg-blue-50 transition-all duration-300"
    >
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-xl blur-md bg-blue-400 opacity-0 group-hover/row:opacity-40 transition-opacity" />
        <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border-2 group-hover/row:scale-110 group-hover/row:rotate-3 transition-transform duration-300"
          style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <Package size={18} className="text-blue-600" weight="regular" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold text-ink leading-tight truncate">طلب إسناد</p>
          {item.requestNumber && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums bg-blue-50 border border-blue-200 text-blue-700">
              #{item.requestNumber}
            </span>
          )}
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: status.bg, color: status.text }}>
            {status.label}
          </span>
        </div>
        <p className="text-[11px] text-muted mt-0.5 truncate">
          <span className="font-bold text-primary">{item.center}</span>
          {item.observer && <> · بواسطة: <span className="font-bold text-ink">{item.observer}</span></>}
        </p>
      </div>
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-50 group-hover/row:bg-blue-500 flex items-center justify-center group-hover/row:-translate-x-1 transition-all duration-300">
        <ChevronLeft size={16} className="text-blue-600 group-hover/row:text-white transition-colors" weight="bold" />
      </div>
    </button>
  );
}

function CenterCard({ centerId, stats, onClick }) {
  const pending   = stats?.pending   ?? 0;
  const completed = stats?.completed ?? 0;
  const total     = stats?.total     ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <button onClick={onClick}
      className="group/center relative bg-gradient-to-br from-white via-white to-background/40 rounded-2xl p-4 border-2 border-line hover:border-primary/40 hover:shadow-[0_6px_20px_rgb(var(--c-primary)/0.15)] hover:-translate-y-0.5 transition-all duration-300 text-right overflow-hidden"
    >
      <div className="absolute top-0 right-0 left-0 h-1 opacity-70"
        style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-primary)), transparent)' }} />
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 group-hover/center:scale-110 transition-transform"
            style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
            <Building2 size={14} className="text-white" weight="bold" />
          </div>
          <p className="text-sm font-bold text-ink truncate">{centerId}</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="text-[10px] text-muted font-medium">لا توجد مهام مُسندة</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
            <span className="text-muted">التقدم</span>
            <span className="text-primary tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 bg-[rgb(var(--c-primary-50))] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#5E9070' : pct > 0 ? '#F59E0B' : 'rgb(var(--c-primary))',
              }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px]">
            <span className="inline-flex items-center gap-1 font-bold text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {pending} معلّقة
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {completed} مكتملة
            </span>
          </div>
        </>
      )}
    </button>
  );
}

const STATUS_DATA = {
  pending: { label: 'قيد الانتظار', bg: '#FEF9C3', text: '#854D0E' },
  in_progress: { label: 'جارٍ التنفيذ', bg: '#DBEAFE', text: '#26456A' },
  resolved: { label: 'تم الحل', bg: '#DCFCE7', text: '#166534' },
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
    <div dir="rtl" className="min-h-screen bg-canvas font-arabic pb-10 overflow-x-hidden text-right">

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

      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-line w-full px-4 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={BRAND.logo.icon} alt={BRAND.companyName} className="w-10 h-10" />
            <div>
              <p className="text-xs font-bold text-ink">{BRAND.companyName}</p>
              <p className="text-[10px] text-primary font-bold leading-tight">لوحة تحكم المشرف</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="w-10 h-10 rounded-xl border border-line flex items-center justify-center hover:bg-background transition-colors relative"
              >
                <Bell size={18} className="text-muted" />
                {globalNotifs.length > 0 && (
                  <span className="badge-pulse-red absolute -top-1 -left-1 min-w-[20px] h-[20px] px-1.5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white shadow-md tabular-nums">
                    {globalNotifs.length > 99 ? '99+' : globalNotifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute top-12 left-0 w-80 max-w-[90vw] bg-white border border-line rounded-2xl shadow-2xl z-[102] overflow-hidden">
                  <div className="px-4 py-3 bg-background border-b border-line flex items-center justify-between">
                    <span className="text-sm font-black text-ink">إشعارات اليوم</span>
                    <span className="text-[10px] font-bold text-primary">{globalNotifs.length} جديد</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {globalNotifs.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell size={28} className="mx-auto text-line mb-2 opacity-40" />
                        <p className="text-xs text-muted font-bold">لا توجد إشعارات اليوم</p>
                      </div>
                    ) : (
                      globalNotifs.map(n => (
                        <div key={n.id} className="px-4 py-3 border-b border-line/40 last:border-b-0 hover:bg-background/40 transition-colors">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xs font-bold text-ink leading-snug">
                                تم رفع {TASK_TYPE_LABELS[n.taskType] || n.taskType}
                                {n.mealType ? ` — ${MEAL_LABELS[n.mealType] || ''}` : ''}
                              </p>
                              <p className="text-[10px] text-primary font-bold mt-0.5">
                                {n.center} · بواسطة: {n.observerName || 'مراقب'}
                              </p>
                              <p className="text-[9px] text-muted mt-0.5">
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
              className="w-10 h-10 rounded-xl bg-background border border-primary/20 flex items-center justify-center hover:bg-primary hover:text-white group transition-all"
            >
              <User size={18} className="text-primary group-hover:text-white" />
            </button>
          </div>
        </div>
      </header>

      {!selectedCenter && (
        <main className="max-w-5xl mx-auto px-4 md:px-8 py-6 pb-32 space-y-6">

          {/* Welcome strip */}
          <div className="animate-fade-slide-up rounded-[2rem] overflow-hidden shadow-xl">
            <div className="p-5 sm:p-7 relative overflow-hidden bg-gradient-to-br from-ink-800 via-ink to-[#1F1A17]">
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgb(var(--c-primary)) 0, rgb(var(--c-primary)) 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 relative">
                <div className="flex-1 min-w-0">
                  <p className="text-white/50 text-xs sm:text-sm mb-1">مرحباً (مشرف ميداني)،</p>
                  <h2 className="text-white font-bold text-xl sm:text-2xl truncate">{profile?.nameAr || profile?.name || 'المشرف الميداني'}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <MapPin size={13} className="text-primary" />
                    <span className="text-primary text-xs sm:text-sm font-bold">
                      {assignedCenters.length} {assignedCenters.length === 1 ? 'مركز' : 'مراكز'} ضمن نطاقك
                    </span>
                  </div>
                </div>
                <div className="bg-white/10 rounded-2xl px-4 py-2.5 sm:py-3 border border-white/10 backdrop-blur-sm shrink-0 self-start flex sm:flex-col items-center sm:text-center gap-2 sm:gap-0">
                  <Clock size={14} className="text-white/40 sm:hidden" />
                  <p className="text-white/50 text-[10px] font-bold sm:mb-0.5">{clock.hijri}</p>
                  <span className="hidden sm:block" />
                  <p className="text-white text-xs sm:text-sm font-bold tabular-nums">{clock.time}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatMini
              label="مهام معلّقة"
              value={pendingTasks.length}
              accent="#DC2626"
              Icon={Clock}
            />
            <StatMini
              label="مكتملة اليوم"
              value={completedToday}
              accent="#16A34A"
              Icon={CheckCircle2}
            />
            <StatMini
              label="مراكز مُسندة"
              value={assignedCenters.length}
              accent="#4E7CB0"
              Icon={Building2}
            />
            <StatMini
              label="مهام مُسندة"
              value={allAssignedTasks.length}
              accent="rgb(var(--c-primary))"
              Icon={ClipboardCheck}
            />
          </div>

          {/* TEMP: Sweep mode banner — tap to start sweeping any center freely.
              Remove this block (and the buttons inside it) to restore the
              assigned-task-only flow. */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/sup-mina-readiness', { state: { sweepMode: true } })}
              className="group relative overflow-hidden rounded-3xl border-2 border-primary/30 text-right transition-all hover:border-primary hover:shadow-[0_10px_28px_rgb(var(--c-primary)/0.25)] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 60%)' }}
            >
              <div className="p-5 flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-2xl blur-md bg-primary opacity-30 group-hover:opacity-60 transition-opacity" />
                  <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
                    style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                    <MapPin size={22} className="text-white" weight="bold" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-ink leading-tight">جاهزية منى</p>
                </div>
                <ChevronLeft size={18} className="text-primary shrink-0 group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => navigate('/sup-arafat-readiness', { state: { sweepMode: true } })}
              className="group relative overflow-hidden rounded-3xl border-2 border-[#5E9070]/30 text-right transition-all hover:border-[#5E9070] hover:shadow-[0_10px_28px_rgba(14,124,102,0.25)] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #fff 60%)' }}
            >
              <div className="p-5 flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-2xl blur-md bg-[#5E9070] opacity-30 group-hover:opacity-60 transition-opacity" />
                  <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
                    style={{ background: 'linear-gradient(135deg, #5E9070, #3D6349)' }}>
                    <Mountain size={22} className="text-white" weight="bold" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-ink leading-tight">جاهزية عرفة</p>
                </div>
                <ChevronLeft size={18} className="text-[#5E9070] shrink-0 group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          </section>

          {view === 'actions' && (<>
          {/* Pending tasks (cross-center) */}
          {(() => {
            const totalActionable = pendingTasks.length + openReports.length + openLogistics.length;
            return (
          <section className="bg-gradient-to-br from-white via-white to-background/40 rounded-3xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #fff 55%)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FCA5A5, #EF4444)' }}>
                  <Clock size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-ink">مهام تحتاج إجراء</h2>
                  <p className="text-[11px] text-muted mt-0.5">
                    {totalActionable === 0
                      ? 'كل شيء مكتمل 🎉'
                      : `${totalActionable} ${totalActionable === 1 ? 'بند' : 'بنود'} عبر مراكزك`}
                  </p>
                </div>
              </div>
            </div>

            {totalActionable === 0 ? (
              <div className="py-12 text-center">
                <div className="relative w-fit mx-auto mb-3">
                  <div className="absolute inset-0 rounded-2xl blur-xl bg-green-400 opacity-30" />
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)' }}>
                    <CheckCircle2 size={26} className="text-green-600" weight="regular" />
                  </div>
                </div>
                <p className="text-[#16A34A] font-bold text-sm">جميع البنود مكتملة!</p>
                <p className="text-muted text-xs mt-1">لا توجد مهام أو بلاغات أو طلبات معلّقة</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
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
              <div className="px-5 py-3 bg-[#FDFAF7] border-t border-line text-center">
                <p className="text-xs text-muted font-medium">
                  معروض ١٠ من كل فئة
                </p>
              </div>
            )}
          </section>
            );
          })()}

          {/* Centers grid — actions tab */}
          <section className="bg-gradient-to-br from-white via-white to-background/40 rounded-3xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 55%)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                <Building2 size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">مراكزي</h2>
              </div>
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
          <section className="bg-gradient-to-br from-white via-white to-background/40 rounded-3xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #fff 55%)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #86EFAC, #16A34A)' }}>
                <ClipboardCheck size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">نشاط اليوم</h2>
                <p className="text-[11px] text-muted mt-0.5">
                  {globalNotifs.length === 0 ? 'لا يوجد رفع اليوم بعد' : `${globalNotifs.length} رفع من مراقبيك`}
                </p>
              </div>
            </div>
            <div className="divide-y divide-line">
              {globalNotifs.length === 0 ? (
                <div className="py-10 text-center">
                  <Clock size={32} className="mx-auto text-line mb-2 opacity-50" />
                  <p className="text-muted text-sm font-bold">لا يوجد نشاط من المراقبين اليوم</p>
                </div>
              ) : (
                globalNotifs.slice(0, 8).map(n => (
                  <div key={n.id} className="group/row flex items-center gap-3 px-5 py-3 hover:bg-gradient-to-l hover:from-green-50/30 hover:to-transparent transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-green-200"
                      style={{ background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)' }}>
                      <CheckCircle2 size={18} className="text-green-600" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">
                        تم رفع {TASK_TYPE_LABELS[n.taskType] || n.taskType}
                        {n.mealType ? ` — ${MEAL_LABELS[n.mealType] || ''}` : ''}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5 truncate">
                        <span className="font-bold text-primary">{n.center}</span> · بواسطة: {n.observerName || 'مراقب'}
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-line bg-white text-muted hover:text-primary hover:border-primary/40 text-xs font-bold transition-all"
        >
          <ChevronLeft size={14} weight="bold" />
          العودة للوحة الرئيسية
        </button>

        <div className="space-y-6">
          {/* Header card always visible */}

          <div className="animate-fade-slide-up shadow-xl rounded-[2.5rem] overflow-hidden">
            <div className="p-8 relative overflow-hidden bg-ink">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgb(var(--c-primary)) 0, rgb(var(--c-primary)) 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
              <div className="flex items-start justify-between mb-6 relative">
                <div className="flex-1 min-w-0">
                  <p className="text-white/50 text-sm mb-1">مرحباً بك (مشرف)،</p>
                  <h2 className="text-white font-bold text-2xl truncate">{profile?.nameAr || profile?.name || 'المشرف الميداني'}</h2>
                  <div className="flex items-center gap-2 mt-2"><MapPin size={14} className="text-primary" /><span className="text-primary text-sm font-bold">نطاق الإشراف الميداني</span></div>
                </div>
                <button onClick={() => setIsSheetOpen(true)} className="bg-white/10 hover:bg-white/20 transition-all rounded-2xl px-5 py-3 text-center border border-white/10 flex flex-col items-center min-w-[100px]">
                  <p className="text-white/50 text-[10px] mb-1 font-bold">المركز الحالي</p>
                  <div className="flex items-center gap-2">
                    <p className="text-primary font-bold text-2xl">{selectedCenter?.replace('مركز ', '') || '—'}</p>
                    <ChevronDown size={16} className="text-white/50" />
                  </div>
                </button>
              </div>
              <div className="mb-6 relative w-48"><GoldRule /></div>
              <div className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10 backdrop-blur-sm flex items-start gap-3">
                <Building2 size={18} className="text-primary mt-0.5" />
                <div><p className="text-white/50 text-[10px] mb-1">{selectedCenter} · المتعهد المسجل</p><p className="text-white text-sm font-bold leading-snug">{caterer}</p></div>
              </div>
            </div>
            <div className="bg-background px-6 py-3 flex items-center justify-between border-t border-line/30">
              <div className="flex items-center gap-2 text-primary"><TrendingUp size={14} /><span className="text-xs font-bold text-ink">{clock.hijri}</span></div>
              <div className="flex items-center gap-2"><Clock size={12} className="text-muted" /><span className="text-xs text-muted font-bold">{clock.time}</span></div>
            </div>
          </div>

          {/* Today's menu — menu tab only */}
          {view === 'menu' && selectedCenter && (
            <TodayMenuCard centerId={selectedCenter} />
          )}

          {view === 'activity' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <ClipboardCheck size={20} className="text-primary" />
              <span className="text-lg font-black text-ink">نشاط مراقبي {selectedCenter}</span>
            </div>
            {activities.length === 0 ? (
              <div className="bg-white border border-line rounded-3xl py-12 text-center shadow-sm">
                <Clock size={40} className="mx-auto text-line mb-3 opacity-40" />
                <p className="text-muted text-sm font-bold">لا يوجد نشاط مسجل للمركز اليوم</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {displayed.map(item => {
                  const cfg = ACTIVITY_CFG[item._col];
                  const statusInfo = STATUS_DATA[item.status] || { label: item.status, bg: '#F3F4F6', text: '#374151' };
                  return (
                    <div key={item.id} className="bg-white border border-line rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                      <div className="px-5 py-4 flex items-center gap-4">
                        <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: cfg.color }} />
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}><cfg.Icon size={20} style={{ color: cfg.color }} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            {item._col === 'task_completions' ? (
                              <p className="text-sm font-bold text-ink leading-snug">
                                تم رفع <span className="text-success">{TASK_TYPE_LABELS[item.taskType] || item.taskType}</span>
                                {item.mealType ? ` — ${MEAL_LABELS[item.mealType] || ''}` : ''}
                              </p>
                            ) : (
                              <p className="text-base font-bold text-ink truncate">{item.reportType || item.type || cfg.label}</p>
                            )}
                            <span className="text-xs text-muted font-bold shrink-0 mr-2">
                              {new Date(item._sortTs || item.timestamp?.toMillis?.() || 0).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-primary font-bold flex items-center gap-1">
                              <User size={10} />
                              {item._col === 'task_completions'
                                ? `بواسطة: ${item.observerName || 'مراقب'}`
                                : `بواسطة: ${item.observer || 'مراقب ميداني'}`}
                            </p>
                            {item.status && item._col !== 'task_completions' && (
                              <span className="text-[10px] font-black px-3 py-0.5 rounded-full" style={{ background: statusInfo.bg, color: statusInfo.text }}>{statusInfo.label}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {item.adminNotes && (item._col === 'reports' || item._col === 'logistics_requests') && (
                        <div className="border-t border-line bg-gradient-to-br from-background to-white px-5 py-3">
                          <p className="text-[10px] text-primary font-black mb-1 tracking-wide">ملاحظات غرفة العمليات</p>
                          <p className="text-[12px] text-ink font-medium leading-relaxed whitespace-pre-wrap">{item.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {activities.length > 4 && <button onClick={() => setShowAll(!showAll)} className="w-full py-3 text-primary font-bold text-sm bg-white hover:bg-gray-50 rounded-2xl transition-all border border-dashed border-line mt-2">{showAll ? 'عرض أقل' : `عرض الكل (${activities.length})`}</button>}
              </div>
            )}
          </div>
          )}

          {view === 'actions' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3"><div className="h-px flex-1 bg-line/50" /><span className="text-[10px] font-black text-primary uppercase tracking-widest">إجراءات المشرف</span><div className="h-px flex-1 bg-line/50" /></div>
            <div className="grid grid-cols-1 gap-4">
              <MenuCard icon={Utensils} title="تقييم جودة الوجبات"
                doneBadge={taskBadges['meal_evaluation'] ? `${taskBadges['meal_evaluation']} مكتملة` : undefined}
                onClick={() => navigate('/sup-mealcheck', { state: { centerId: selectedCenter } })} variant="accent" />
              <MenuCard icon={HomeIcon} title="جاهزية مشعر منى"
                doneBadge={taskBadges['mina_readiness'] ? `${taskBadges['mina_readiness']} مكتملة` : undefined}
                onClick={() => navigate('/sup-mina-readiness', { state: { centerId: selectedCenter } })} />
              <MenuCard icon={Mountain} title="جاهزية مشعر عرفة"
                doneBadge={taskBadges['arafat_readiness'] ? `${taskBadges['arafat_readiness']} مكتملة` : undefined}
                onClick={() => navigate('/sup-arafat-readiness', { state: { centerId: selectedCenter } })} />
              <MenuCard icon={Package} title="طلب إسناد لوجستي" onClick={() => navigate('/sup-logistics', { state: { centerId: selectedCenter } })} />
              <MenuCard icon={AlertTriangle} title="بلاغ ميداني" onClick={() => navigate('/sup-report', { state: { centerId: selectedCenter } })} badge="عاجل" />
            </div>
          </div>
          )}
        </div>
      </main>
      )}

      {/* Side Profile Menu */}
      <div className={`fixed inset-y-0 left-0 z-[101] w-full max-w-sm bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform border-r border-line ${isProfileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col bg-background">
          <div className="p-8 bg-ink text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgb(var(--c-primary)) 1px, transparent 0)', backgroundSize: '20px 20px' }} />
            <button onClick={() => setIsProfileOpen(false)} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><ChevronLeft size={20} className="rotate-180" /></button>
            <div className="relative mt-4 text-center">
              <div className="w-20 h-20 rounded-[2rem] bg-primary flex items-center justify-center shadow-2xl mb-4 border-4 border-white/10 mx-auto"><User size={40} className="text-white" /></div>
              <h3 className="text-2xl font-bold">{profile?.nameAr || profile?.name}</h3>
              <p className="text-primary text-sm font-bold mt-1 opacity-80 uppercase tracking-widest">مشرف ميداني</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                 <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{assignedCenters.length} مراكز</span>
                 <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">نطاق الإشراف</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {assignedCenters.map(center => (
                  <div key={center} className="flex items-center justify-between p-4 bg-white border border-line rounded-2xl shadow-sm">
                    {selectedCenter === center ? <CheckCircle2 size={16} className="text-success" /> : <div />}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-ink">{center}</span>
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-line">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-error text-white rounded-2xl font-bold shadow-lg transition-all active:scale-[0.98]"><LogOut size={20} /> تسجيل الخروج</button>
          </div>
        </div>
      </div>

      {/* Bottom Sheet for Center Selection */}
      <div className={`fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-[3rem] shadow-2xl transition-transform duration-500 transform border-t border-line ${isSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center py-5 cursor-pointer" onClick={() => setIsSheetOpen(false)}><div className="w-14 h-1.5 bg-line rounded-full opacity-40" /></div>
        <div className="px-8 pb-12 max-h-[70vh] overflow-y-auto text-center">
          <h3 className="text-xl font-black text-ink mb-6">تبديل مركز الإشراف</h3>
          <div className="grid grid-cols-1 gap-3">
            {assignedCenters.map(centerItem => (
              <button key={centerItem} onClick={() => { setSelectedCenter(centerItem); sessionStorage.setItem('sup_selected_center', centerItem); setTimeout(() => setIsSheetOpen(false), 200); }} className={`w-full flex items-center justify-between px-6 py-5 rounded-[1.5rem] font-bold transition-all ${selectedCenter === centerItem ? 'bg-background text-primary border-2 border-primary' : 'bg-[#F9F7F5] border-2 border-transparent hover:border-line'}`}>
                <div className="flex items-center gap-4"><div className={`w-3 h-3 rounded-full ${selectedCenter === centerItem ? 'bg-primary' : 'bg-gray-300'}`} /><span>{centerItem}</span></div>
                {selectedCenter === centerItem && <CheckCircle2 size={20} className="text-primary" />}
              </button>
            ))}
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
                  <TIcon size={22} />
                  {tab.badge && (
                    <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white tabular-nums">
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
      <footer className="max-w-5xl mx-auto px-8 py-6 pb-28 text-center"><p className="text-[10px] text-muted/60 font-bold uppercase tracking-widest">© لوحة الإشراف</p></footer>
      <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-slide-up { animation: fadeSlideUp 0.5s ease-out forwards; } @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}