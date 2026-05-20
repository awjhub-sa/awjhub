import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db.js';
import {
  Truck, Package, ChevronRight, Pencil, Trash2, X, Save, User, Building2, Clock,
  Filter, CheckCircle2, XCircle, ThumbsUp, Sparkles, AlertTriangle, Search,
  MapPin, Hash, Factory, Calendar, Activity, ArrowRight, ArrowLeft, Layers,
} from 'lucide-react';
import PageHeader from '../../components/PageHeader.jsx';
import NotificationBadge from '../../components/NotificationBadge.jsx';
import { getCaterer, getShakhis, getLocation } from '../../config/centers.js';
import {
  computeStatusUpdate, TERMINAL_LOGISTICS_STATUSES,
} from '../../lib/statusTracking.js';
import { StatusTimerChip, StatusTimeline } from '../../components/StatusTimeline.jsx';

/* A request is "new" when pending AND submitted within the last 10 minutes */
const NEW_THRESHOLD_MS = 10 * 60 * 1000;
const isNewLogistics = r => {
  if (r.status && r.status !== 'pending') return false;
  const ts = r.timestamp?.toMillis?.() ?? r.createdAt?.toMillis?.() ?? 0;
  return ts > 0 && (Date.now() - ts) < NEW_THRESHOLD_MS;
};

/* Labels for the linked-report badge (matches AdminReports.REPORT_TYPE_MAP) */
const REPORT_TYPE_LABEL = {
  water: 'تسرب مياه', electric: 'عطل كهربائي', crowd: 'ازدحام حرج', food: 'مشكلة غذائية',
  medical: 'حالة طبية طارئة', security: 'بلاغ أمني', fire: 'حريق / دخان', other: 'بلاغ آخر',
  shortage: 'نقص في الكميات', delay: 'تأخر في التوزيع', quality: 'مشكلة في الجودة', hygiene: 'مخالفة صحية',
};

/* ── constants ── */
const STATUS_OPTIONS = [
  { value: 'pending',   label: 'قيد الانتظار', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', Icon: Clock        },
  { value: 'approved',  label: 'موافق عليه',   color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', Icon: ThumbsUp     },
  { value: 'delivered', label: 'تم التسليم',   color: '#10B981', bg: '#F0FDF4', border: '#86EFAC', Icon: CheckCircle2 },
  { value: 'rejected',  label: 'مرفوض',        color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', Icon: XCircle      },
];
const STATUS_LOOKUP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));
const getSB = r => STATUS_LOOKUP[r.status] || STATUS_OPTIONS[0];

const SUPPORT_TYPES = [
  { value: 'internal', label: 'داخلي',            short: 'داخلي',         Icon: ArrowRight, color: '#3B82F6' },
  { value: 'external', label: 'خارجي',            short: 'خارجي',         Icon: ArrowLeft,  color: '#8B5CF6' },
  { value: 'both',     label: 'داخلي وخارجي',     short: 'داخلي وخارجي',  Icon: Layers,     color: '#1D6FA4' },
];
const SUPPORT_LOOKUP = Object.fromEntries(SUPPORT_TYPES.map(t => [t.value, t]));

/* ── helpers ── */
function timeAgo(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60)    return 'الآن';
    if (s < 3600)  return `منذ ${Math.floor(s / 60)} دقيقة`;
    if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
    return `منذ ${Math.floor(s / 86400)} يوم`;
  } catch { return '—'; }
}
function fullDate(ts) {
  if (!ts) return '—';
  try {
    return (ts.toDate ? ts.toDate() : new Date(ts))
      .toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return '—'; }
}

