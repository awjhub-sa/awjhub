import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase.js';
import { db as supaDb, rowFromDb } from '../../lib/db.js';
import {
  Utensils, AlertTriangle, Bell, User, ChevronDown, ChevronLeft,
  TrendingUp, ClipboardCheck, MapPin, Home as HomeIcon,
  Mountain, Building2, Package, Clock, LogOut, CheckCircle2,
  ArrowLeftRight, Loader2, Mail, Hash, Sparkles,
} from 'lucide-react';
import logo from "../../assets/logo.png";
import { useAuth } from '../../context/AuthContext.jsx';
import { getCaterer } from '../../config/centers.js';
import { extractCenterNum } from '../../hooks/useAssignedTasks.js';
import TodayMenuCard from '../../components/TodayMenuCard.jsx';

const GoldRule = () => (
  <svg width="100" height="6" viewBox="0 0 100 6" fill="none">
    <line x1="0" y1="3" x2="32" y2="3" stroke="#A98159" strokeWidth="0.75" />
    <circle cx="40" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <circle cx="50" cy="3" r="2.5" fill="#A98159" />
    <circle cx="60" cy="3" r="1.2" fill="#A98159" opacity="0.5" />
    <line x1="68" y1="3" x2="100" y2="3" stroke="#A98159" strokeWidth="0.75" />
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
          : 'bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 border-[#EDE5DC] hover:border-[#A98159]/40 hover:shadow-[0_8px_28px_rgba(169,129,89,0.18)] text-[#2D2926]'
      }`}
      style={isAccent
        ? { background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)', boxShadow: '0 6px 24px rgba(45,41,38,0.28)' }
        : { boxShadow: '0 2px 10px rgba(45,41,38,0.06)' }}
    >
      {isAccent && (
        <div className="absolute top-0 right-0 left-0 h-0.5 opacity-70"
          style={{ background: 'linear-gradient(90deg, transparent, #C4A46E, transparent)' }} />
      )}

      <div className="relative flex-shrink-0">
        <div className={`absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover/menu:opacity-60 transition-opacity duration-500 ${isAccent ? 'bg-[#C4A46E]' : 'bg-[#A98159]'}`} />
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-md border-2 transition-transform duration-300 group-hover/menu:scale-110 group-hover/menu:rotate-3"
          style={isAccent
            ? { background: 'linear-gradient(135deg, rgba(196,164,110,0.18), rgba(169,129,89,0.10))', borderColor: 'rgba(196,164,110,0.35)' }
            : { background: 'linear-gradient(135deg, #FDF8F0, #F3EAE0)', borderColor: 'rgba(169,129,89,0.25)' }}
        >
          <Icon size={26} className="text-[#A98159]" />
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
              <CheckCircle2 size={10} strokeWidth={2.5} />
              {doneBadge}
            </span>
          )}
        </div>
        <p className={`text-sm mt-1 truncate ${isAccent ? 'text-white/60' : 'text-[#6D6E71]'}`}>{subtitle}</p>
      </div>

      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 group-hover/menu:-translate-x-1 ${
        isAccent ? 'bg-white/10 group-hover/menu:bg-white/20' : 'bg-[#FDF8F0] group-hover/menu:bg-[#A98159]/15'
      }`}>
        <ChevronLeft size={16} strokeWidth={2.5} className={isAccent ? 'text-white' : 'text-[#A98159]'} />
      </div>
    </button>
  );
};

