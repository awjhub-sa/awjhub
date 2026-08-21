import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db.js';
import {
  Truck,
  Package,
  CaretRight as ChevronRight,
  Pencil,
  Trash as Trash2,
  X,
  FloppyDisk as Save,
  User,
  Buildings as Building2,
  Clock,
  Funnel as Filter,
  CheckCircle as CheckCircle2,
  XCircle,
  ThumbsUp,
  Sparkle as Sparkles,
  Warning as AlertTriangle,
  MagnifyingGlass as Search,
  Hash,
  Factory,
  CalendarBlank as Calendar,
  Pulse as Activity,
  ArrowRight,
  ArrowLeft,
  Stack as Layers,
  FileText,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import FilterChip from '../../components/FilterChip.jsx';
import { Surface, IconTile, Pill, RowMeta, StatTile, EmptyState } from '../../components/ui/index.jsx';
import LogisticsDrawer from '../../components/details/LogisticsDrawer.jsx';
import NotificationBadge from '../../components/NotificationBadge.jsx';
import { getCaterer, getShakhis, getLocation } from '../../config/centers.js';
import {
  computeStatusUpdate, TERMINAL_LOGISTICS_STATUSES,
} from '../../lib/statusTracking.js';
import { StatusTimerChip, StatusTimeline } from '../../components/StatusTimeline.jsx';
import CenterNotesPanel from '../../components/CenterNotesPanel.jsx';
import { HOLY_SITE_LABEL, HOLY_SITE_COLOR, HOLY_SITE_ICON } from '../../config/fieldRecords.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const CATEGORY_LABEL = { meals: 'وجبات', water: 'مياه' };

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
  { value: 'approved',  label: 'موافق عليه',   color: '#4E7CB0', bg: '#EFF6FF', border: '#BFDBFE', Icon: ThumbsUp     },
  { value: 'delivered', label: 'تم التسليم',   color: '#5E9070', bg: '#F0FDF4', border: '#86EFAC', Icon: CheckCircle2 },
  { value: 'rejected',  label: 'مرفوض',        color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', Icon: XCircle      },
];
const STATUS_LOOKUP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));
const getSB = r => STATUS_LOOKUP[r.status] || STATUS_OPTIONS[0];