export default function AdminLogistics() {
  const [requests,    setRequests]    = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [searchTerm,  setSearchTerm]  = useState('');
  const [expanded,    setExpanded]    = useState(null);
  const [editingReq,  setEditingReq]  = useState(null);

  useEffect(() => {
    return db.logistics_requests.subscribe(rows => {
      const docs = [...rows].sort((a, b) =>
        (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
      setRequests(docs);
    });
  }, []);

  const handleStatus = (id, newStatus) => {
    const current = requests.find(r => r.id === id);
    if (!current) return db.logistics_requests.update(id, { status: newStatus });
    const update = computeStatusUpdate(current, newStatus, TERMINAL_LOGISTICS_STATUSES);
    return db.logistics_requests.update(id, update || { status: newStatus });
  };

  const handleSaveEdit = async (id, form) => {
    const current = requests.find(r => r.id === id) || {};
    const statusUpdate = computeStatusUpdate(current, form.status, TERMINAL_LOGISTICS_STATUSES);
    const data = {
      supportType: form.supportType,
      notes:       form.notes,
      ...(statusUpdate || { status: form.status }),
    };
    if ((form.supportType === 'internal' || form.supportType === 'both') && form.qtyInternal !== '')
      data.qtyInternal = Number(form.qtyInternal);
    if ((form.supportType === 'external' || form.supportType === 'both') && form.qtyExternal !== '')
      data.qtyExternal = Number(form.qtyExternal);
    await db.logistics_requests.update(id, data);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    await db.logistics_requests.delete(id);
    if (expanded === id) setExpanded(null);
  };

  const handleSaveNotes = (id, adminNotes) => db.logistics_requests.update(id, { adminNotes });

  const countOf = v => requests.filter(r => r.status === v || (!r.status && v === 'pending')).length;

  const filtered = useMemo(() => {
    let list = filter === 'all' ? requests
      : requests.filter(r => r.status === filter || (!r.status && filter === 'pending'));
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(r =>
        (r.center        || '').toLowerCase().includes(q) ||
        (r.observer      || '').toLowerCase().includes(q) ||
        (r.notes         || '').toLowerCase().includes(q) ||
        (r.requestNumber || '').toString().includes(q) ||
        (r.reportNumber  || '').toString().includes(q) ||
        (getCaterer(r.center) || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, filter, searchTerm]);

  return (
    <div className="space-y-5 pb-6" dir="rtl">

      {/* Header */}
      <PageHeader
        Icon={Truck}
        title="الإسناد اللوجستي"
        subtitle={`${requests.length} طلب إجمالاً · تحديث فوري`}
        gradient={{ from: '#93C5FD', to: '#3182CE' }}
        glowColor="rgba(49,130,206,0.4)"
        right={
          countOf('pending') > 0 ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200/60 rounded-2xl px-4 py-2 shadow-[0_2px_10px_rgba(59,130,246,0.12)]">
              <NotificationBadge count={countOf('pending')} variant="blue" />
              <div className="text-right">
                <p className="text-[10px] font-bold text-blue-700 leading-none">قيد الانتظار</p>
                <p className="text-[9px] text-blue-500 mt-1 font-medium">يحتاج موافقة</p>
              </div>
            </div>
          ) : null
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الطلبات', value: requests.length,       color: '#A98159', Icon: Truck        },
          { label: 'قيد الانتظار',    value: countOf('pending'),    color: '#F59E0B', Icon: Clock        },
          { label: 'موافق عليه',      value: countOf('approved'),   color: '#3B82F6', Icon: ThumbsUp     },
          { label: 'تم التسليم',      value: countOf('delivered'),  color: '#10B981', Icon: CheckCircle2 },
        ].map(c => (
          <div key={c.label}
            className="bg-white rounded-2xl p-4 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)] flex items-center gap-3"
            style={{ borderRight: `3px solid ${c.color}` }}>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-0.5">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${c.color}18` }}>
              <c.Icon size={18} style={{ color: c.color }} strokeWidth={1.75} />
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="bg-white border border-[#EDE5DC] rounded-2xl p-1.5 flex overflow-x-auto no-scrollbar shadow-[0_2px_8px_rgba(45,41,38,0.05)]">
        {[
          { value: 'all',       label: 'الكل',         count: requests.length,        Icon: Filter,        color: '#6D6E71' },
          { value: 'pending',   label: 'قيد الانتظار', count: countOf('pending'),     Icon: Clock,         color: '#F59E0B' },
          { value: 'approved',  label: 'موافق عليه',   count: countOf('approved'),    Icon: ThumbsUp,      color: '#3B82F6' },
          { value: 'delivered', label: 'تم التسليم',   count: countOf('delivered'),   Icon: CheckCircle2,  color: '#10B981' },
          { value: 'rejected',  label: 'مرفوض',         count: countOf('rejected'),    Icon: XCircle,       color: '#EF4444' },
        ].map(opt => {
          const active = filter === opt.value;
          const OIcon = opt.Icon;
          return (
            <button key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                active ? 'text-white shadow-md' : 'text-[#6D6E71] hover:text-[#2D2926] hover:bg-[#FDF8F0]'
              }`}
              style={active
                ? { background: `linear-gradient(135deg, ${opt.color}, ${opt.color}DD)` }
                : undefined}>
              <OIcon size={14} strokeWidth={2.25} />
              {opt.label}
              <span className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded-md ${
                active ? 'bg-white/25' : ''
              }`}
                style={!active ? { background: `${opt.color}15`, color: opt.color } : undefined}>
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9D8F85]" strokeWidth={2} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث برقم الطلب، البلاغ، المركز، المراقب..."
          className="w-full pr-11 pl-4 py-3 rounded-2xl border-2 border-[#EDE5DC] bg-white text-sm font-medium text-[#2D2926] placeholder:text-[#C9B8A8] focus:border-[#3B82F6] focus:outline-none transition-colors shadow-[0_2px_8px_rgba(45,41,38,0.05)]"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-[#9D8F85] hover:bg-[#F5F0EB] transition-colors">
            <X size={14} strokeWidth={2.25} />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-3xl border border-[#EDE5DC] py-20 text-center shadow-[0_2px_12px_rgba(45,41,38,0.06)]">
            <div className="relative w-fit mx-auto mb-3 group">
              <div className="absolute inset-0 rounded-2xl blur-xl bg-blue-400 opacity-30 group-hover:opacity-60 transition-opacity" />
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                style={{ background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)' }}>
                <Truck size={24} className="text-blue-400" strokeWidth={1.75} />
                <Sparkles size={9} className="absolute -top-0.5 -right-0.5 text-blue-300 drop-shadow animate-pulse" />
              </div>
            </div>
            <p className="text-[#6D6E71] text-sm font-medium">لا توجد طلبات تطابق البحث</p>
          </div>
        ) : filtered.map(r => (
          <RequestCard
            key={r.id}
            request={r}
            isOpen={expanded === r.id}
            onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
            onStatus={handleStatus}
            onEdit={() => setEditingReq(r)}
            onDelete={() => handleDelete(r.id)}
            onSaveNotes={handleSaveNotes}
          />
        ))}
      </div>

      {/* Edit Modal */}
      {editingReq && (
        <EditModal
          req={editingReq}
          onClose={() => setEditingReq(null)}
          onSave={handleSaveEdit}
        />
      )}

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

function RequestCard({ request: r, isOpen, onToggle, onStatus, onEdit, onDelete, onSaveNotes }) {
  const [notes, setNotes]             = useState(r.adminNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes,  setSavedNotes]  = useState(false);
  useEffect(() => { setNotes(r.adminNotes || ''); setSavedNotes(false); }, [r.id]);
  const handleSaveNotes = async (e) => {
    e.stopPropagation();
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      await onSaveNotes?.(r.id, notes);
      setSavedNotes(true);
      setTimeout(() => setSavedNotes(false), 4000);
    } catch (err) { alert(`فشل حفظ الملاحظات: ${err?.message || err}`); }
    setSavingNotes(false);
  };
  const b  = getSB(r);
  const st = SUPPORT_LOOKUP[r.supportType] || SUPPORT_TYPES[0];
  const isNew = isNewLogistics(r);
  const StatusIcon  = b.Icon;
  const SupportIcon = st.Icon;

  const hasInternal = r.qtyInternal != null && r.qtyInternal !== '';
  const hasExternal = r.qtyExternal != null && r.qtyExternal !== '';
  const totalQty = (Number(r.qtyInternal) || 0) + (Number(r.qtyExternal) || 0);

  return (
    <div
      className={`group/row relative bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_28px_rgba(45,41,38,0.10)] ${
        isNew && !isOpen ? 'card-pulse-blue' : ''
      }`}
      style={!isNew || isOpen ? {
        borderColor: isOpen ? `${st.color}40` : '#EDE5DC',
        boxShadow: isOpen ? `0 8px 28px ${st.color}1F` : '0 2px 10px rgba(45,41,38,0.06)',
      } : undefined}
    >
      {/* "جديد" floating pill */}
      {isNew && !isOpen && (
        <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md text-white shadow-md tabular-nums tracking-wide"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          جديد
        </span>
      )}
      {/* Top status strip */}
      <div className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${b.color}, ${b.color}66, transparent)` }} />

      {/* Card body */}
      <button onClick={onToggle}
        className="w-full text-right p-4 sm:p-5 flex items-start gap-3 sm:gap-4 hover:bg-[#FDFAF7] transition-colors">
        {/* Icon */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl blur-md opacity-50 group-hover/row:opacity-80 transition-opacity"
            style={{ background: st.color }} />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md"
            style={{
              background: `linear-gradient(135deg, ${st.color}, ${st.color}CC)`,
              border: '2px solid rgba(255,255,255,0.7)',
            }}>
            <Package size={26} className="text-white" strokeWidth={2} />
          </div>
          {isNew && (
            <div className="absolute -top-1.5 -right-1.5 badge-pulse-blue w-5 h-5 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
              <Sparkles size={9} className="text-white" strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-base sm:text-lg font-black text-[#2D2926] leading-tight">طلب إسناد</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border"
              style={{ background: `${st.color}15`, borderColor: `${st.color}40`, color: st.color }}>
              <SupportIcon size={10} strokeWidth={2.5} />
              {st.short}
            </span>
            {r.requestNumber && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums tracking-wide ${
                isNew ? 'badge-pulse-blue text-white' : 'text-[#2D2926] border'
              }`}
                style={isNew
                  ? { background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }
                  : { background: '#EFF6FF', borderColor: '#BFDBFE' }}>
                #{r.requestNumber}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px] text-[#6D6E71] flex-wrap mb-1.5">
            <span className="flex items-center gap-1">
              <User size={11} strokeWidth={2.25} className="text-[#A98159]" />
              <span className="font-bold text-[#2D2926]">{r.observer || '—'}</span>
            </span>
            <span className="flex items-center gap-1">
              <Building2 size={11} strokeWidth={2.25} className="text-[#A98159]" />
              <span className="font-bold text-[#2D2926]">{r.center || '—'}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} strokeWidth={2.25} className="text-[#A98159]" />
              <span className="font-bold">{timeAgo(r.timestamp)}</span>
            </span>
          </div>

          {/* Caterer accent + timer chip */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#A98159] bg-[#FDF8F0] border border-[#E8DDD4] rounded-md px-2 py-0.5">
              <Factory size={10} strokeWidth={2.25} />
              <span className="truncate max-w-[200px]">{r.caterer || getCaterer(r.center) || '—'}</span>
            </div>
            <StatusTimerChip doc={r} terminalStatuses={TERMINAL_LOGISTICS_STATUSES} statusMeta={STATUS_LOOKUP} />
          </div>

          {/* Quantity chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {hasInternal && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
                <ArrowRight size={10} strokeWidth={2.5} />
                داخلي
                <span className="tabular-nums bg-white border border-blue-200 rounded px-1.5 ms-0.5">{r.qtyInternal}</span>
              </span>
            )}
            {hasExternal && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-700">
                <ArrowLeft size={10} strokeWidth={2.5} />
                خارجي
                <span className="tabular-nums bg-white border border-violet-200 rounded px-1.5 ms-0.5">{r.qtyExternal}</span>
              </span>
            )}
            {(hasInternal || hasExternal) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-[#FDF8F0] border border-[#E8DDD4] text-[#A98159]">
                المجموع <span className="tabular-nums">{totalQty}</span>
              </span>
            )}
          </div>

          {/* Linked report compact chip */}
          {r.reportNumber && !isOpen && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              <AlertTriangle size={10} strokeWidth={2.5} className="text-amber-600" />
              مرتبط بالبلاغ
              <span className="tabular-nums bg-white border border-amber-300 rounded px-1.5 text-amber-700">#{r.reportNumber}</span>
              {r.reportType && (
                <span className="text-amber-700/80">· {REPORT_TYPE_LABEL[r.reportType] || r.reportType}</span>
              )}
            </div>
          )}
        </div>

        {/* Status pill + chevron */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-xl border-2"
            style={{ background: b.bg, borderColor: b.border, color: b.color }}>
            <StatusIcon size={11} strokeWidth={2.5} />
            {b.label}
          </span>
          <div className="w-8 h-8 rounded-lg border border-[#EDE5DC] bg-white flex items-center justify-center transition-transform"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight size={14} className="text-[#A98159]" strokeWidth={2.25} />
          </div>
        </div>
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div className="border-t-2 border-[#EDE5DC]/60 bg-[#FDFCFB] px-4 sm:px-5 py-5 space-y-4">

          {/* Linked report banner — prominent */}
          {r.reportNumber && (
            <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50/40 rounded-2xl border-2 border-amber-200 p-4 flex items-center gap-3 shadow-sm">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-xl blur-md bg-amber-400 opacity-40" />
                <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                  <AlertTriangle size={20} className="text-white" strokeWidth={2.25} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-0.5">
                  مرتبط ببلاغ ميداني
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-black text-[#2D2926] leading-tight">
                    {REPORT_TYPE_LABEL[r.reportType] || r.reportType || 'بلاغ ميداني'}
                  </p>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums tracking-wide bg-white border border-amber-300 text-amber-700">
                    #{r.reportNumber}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Status timeline */}
          <StatusTimeline
            doc={r}
            terminalStatuses={TERMINAL_LOGISTICS_STATUSES}
            statusOrder={['pending', 'approved', 'delivered', 'rejected']}
            statusMeta={STATUS_LOOKUP}
            accentColor={st.color}
          />

          {/* Quick status changer */}
          <div className="bg-white rounded-2xl border border-[#EDE5DC] p-3">
            <p className="text-[10px] font-bold text-[#9D8F85] mb-2 flex items-center gap-1">
              <Activity size={11} strokeWidth={2.25} className="text-[#3B82F6]" />
              تغيير الحالة
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_OPTIONS.map(s => {
                const SIcon = s.Icon;
                const active = (r.status || 'pending') === s.value;
                return (
                  <button key={s.value}
                    onClick={(e) => { e.stopPropagation(); onStatus(r.id, s.value); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${
                      active ? 'shadow-md scale-[1.02]' : 'bg-white border-[#EDE5DC] text-[#6D6E71] hover:border-[#D9CEBC]'
                    }`}
                    style={active
                      ? { background: s.bg, borderColor: s.color, color: s.color }
                      : undefined}>
                    <SIcon size={12} strokeWidth={2.5} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantities big tiles */}
          {(hasInternal || hasExternal) && (
            <div className="grid grid-cols-2 gap-2.5">
              {hasInternal && (
                <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #60A5FA, #3B82F6)' }}>
                    <ArrowRight size={18} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-blue-700">الكمية الداخلية</p>
                    <p className="text-2xl font-black tabular-nums text-blue-700 leading-tight">{r.qtyInternal}</p>
                  </div>
                </div>
              )}
              {hasExternal && (
                <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' }}>
                    <ArrowLeft size={18} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-violet-700">الكمية الخارجية</p>
                    <p className="text-2xl font-black tabular-nums text-violet-700 leading-tight">{r.qtyExternal}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { label: 'المراقب',     val: r.observer, Icon: User,     color: '#A98159' },
              { label: 'المركز',      val: r.center,   Icon: Building2,color: st.color   },
              { label: 'نوع الإسناد', val: st.label,   Icon: SupportIcon, color: st.color },
              { label: 'الوقت',       val: fullDate(r.timestamp), Icon: Calendar, color: '#6D6E71' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-[#EDE5DC] p-2.5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}15` }}>
                  <c.Icon size={13} style={{ color: c.color }} strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-[#9D8F85] font-bold">{c.label}</p>
                  <p className="text-[11px] font-bold text-[#2D2926] truncate">{c.val || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Caterer + Shakhis + Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-gradient-to-br from-[#FDF8F0] to-white rounded-xl border border-[#E8DDD4] p-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
                <Factory size={15} className="text-white" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-[#9D8F85] font-bold">المتعهد</p>
                <p className="text-xs font-black text-[#A98159] truncate leading-tight">
                  {r.caterer || getCaterer(r.center) || '—'}
                </p>
              </div>
            </div>
            {getShakhis(r.center) && (
              <div className="rounded-xl border p-3 flex items-center gap-2.5"
                style={{ background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', borderColor: '#7C3AED40' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
                  <Hash size={15} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-[#9D8F85] font-bold">رقم الشاخص</p>
                  <p className="text-sm font-black tracking-widest leading-tight" style={{ color: '#7C3AED' }}>
                    {getShakhis(r.center)}
                  </p>
                </div>
              </div>
            )}
            {getLocation(r.center) && (
              <a href={getLocation(r.center)} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="rounded-xl border p-3 flex items-center gap-2.5 group/map hover:shadow-[0_4px_16px_rgba(34,197,94,0.18)] hover:-translate-y-0.5 transition-all"
                style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', borderColor: '#22C55E40', textDecoration: 'none' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover/map:scale-110 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
                  <MapPin size={15} className="text-white" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-[#9D8F85] font-bold">الموقع</p>
                  <p className="text-xs font-black group-hover/map:underline" style={{ color: '#16A34A' }}>
                    فتح في خرائط Google ↗
                  </p>
                </div>
              </a>
            )}
          </div>

          {/* Notes */}
          {r.notes && (
            <div className="bg-white rounded-2xl border border-[#EDE5DC] p-4">
              <p className="text-[10px] text-[#9D8F85] font-bold mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-4 rounded-full" style={{ background: st.color }} />
                ملاحظات المراقب
              </p>
              <p className="text-sm text-[#2D2926] leading-relaxed whitespace-pre-wrap">{r.notes}</p>
            </div>
          )}

          {/* Operations room notes */}
          <div className="bg-gradient-to-br from-[#FDF8F0] to-white border border-[#E8DDD4] rounded-2xl p-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-[#9D8F85] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-4 rounded-full bg-[#A98159]" />
                ملاحظات غرفة العمليات
              </p>
              {savedNotes && (
                <span className="text-[10px] font-black text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">
                  ✓ تم الحفظ
                </span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setSavedNotes(false); }}
              rows={3}
              placeholder="اكتب ملاحظات تظهر للمراقب/المشرف الذي رفع الطلب..."
              className="w-full px-3 py-2.5 border border-[#E8DDD4] rounded-xl text-sm text-[#2D2926] placeholder-[#C9B8A8] focus:border-[#A98159] focus:ring-2 focus:ring-[#A98159]/15 outline-none transition-all bg-white resize-none"
            />
            <button onClick={handleSaveNotes} disabled={savingNotes || notes === (r.adminNotes || '')}
              className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-br from-[#C4A46E] to-[#A98159] text-white text-sm font-black shadow-sm active:scale-[0.98] transition-all disabled:opacity-50">
              {savingNotes ? 'جارٍ الحفظ...' : 'حفظ الملاحظات'}
            </button>
          </div>

          {/* Action toolbar */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#EDE5DC]">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black bg-blue-50 text-blue-700 border-2 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
              <Pencil size={13} strokeWidth={2.25} /> تعديل الطلب
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
              <Trash2 size={13} strokeWidth={2.25} /> حذف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ req, onClose, onSave }) {
  const [form, setForm] = useState({
    supportType: req.supportType || 'internal',
    qtyInternal: req.qtyInternal ?? '',
    qtyExternal: req.qtyExternal ?? '',
    notes:       req.notes       || '',
    status:      req.status      || 'pending',
  });
  const [saving, setSaving] = useState(false);

  const showInternal = form.supportType === 'internal' || form.supportType === 'both';
  const showExternal = form.supportType === 'external' || form.supportType === 'both';

  const handleSave = async () => {
    setSaving(true);
    await onSave(req.id, form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE5DC] shrink-0"
          style={{ background: 'linear-gradient(135deg, #EFF6FF, #FDFCFB)' }}>
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl blur-md opacity-40 bg-blue-500" />
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg, #60A5FA, #3B82F6)' }}>
                <Package size={18} className="text-white" strokeWidth={2} />
              </div>
            </div>
            <div>
              <p className="font-black text-[#2D2926] text-sm">تعديل طلب الإسناد</p>
              <p className="text-[11px] text-[#6D6E71] font-bold mt-0.5">{req.observer} · {req.center}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl border border-[#EDE5DC] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors">
            <X size={15} className="text-[#6D6E71]" strokeWidth={2.25} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Observer info (read-only) */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'المراقب', val: req.observer, Icon: User,     color: '#A98159' },
              { label: 'المركز',  val: req.center,   Icon: Building2,color: '#3B82F6' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-[#EDE5DC] p-2.5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}15` }}>
                  <c.Icon size={13} style={{ color: c.color }} strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-[#9D8F85] font-bold">{c.label}</p>
                  <p className="text-[11px] font-bold text-[#2D2926] truncate">{c.val || '—'}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-br from-[#FDF8F0] to-white rounded-xl border border-[#E8DDD4] p-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
              <Factory size={13} className="text-white" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-[#9D8F85] font-bold">المتعهد</p>
              <p className="text-[11px] font-black text-[#A98159] truncate">{req.caterer || getCaterer(req.center) || '—'}</p>
            </div>
          </div>

          {/* Support type */}
          <div>
            <label className="text-xs font-black text-[#2D2926] mb-2 block">نوع الإسناد</label>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORT_TYPES.map(t => {
                const TIcon = t.Icon;
                const active = form.supportType === t.value;
                return (
                  <button key={t.value}
                    onClick={() => setForm(f => ({ ...f, supportType: t.value, qtyInternal: '', qtyExternal: '' }))}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-black border-2 transition-all ${
                      active ? 'shadow-md scale-[1.02] text-white' : 'bg-white border-[#EDE5DC] text-[#6D6E71]'
                    }`}
                    style={active
                      ? { background: `linear-gradient(135deg, ${t.color}, ${t.color}DD)`, borderColor: t.color }
                      : undefined}>
                    <TIcon size={14} strokeWidth={2.5} />
                    {t.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-2 gap-3">
            {showInternal && (
              <div>
                <label className="text-xs font-black text-[#2D2926] mb-1.5 block flex items-center gap-1.5">
                  <ArrowRight size={12} strokeWidth={2.5} className="text-blue-500" />
                  {form.supportType === 'both' ? 'الكمية الداخلية' : 'الكمية'}
                </label>
                <input type="number" min="1" value={form.qtyInternal}
                  onChange={e => setForm(f => ({ ...f, qtyInternal: e.target.value }))}
                  className="w-full px-4 py-2.5 border-2 border-[#EDE5DC] rounded-xl text-sm font-bold text-[#2D2926] outline-none focus:border-blue-500 transition-colors bg-white"
                  placeholder="0" />
              </div>
            )}
            {showExternal && (
              <div>
                <label className="text-xs font-black text-[#2D2926] mb-1.5 block flex items-center gap-1.5">
                  <ArrowLeft size={12} strokeWidth={2.5} className="text-violet-500" />
                  {form.supportType === 'both' ? 'الكمية الخارجية' : 'الكمية'}
                </label>
                <input type="number" min="1" value={form.qtyExternal}
                  onChange={e => setForm(f => ({ ...f, qtyExternal: e.target.value }))}
                  className="w-full px-4 py-2.5 border-2 border-[#EDE5DC] rounded-xl text-sm font-bold text-[#2D2926] outline-none focus:border-violet-500 transition-colors bg-white"
                  placeholder="0" />
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-black text-[#2D2926] mb-2 block">حالة الطلب</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(s => {
                const SIcon = s.Icon;
                const active = form.status === s.value;
                return (
                  <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black border-2 transition-all ${
                      active ? 'shadow-md scale-[1.02]' : 'bg-white border-[#EDE5DC] text-[#6D6E71]'
                    }`}
                    style={active
                      ? { background: s.bg, borderColor: s.color, color: s.color }
                      : undefined}>
                    <SIcon size={12} strokeWidth={2.5} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-black text-[#2D2926] mb-1.5 block">ملاحظات</label>
            <textarea rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-[#EDE5DC] rounded-xl text-sm text-[#2D2926] outline-none focus:border-blue-500 transition-colors resize-none bg-white"
              placeholder="ملاحظات إضافية..." />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#EDE5DC] flex gap-2.5 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-black border-2 border-[#EDE5DC] text-[#6D6E71] hover:bg-[#F5F0EB] transition-colors">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-md"
            style={{ background: 'linear-gradient(135deg, #60A5FA, #3B82F6)' }}>
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={15} strokeWidth={2.25} />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}