const ACTIVITY_CFG = {
  reports:           { label: 'بلاغ طارئ',      Icon: AlertTriangle,  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  meal_evaluations:  { label: 'تقييم وجبات',      Icon: Utensils,       color: '#A98159', bg: '#FDF8F0', border: '#D1C4B9' },
  mina_readiness:    { label: 'جاهزية منى',        Icon: HomeIcon,       color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  arafat_readiness:  { label: 'جاهزية عرفة',      Icon: Mountain,       color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  logistics_requests:{ label: 'طلب إسناد',         Icon: Package,        color: '#3182CE', bg: '#EFF6FF', border: '#BFDBFE' },
  task_completions:  { label: 'مهمة مكتملة',      Icon: ClipboardCheck, color: '#386B41', bg: '#DCFCE7', border: '#86EFAC' },
};

const TASK_TYPE_LABELS = {
  meal_evaluation:  'تقييم جودة الوجبات',
  mina_readiness:   'جاهزية مشعر منى',
  arafat_readiness: 'جاهزية مشعر عرفة',
};
const TASK_TYPE_META = {
  meal_evaluation:  { Icon: Utensils,   color: '#A98159', bg: '#FDF8F0', border: '#E8DDD4' },
  mina_readiness:   { Icon: HomeIcon,   color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  arafat_readiness: { Icon: Mountain,   color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
};
const MEAL_LABELS = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };

function StatMini({ label, value, accent, Icon }) {
  return (
    <div className="group/stat relative bg-gradient-to-br from-white to-[#FDF8F0]/40 rounded-2xl p-3 sm:p-3.5 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.05)] hover:shadow-[0_6px_18px_rgba(169,129,89,0.15)] transition-all duration-300 overflow-hidden"
      style={{ borderRight: `3px solid ${accent}` }}>
      <div className="absolute top-0 right-0 left-0 h-0.5 opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-[#9D8F85] font-semibold mb-0.5 truncate">{label}</p>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums" style={{ color: accent }}>{value}</p>
        </div>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover/stat:opacity-50 transition-opacity"
            style={{ background: accent }} />
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center group-hover/stat:scale-110 transition-transform duration-300"
            style={{ background: `${accent}15` }}>
            <Icon size={16} style={{ color: accent }} strokeWidth={2} />
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
      className="group/row min-h-[64px] w-full flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-right hover:bg-gradient-to-l hover:from-[#FDFAF7] hover:to-transparent active:bg-[#FDF8F0] transition-all duration-300"
    >
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover/row:opacity-50 transition-opacity"
          style={{ background: meta.color }} />
        <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border-2 group-hover/row:scale-110 group-hover/row:rotate-3 transition-transform duration-300"
          style={{ background: meta.bg, borderColor: meta.border }}>
          <TIcon size={18} style={{ color: meta.color }} strokeWidth={2} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold text-[#2D2926] leading-tight">{label}</p>
          {mealLabel && (
            <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full text-white shrink-0"
              style={{ background: meta.color }}>
              {mealLabel}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#9D8F85] mt-0.5 truncate">
          <span className="font-bold text-[#A98159]">{task.center}</span>
          {task.scheduledDate && <> · <span className="text-[10px]">{task.scheduledDate}</span></>}
        </p>
      </div>
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#FDF8F0] group-hover/row:bg-[#A98159] flex items-center justify-center group-hover/row:-translate-x-1 transition-all duration-300">
        <ChevronLeft size={16} className="text-[#A98159] group-hover/row:text-white transition-colors" strokeWidth={2.5} />
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
      className="group/center relative bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-2xl p-4 border-2 border-[#EDE5DC] hover:border-[#A98159]/40 hover:shadow-[0_6px_20px_rgba(169,129,89,0.15)] hover:-translate-y-0.5 transition-all duration-300 text-right overflow-hidden"
    >
      <div className="absolute top-0 right-0 left-0 h-1 opacity-70"
        style={{ background: 'linear-gradient(90deg, transparent, #A98159, transparent)' }} />
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 group-hover/center:scale-110 transition-transform"
            style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
            <Building2 size={14} className="text-white" strokeWidth={2.25} />
          </div>
          <p className="text-sm font-bold text-[#2D2926] truncate">{centerId}</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="text-[10px] text-[#9D8F85] font-medium">لا توجد مهام مُسندة</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
            <span className="text-[#9D8F85]">التقدم</span>
            <span className="text-[#A98159] tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 bg-[#F5F0EB] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#10B981' : pct > 0 ? '#F59E0B' : '#A98159',
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
  in_progress: { label: 'جارٍ التنفيذ', bg: '#DBEAFE', text: '#1E40AF' },
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

  
  const [allAssignedTasks, setAllAssignedTasks] = useState([]);
  const [allCompletions,   setAllCompletions]   = useState([]);

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
        hijri: now.toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' }),
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
    const cn = extractCenterNum(selectedCenter);

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
      setAssignedForCenter(rows.filter(t => (t.targetCenters || []).includes(cn)))
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
      return;
    }
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const allowed = new Set(assignedCenters);

    const unsubAssigned = supaDb.assigned_tasks.subscribe(rows => {
      setAllAssignedTasks(
        rows.filter(t => (t.targetCenters || []).some(cn => allowed.has(`مركز ${cn}`)))
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

    return () => { unsubAssigned(); unsubCompletions(); };
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
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
      <Loader2 className="animate-spin text-[#A98159]" size={40} />
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
        .map(cn => `مركز ${cn}`)
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
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] font-arabic pb-10 overflow-x-hidden text-right">
      
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

      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-xs font-bold text-[#2D2926]">ضيوف البيت</p>
              <p className="text-[10px] text-[#A98159] font-bold leading-tight">لوحة تحكم المشرف</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="w-10 h-10 rounded-xl border border-[#D1C4B9] flex items-center justify-center hover:bg-[#FDF8F0] transition-colors relative"
              >
                <Bell size={18} className="text-[#6D6E71]" />
                {globalNotifs.length > 0 && (
                  <span className="badge-pulse-red absolute -top-1 -left-1 min-w-[20px] h-[20px] px-1.5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white shadow-md tabular-nums">
                    {globalNotifs.length > 99 ? '99+' : globalNotifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute top-12 left-0 w-80 max-w-[90vw] bg-white border border-[#D1C4B9] rounded-2xl shadow-2xl z-[102] overflow-hidden">
                  <div className="px-4 py-3 bg-[#FDF8F0] border-b border-[#D1C4B9] flex items-center justify-between">
                    <span className="text-sm font-black text-[#2D2926]">إشعارات اليوم</span>
                    <span className="text-[10px] font-bold text-[#A98159]">{globalNotifs.length} جديد</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {globalNotifs.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell size={28} className="mx-auto text-[#D1C4B9] mb-2 opacity-40" />
                        <p className="text-xs text-[#6D6E71] font-bold">لا توجد إشعارات اليوم</p>
                      </div>
                    ) : (
                      globalNotifs.map(n => (
                        <div key={n.id} className="px-4 py-3 border-b border-[#D1C4B9]/40 last:border-b-0 hover:bg-[#FDF8F0]/40 transition-colors">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={14} className="text-[#386B41] mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-xs font-bold text-[#2D2926] leading-snug">
                                تم رفع {TASK_TYPE_LABELS[n.taskType] || n.taskType}
                                {n.mealType ? ` — ${MEAL_LABELS[n.mealType] || ''}` : ''}
                              </p>
                              <p className="text-[10px] text-[#A98159] font-bold mt-0.5">
                                {n.center} · بواسطة: {n.observerName || 'مراقب'}
                              </p>
                              <p className="text-[9px] text-[#6D6E71] mt-0.5">
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
              className="w-10 h-10 rounded-xl bg-[#FDF8F0] border border-[#A98159]/20 flex items-center justify-center hover:bg-[#A98159] hover:text-white group transition-all"
            >
              <User size={18} className="text-[#A98159] group-hover:text-white" />
            </button>
          </div>
        </div>
      </header>

      {}
      {!selectedCenter && (
        <main className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">

          {/* Welcome strip */}
          <div className="animate-fade-slide-up rounded-[2rem] overflow-hidden shadow-xl">
            <div className="p-5 sm:p-7 relative overflow-hidden bg-gradient-to-br from-[#3D3330] via-[#2D2926] to-[#1F1A17]">
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #A98159 0, #A98159 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 relative">
                <div className="flex-1 min-w-0">
                  <p className="text-white/50 text-xs sm:text-sm mb-1">مرحباً (مشرف ميداني)،</p>
                  <h2 className="text-white font-bold text-xl sm:text-2xl truncate">{profile?.nameAr || profile?.name || 'المشرف الميداني'}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <MapPin size={13} className="text-[#A98159]" />
                    <span className="text-[#A98159] text-xs sm:text-sm font-bold">
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
              accent="#3182CE"
              Icon={Building2}
            />
            <StatMini
              label="مهام مُسندة"
              value={allAssignedTasks.length}
              accent="#A98159"
              Icon={ClipboardCheck}
            />
          </div>

          {/* Pending tasks (cross-center) */}
          <section className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-3xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDE5DC] flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #fff 55%)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FCA5A5, #EF4444)' }}>
                  <Clock size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#2D2926]">مهام تحتاج إجراء</h2>
                  <p className="text-[11px] text-[#9D8F85] mt-0.5">
                    {pendingTasks.length === 0 ? 'كل المهام مكتملة 🎉' : `${pendingTasks.length} مهمة عبر مراكزك`}
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-[#EDE5DC]">
              {pendingTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="relative w-fit mx-auto mb-3">
                    <div className="absolute inset-0 rounded-2xl blur-xl bg-green-400 opacity-30" />
                    <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)' }}>
                      <CheckCircle2 size={26} className="text-green-600" strokeWidth={2} />
                    </div>
                  </div>
                  <p className="text-[#16A34A] font-bold text-sm">جميع مهامك مكتملة!</p>
                  <p className="text-[#6D6E71] text-xs mt-1">لا توجد مهام معلّقة في أي من مراكزك</p>
                </div>
              ) : (
                pendingTasks.slice(0, 10).map(task => (
                  <PendingTaskRow key={task.key} task={task} onClick={() => goToTaskUpload(task)} />
                ))
              )}
            </div>
            {pendingTasks.length > 10 && (
              <div className="px-5 py-3 bg-[#FDFAF7] border-t border-[#EDE5DC] text-center">
                <p className="text-xs text-[#6D6E71] font-medium">
                  معروض ١٠ من أصل {pendingTasks.length} مهمة — افتح مركزاً معيناً لرؤية مهامه
                </p>
              </div>
            )}
          </section>

          {/* Today's activity feed (cross-center) */}
          <section className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-3xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDE5DC] flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #fff 55%)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #86EFAC, #16A34A)' }}>
                <ClipboardCheck size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#2D2926]">نشاط اليوم</h2>
                <p className="text-[11px] text-[#9D8F85] mt-0.5">
                  {globalNotifs.length === 0 ? 'لا يوجد رفع اليوم بعد' : `${globalNotifs.length} رفع من مراقبيك`}
                </p>
              </div>
            </div>
            <div className="divide-y divide-[#EDE5DC]">
              {globalNotifs.length === 0 ? (
                <div className="py-10 text-center">
                  <Clock size={32} className="mx-auto text-[#D1C4B9] mb-2 opacity-50" />
                  <p className="text-[#6D6E71] text-sm font-bold">لا يوجد نشاط من المراقبين اليوم</p>
                </div>
              ) : (
                globalNotifs.slice(0, 8).map(n => (
                  <div key={n.id} className="group/row flex items-center gap-3 px-5 py-3 hover:bg-gradient-to-l hover:from-green-50/30 hover:to-transparent transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-green-200"
                      style={{ background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)' }}>
                      <CheckCircle2 size={18} className="text-green-600" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#2D2926] truncate">
                        تم رفع {TASK_TYPE_LABELS[n.taskType] || n.taskType}
                        {n.mealType ? ` — ${MEAL_LABELS[n.mealType] || ''}` : ''}
                      </p>
                      <p className="text-[11px] text-[#9D8F85] mt-0.5 truncate">
                        <span className="font-bold text-[#A98159]">{n.center}</span> · بواسطة: {n.observerName || 'مراقب'}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#9D8F85] font-bold tabular-nums shrink-0">
                      {new Date(n.timestamp?.toMillis?.() || 0).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Centers grid */}
          <section className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-3xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDE5DC] flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, #FDF8F0 0%, #fff 55%)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
                <Building2 size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#2D2926]">مراكزي</h2>
                <p className="text-[11px] text-[#9D8F85] mt-0.5">ادخل على مركز للاطلاع التفصيلي</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {assignedCenters.map(c => (
                <CenterCard
                  key={c}
                  centerId={c}
                  stats={centerStats[c]}
                  onClick={() => {
                    setSelectedCenter(c);
                    sessionStorage.setItem('sup_selected_center', c);
                  }}
                />
              ))}
            </div>
          </section>

          {/* Today's menu — supervisor sees menu per assigned center */}
          {assignedCenters.length > 0 && (
            <TodayMenuCard centerIds={assignedCenters} />
          )}

          {/* Quick logout */}
          <div className="pt-2 pb-8 text-center">
            <button onClick={handleLogout}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-red-500 hover:text-white text-sm font-bold border border-red-200 hover:bg-red-500 hover:border-red-500 transition-all">
              <LogOut size={14} />
              تسجيل الخروج
            </button>
          </div>
        </main>
      )}

      {}
      {selectedCenter && (
      <main className="max-w-5xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* Back to dashboard */}
          <button
            onClick={() => { setSelectedCenter(null); sessionStorage.removeItem('sup_selected_center'); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#EDE5DC] bg-white text-[#6D6E71] hover:text-[#A98159] hover:border-[#A98159]/40 text-xs font-bold transition-all"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
            العودة للوحة الرئيسية
          </button>

          <div className="animate-fade-slide-up shadow-xl rounded-[2.5rem] overflow-hidden">
            <div className="p-8 relative overflow-hidden bg-[#2D2926]">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #A98159 0, #A98159 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
              <div className="flex items-start justify-between mb-6 relative">
                <div className="flex-1 min-w-0">
                  <p className="text-white/50 text-sm mb-1">مرحباً بك (مشرف)،</p>
                  <h2 className="text-white font-bold text-2xl truncate">{profile?.nameAr || profile?.name || 'المشرف الميداني'}</h2>
                  <div className="flex items-center gap-2 mt-2"><MapPin size={14} className="text-[#A98159]" /><span className="text-[#A98159] text-sm font-bold">نطاق الإشراف الميداني</span></div>
                </div>
                <button onClick={() => setIsSheetOpen(true)} className="bg-white/10 hover:bg-white/20 transition-all rounded-2xl px-5 py-3 text-center border border-white/10 flex flex-col items-center min-w-[100px]">
                  <p className="text-white/50 text-[10px] mb-1 font-bold">المركز الحالي</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[#A98159] font-bold text-2xl">{selectedCenter?.replace('مركز ', '') || '—'}</p>
                    <ChevronDown size={16} className="text-white/50" />
                  </div>
                </button>
              </div>
              <div className="mb-6 relative w-48"><GoldRule /></div>
              <div className="bg-white/5 rounded-2xl px-5 py-4 border border-white/10 backdrop-blur-sm flex items-start gap-3">
                <Building2 size={18} className="text-[#A98159] mt-0.5" />
                <div><p className="text-white/50 text-[10px] mb-1">{selectedCenter} — المتعهد المسجل</p><p className="text-white text-sm font-bold leading-snug">{caterer}</p></div>
              </div>
            </div>
            <div className="bg-[#FDF8F0] px-6 py-3 flex items-center justify-between border-t border-[#D1C4B9]/30">
              <div className="flex items-center gap-2 text-[#A98159]"><TrendingUp size={14} /><span className="text-xs font-bold text-[#2D2926]">{clock.hijri}</span></div>
              <div className="flex items-center gap-2"><Clock size={12} className="text-[#6D6E71]" /><span className="text-xs text-[#6D6E71] font-bold">{clock.time}</span></div>
            </div>
          </div>

          {/* Today's menu for the selected center */}
          {selectedCenter && (
            <TodayMenuCard centerId={selectedCenter} />
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <ClipboardCheck size={20} className="text-[#A98159]" />
              <span className="text-lg font-black text-[#2D2926]">نشاط مراقبي {selectedCenter}</span>
            </div>
            {activities.length === 0 ? (
              <div className="bg-white border border-[#D1C4B9] rounded-3xl py-12 text-center shadow-sm">
                <Clock size={40} className="mx-auto text-[#D1C4B9] mb-3 opacity-40" />
                <p className="text-[#6D6E71] text-sm font-bold">لا يوجد نشاط مسجل للمركز اليوم</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {displayed.map(item => {
                  const cfg = ACTIVITY_CFG[item._col];
                  const statusInfo = STATUS_DATA[item.status] || { label: item.status, bg: '#F3F4F6', text: '#374151' };
                  return (
                    <div key={item.id} className="bg-white border border-[#D1C4B9] rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                      <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: cfg.color }} />
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}><cfg.Icon size={20} style={{ color: cfg.color }} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          {item._col === 'task_completions' ? (
                            <p className="text-sm font-bold text-[#2D2926] leading-snug">
                              تم رفع <span className="text-[#386B41]">{TASK_TYPE_LABELS[item.taskType] || item.taskType}</span>
                              {item.mealType ? ` — ${MEAL_LABELS[item.mealType] || ''}` : ''}
                            </p>
                          ) : (
                            <p className="text-base font-bold text-[#2D2926] truncate">{item.reportType || item.type || cfg.label}</p>
                          )}
                          <span className="text-xs text-[#6D6E71] font-bold shrink-0 mr-2">
                            {new Date(item._sortTs || item.timestamp?.toMillis?.() || 0).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-[#A98159] font-bold flex items-center gap-1">
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
                  );
                })}
                {activities.length > 4 && <button onClick={() => setShowAll(!showAll)} className="w-full py-3 text-[#A98159] font-bold text-sm bg-white hover:bg-gray-50 rounded-2xl transition-all border border-dashed border-[#D1C4B9] mt-2">{showAll ? 'عرض أقل' : `عرض الكل (${activities.length})`}</button>}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-[#D1C4B9]/50" /><span className="text-[10px] font-black text-[#A98159] uppercase tracking-widest">إجراءات المشرف</span><div className="h-px flex-1 bg-[#D1C4B9]/50" /></div>
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
      </main>
      )}

      {/* Side Profile Menu */}
      <div className={`fixed inset-y-0 left-0 z-[101] w-full max-w-sm bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform border-r border-[#D1C4B9] ${isProfileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col bg-[#FDFCFB]">
          <div className="p-8 bg-[#2D2926] text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #A98159 1px, transparent 0)', backgroundSize: '20px 20px' }} />
            <button onClick={() => setIsProfileOpen(false)} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><ChevronLeft size={20} className="rotate-180" /></button>
            <div className="relative mt-4 text-center">
              <div className="w-20 h-20 rounded-[2rem] bg-[#A98159] flex items-center justify-center shadow-2xl mb-4 border-4 border-white/10 mx-auto"><User size={40} className="text-white" /></div>
              <h3 className="text-2xl font-bold">{profile?.nameAr || profile?.name}</h3>
              <p className="text-[#A98159] text-sm font-bold mt-1 opacity-80 uppercase tracking-widest">مشرف ميداني</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black text-[#A98159] uppercase tracking-[0.2em] px-2 text-right">معلومات الحساب</p>
              <div className="bg-white border border-[#D1C4B9] rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#FDF8F0] flex items-center justify-center text-[#A98159]"><Mail size={18} /></div>
                <div className="min-w-0 text-right"><p className="text-[10px] text-[#6D6E71] font-bold">البريد الإلكتروني</p><p className="text-sm font-bold text-[#2D2926] truncate">{user?.email}</p></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                 <span className="bg-[#A98159]/10 text-[#A98159] text-[10px] font-bold px-2 py-0.5 rounded-full">{assignedCenters.length} مراكز</span>
                 <p className="text-[10px] font-black text-[#A98159] uppercase tracking-[0.2em]">نطاق الإشراف</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {assignedCenters.map(center => (
                  <div key={center} className="flex items-center justify-between p-4 bg-white border border-[#D1C4B9] rounded-2xl shadow-sm">
                    {selectedCenter === center ? <CheckCircle2 size={16} className="text-[#386B41]" /> : <div />}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#2D2926]">{center}</span>
                      <div className="w-2 h-2 rounded-full bg-[#A98159]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-[#D1C4B9]">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-4 bg-[#BA1A1A] text-white rounded-2xl font-bold shadow-lg transition-all active:scale-[0.98]"><LogOut size={20} /> تسجيل الخروج</button>
          </div>
        </div>
      </div>

      {/* Bottom Sheet for Center Selection */}
      <div className={`fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-[3rem] shadow-2xl transition-transform duration-500 transform border-t border-[#D1C4B9] ${isSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center py-5 cursor-pointer" onClick={() => setIsSheetOpen(false)}><div className="w-14 h-1.5 bg-[#D1C4B9] rounded-full opacity-40" /></div>
        <div className="px-8 pb-12 max-h-[70vh] overflow-y-auto text-center">
          <h3 className="text-xl font-black text-[#2D2926] mb-6">تبديل مركز الإشراف</h3>
          <div className="grid grid-cols-1 gap-3">
            {assignedCenters.map(centerItem => (
              <button key={centerItem} onClick={() => { setSelectedCenter(centerItem); sessionStorage.setItem('sup_selected_center', centerItem); setTimeout(() => setIsSheetOpen(false), 200); }} className={`w-full flex items-center justify-between px-6 py-5 rounded-[1.5rem] font-bold transition-all ${selectedCenter === centerItem ? 'bg-[#FDF8F0] text-[#A98159] border-2 border-[#A98159]' : 'bg-[#F9F7F5] border-2 border-transparent hover:border-[#D1C4B9]'}`}>
                <div className="flex items-center gap-4"><div className={`w-3 h-3 rounded-full ${selectedCenter === centerItem ? 'bg-[#A98159]' : 'bg-gray-300'}`} /><span>{centerItem}</span></div>
                {selectedCenter === centerItem && <CheckCircle2 size={20} className="text-[#A98159]" />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <footer className="max-w-5xl mx-auto px-8 py-6 text-center"><p className="text-[10px] text-[#6D6E71]/60 font-bold uppercase tracking-widest">© ١٤٤٧ هـ — لوحة إشراف منظومة المراقبة الميدانية</p></footer>
      <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-slide-up { animation: fadeSlideUp 0.5s ease-out forwards; } @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}