const SUPPORT_TYPES = [
  { value: 'internal', label: 'داخلي',            short: 'داخلي',         Icon: ArrowRight, color: '#4E7CB0' },
  { value: 'external', label: 'خارجي',            short: 'خارجي',         Icon: ArrowLeft,  color: '#B4674E' },
  { value: 'both',     label: 'داخلي وخارجي',     short: 'داخلي وخارجي',  Icon: Layers,     color: '#2F5580' },
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
        kicker="الميدان"
        Icon={Truck}
        title="الإسناد اللوجستي"
        subtitle={`${requests.length} طلب إجمالاً · تحديث فوري`}
        gradient={{ from: '#93C5FD', to: '#4E7CB0' }}
        glowColor="rgba(49,130,206,0.4)"
        right={
          countOf('pending') > 0 ? (
            <div
              className="flex items-center gap-2.5 rounded-[11px] border px-3.5 py-2"
              style={{ background: tint('#4E7CB0', 12), borderColor: tint('#4E7CB0', 28) }}
            >
              <NotificationBadge count={countOf('pending')} variant="blue" />
              <div className="text-start">
                <p className="text-[11px] font-bold leading-none" style={{ color: '#4E7CB0' }}>قيد الانتظار</p>
                <p className="text-[10px] text-muted mt-1 font-medium">يحتاج موافقة</p>
              </div>
            </div>
          ) : null
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: 'all',       label: 'إجمالي الطلبات', value: requests.length,       color: 'rgb(var(--c-primary))', Icon: Truck        },
          { to: 'pending',   label: 'قيد الانتظار',    value: countOf('pending'),    color: '#F59E0B', Icon: Clock        },
          { to: 'approved',  label: 'موافق عليه',      value: countOf('approved'),   color: '#4E7CB0', Icon: ThumbsUp     },
          { to: 'delivered', label: 'تم التسليم',      value: countOf('delivered'),  color: '#5E9070', Icon: CheckCircle2 },
        ].map(c => (
          <StatTile key={c.label} label={c.label} value={c.value} Icon={c.Icon} color={c.color}
            active={filter === c.to} onClick={() => setFilter(c.to)} />
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all',       label: 'الكل',         count: requests.length,        Icon: Filter,        color: 'rgb(var(--c-muted))' },
          { value: 'pending',   label: 'قيد الانتظار', count: countOf('pending'),     Icon: Clock,         color: '#F59E0B' },
          { value: 'approved',  label: 'موافق عليه',   count: countOf('approved'),    Icon: ThumbsUp,      color: '#4E7CB0' },
          { value: 'delivered', label: 'تم التسليم',   count: countOf('delivered'),   Icon: CheckCircle2,  color: '#5E9070' },
          { value: 'rejected',  label: 'مرفوض',         count: countOf('rejected'),    Icon: XCircle,       color: '#EF4444' },
        ].map(opt => (
          <FilterChip
            key={opt.value}
            active={filter === opt.value}
            onClick={() => setFilter(opt.value)}
            count={opt.count}
            Icon={opt.Icon}
            color={opt.color}
          >
            {opt.label}
          </FilterChip>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted/60" weight="bold" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث برقم الطلب، البلاغ، المركز، المراقب..."
          className="w-full ps-10 pe-10 py-2.5 rounded-[12px] border border-line bg-white text-[13px] font-medium text-ink placeholder:text-muted/70 focus:border-[#4E7CB0] focus:outline-none transition-colors shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-[rgb(var(--c-bg))] transition-colors">
            <X size={13} weight="bold" />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <Surface>
            <EmptyState Icon={Truck} title="لا توجد طلبات تطابق البحث" />
          </Surface>
        ) : filtered.map(r => (
          <RequestCard
            key={r.id}
            request={r}
            isOpen={expanded === r.id}
            onToggle={() => setExpanded(r.id)}
          />
        ))}
      </div>

      <LogisticsDrawer
        request={filtered.find(x => x.id === expanded) || null}
        onClose={() => setExpanded(null)}
        onStatus={handleStatus}
        onEdit={() => { const q = requests.find(x => x.id === expanded); setExpanded(null); setEditingReq(q); }}
        onDelete={() => { handleDelete(expanded); setExpanded(null); }}
        onSaveNotes={handleSaveNotes}
      />

      {/* Edit Modal */}
      {editingReq && (
        <EditModal
          req={editingReq}
          onClose={() => setEditingReq(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

function RequestCard({ request: r, isOpen, onToggle }) {
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
      className={`group/row relative bg-white rounded-[14px] border overflow-hidden
                  shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                  hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)] ${
        isNew && !isOpen ? 'card-pulse-blue' : ''
      }`}
      style={{ borderColor: isOpen ? tint(st.color, 34) : 'rgb(var(--c-line))' }}
    >
      {/* The row's status lives on the leading rail, which frees the body to be
          typography instead of a shelf of coloured strips. */}
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: b.color }} />

      {/* Card body */}
      <button onClick={onToggle}
        className="w-full text-start ps-5 pe-4 py-4 flex items-start gap-3.5 hover:bg-[rgb(var(--c-bg))] transition-colors">
        <IconTile Icon={Package} color={st.color} size="lg" />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[14px] font-bold text-ink leading-tight">طلب إسناد</p>
            {isNew && <Pill color="#4E7CB0" solid>جديد</Pill>}
            <Pill color={st.color} Icon={SupportIcon}>{st.short}</Pill>
            {r.requestNumber && (
              <Pill color="#4E7CB0" className="tabular-nums">#{r.requestNumber}</Pill>
            )}
            {r.holySite && HOLY_SITE_LABEL[r.holySite] && (() => {
              const HSIcon = HOLY_SITE_ICON[r.holySite];
              return (
                <Pill color={HOLY_SITE_COLOR[r.holySite]} Icon={HSIcon}>
                  {HOLY_SITE_LABEL[r.holySite]}
                </Pill>
              );
            })()}
          </div>

          {/* Meta row */}
          <RowMeta items={[
            { Icon: User,      value: r.observer },
            { Icon: Building2, value: r.center },
            { Icon: Clock,     value: timeAgo(r.timestamp) },
          ]} />

          {/* Caterer accent + timer chip */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <Pill Icon={Factory} color="rgb(var(--c-primary))" className="max-w-[220px]">
              <span className="truncate min-w-0">{r.caterer || getCaterer(r.center) || '—'}</span>
            </Pill>
            <StatusTimerChip doc={r} terminalStatuses={TERMINAL_LOGISTICS_STATUSES} statusMeta={STATUS_LOOKUP} />
          </div>

          {/* Quantity chips */}
          {(hasInternal || hasExternal) && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {hasInternal && (
                <Pill color={SUPPORT_LOOKUP.internal.color} Icon={ArrowRight}>
                  داخلي <span className="tabular-nums font-extrabold ms-0.5">{r.qtyInternal}</span>
                </Pill>
              )}
              {hasExternal && (
                <Pill color={SUPPORT_LOOKUP.external.color} Icon={ArrowLeft}>
                  خارجي <span className="tabular-nums font-extrabold ms-0.5">{r.qtyExternal}</span>
                </Pill>
              )}
              <Pill color="rgb(var(--c-primary))">
                المجموع <span className="tabular-nums font-extrabold ms-0.5">{totalQty}</span>
              </Pill>
            </div>
          )}

          {/* Linked report compact chip */}
          {r.reportNumber && !isOpen && (
            <div className="mt-2">
              <Pill color="#DC2626" Icon={AlertTriangle}>
                مرتبط بالبلاغ <span className="tabular-nums ms-0.5">#{r.reportNumber}</span>
                {r.reportType && <span className="font-medium opacity-75">· {REPORT_TYPE_LABEL[r.reportType] || r.reportType}</span>}
              </Pill>
            </div>
          )}

          {/* Center-specific operations notes (collapsed only — full panel shown when expanded) */}
          {!isOpen && <CenterNotesPanel centerId={r.center} variant="compact" />}
        </div>

        {/* Status pill + chevron */}
        <div className="flex flex-col items-end gap-2.5 shrink-0">
          <Pill color={b.color} Icon={StatusIcon}>{b.label}</Pill>
          <ChevronRight
            size={14}
            weight="bold"
            className="text-muted/40 group-hover/row:text-muted transition-all"
            style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}
          />
        </div>
      </button>

      {/* Details open in a drawer of their own — see LogisticsDrawer. */}
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
      <div className="absolute inset-0 bg-[rgb(var(--c-ink)/0.45)]" onClick={onClose} />
      <div className="relative bg-white rounded-[18px] w-full max-w-md border border-line shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)] overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b shrink-0"
          style={{ background: tint('#4E7CB0', 12), borderColor: tint('#4E7CB0', 28) }}>
          <div className="flex items-center gap-3 min-w-0">
            <IconTile Icon={Package} color="#4E7CB0" size="md" />
            <div className="min-w-0">
              <p className="text-[14px] font-bold leading-tight" style={{ color: '#4E7CB0' }}>تعديل طلب الإسناد</p>
              <p className="text-[11.5px] text-muted font-medium mt-1 truncate">{req.observer} · {req.center}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center text-muted hover:text-ink transition-colors shrink-0">
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          {/* Observer info (read-only) */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'المراقب', val: req.observer, Icon: User,     color: 'rgb(var(--c-primary))' },
              { label: 'المركز',  val: req.center,   Icon: Building2,color: '#4E7CB0' },
            ].map(c => (
              <div key={c.label} className="rounded-[11px] border p-2.5 flex items-center gap-2.5"
                style={{ background: tint(c.color, 12), borderColor: tint(c.color, 28) }}>
                <IconTile Icon={c.Icon} color={c.color} size="sm" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted font-semibold">{c.label}</p>
                  <p className="text-[11.5px] font-bold text-ink truncate mt-0.5">{c.val || '—'}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[11px] border p-2.5 flex items-center gap-2.5"
            style={{ background: tint('rgb(var(--c-primary))', 12), borderColor: tint('rgb(var(--c-primary))', 28) }}>
            <IconTile Icon={Factory} size="sm" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted font-semibold">المتعهد</p>
              <p className="text-[11.5px] font-bold text-primary truncate mt-0.5">{req.caterer || getCaterer(req.center) || '—'}</p>
            </div>
          </div>

          {/* Support type */}
          <div>
            <label className="text-[11.5px] font-bold text-muted mb-2 block">نوع الإسناد</label>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORT_TYPES.map(t => {
                const TIcon = t.Icon;
                const active = form.supportType === t.value;
                return (
                  <button key={t.value}
                    onClick={() => setForm(f => ({ ...f, supportType: t.value, qtyInternal: '', qtyExternal: '' }))}
                    className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[11px] font-bold border transition-colors ${
                      active ? 'text-white' : 'bg-white border-line text-muted hover:bg-[rgb(var(--c-bg))]'
                    }`}
                    style={active ? { background: t.color, borderColor: t.color } : undefined}>
                    <TIcon size={14} weight="bold" />
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
                <label className="text-[11.5px] font-bold text-muted mb-1.5 flex items-center gap-1.5">
                  <ArrowRight size={12} weight="bold" style={{ color: SUPPORT_LOOKUP.internal.color }} />
                  {form.supportType === 'both' ? 'الكمية الداخلية' : 'الكمية'}
                </label>
                <input type="number" min="1" value={form.qtyInternal}
                  onChange={e => setForm(f => ({ ...f, qtyInternal: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-line rounded-[10px] text-[13px] font-bold text-ink outline-none focus:border-[#4E7CB0] transition-colors bg-white"
                  placeholder="0" />
              </div>
            )}
            {showExternal && (
              <div>
                <label className="text-[11.5px] font-bold text-muted mb-1.5 flex items-center gap-1.5">
                  <ArrowLeft size={12} weight="bold" style={{ color: SUPPORT_LOOKUP.external.color }} />
                  {form.supportType === 'both' ? 'الكمية الخارجية' : 'الكمية'}
                </label>
                <input type="number" min="1" value={form.qtyExternal}
                  onChange={e => setForm(f => ({ ...f, qtyExternal: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-line rounded-[10px] text-[13px] font-bold text-ink outline-none focus:border-[#B4674E] transition-colors bg-white"
                  placeholder="0" />
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-[11.5px] font-bold text-muted mb-2 block">حالة الطلب</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(s => {
                const SIcon = s.Icon;
                const active = form.status === s.value;
                return (
                  <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[11.5px] font-bold border transition-colors ${
                      active ? '' : 'bg-white border-line text-muted hover:bg-[rgb(var(--c-bg))]'
                    }`}
                    style={active
                      ? { background: tint(s.color, 12), borderColor: s.color, color: s.color }
                      : undefined}>
                    <SIcon size={12} weight="bold" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11.5px] font-bold text-muted mb-1.5 block">ملاحظات</label>
            <textarea rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3.5 py-3 border border-line rounded-[10px] text-[13px] text-ink outline-none focus:border-[#4E7CB0] transition-colors resize-none bg-white"
              placeholder="ملاحظات إضافية..." />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-line flex gap-2.5 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold border border-line text-muted hover:bg-[rgb(var(--c-bg))] transition-colors">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
            style={{ background: '#4E7CB0' }}>
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={14} weight="bold" />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}
