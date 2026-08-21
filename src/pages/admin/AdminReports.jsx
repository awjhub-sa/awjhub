import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db.js';
import {
  Warning as AlertTriangle,
  CaretRight as ChevronRight,
  Pencil,
  Trash as Trash2,
  X,
  FloppyDisk as Save,
  Image as ImageIcon,
  VideoCamera as Video,
  User,
  Buildings as Building2,
  Clock,
  ShieldWarning as ShieldAlert,
  Play,
  ArrowSquareOut as ExternalLink,
  MagnifyingGlass as Search,
  Funnel as Filter,
  CheckCircle as CheckCircle2,
  Pulse as Activity,
  Sparkle as Sparkles,
  MapPin,
  Hash,
  Factory,
  Drop as Droplets,
  Lightning as Zap,
  Users as UsersIcon,
  ForkKnife as Utensils,
  Heartbeat as HeartPulse,
  Shield,
  Fire as Flame,
  FileText,
  Package,
  Star,
  Thermometer,
  Hourglass,
  CalendarBlank as Calendar,
  Mountains as Mountain,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import FilterChip from '../../components/FilterChip.jsx';
import { Surface, IconTile, Pill, RowMeta, StatTile, EmptyState } from '../../components/ui/index.jsx';
import MediaLightbox from '../../components/MediaLightbox.jsx';
import ReportDrawer from '../../components/details/ReportDrawer.jsx';
import NotificationBadge from '../../components/NotificationBadge.jsx';
import { getCaterer, getShakhis, getLocation } from '../../config/centers.js';
import {
  computeStatusUpdate, TERMINAL_REPORT_STATUSES,
} from '../../lib/statusTracking.js';
import { StatusTimerChip, StatusTimeline } from '../../components/StatusTimeline.jsx';
import CenterNotesPanel from '../../components/CenterNotesPanel.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

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

/* ── constants ── */
const STATUS_OPTIONS = [
  { value: 'pending',     label: 'قيد الانتظار', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', Icon: Clock        },
  { value: 'in_progress', label: 'جارٍ التنفيذ',  color: '#4E7CB0', bg: '#EFF6FF', border: '#BFDBFE', Icon: Activity     },
  { value: 'resolved',    label: 'تم الحل',       color: '#5E9070', bg: '#F0FDF4', border: '#86EFAC', Icon: CheckCircle2 },
];
const STATUS_LOOKUP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

const SEVERITY_MAP = {
  high:   { label: 'عالية',   bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', bar: '#EF4444' },
  urgent: { label: 'عاجل',    bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', bar: '#DC2626' },
  medium: { label: 'متوسطة',  bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', bar: '#F59E0B' },
  low:    { label: 'منخفضة',  bg: '#EFF6FF', border: '#BFDBFE', text: '#26456A', bar: '#4E7CB0' },
};

const REPORT_TYPE_MAP = {
  water:    { label: 'تسرب مياه',        Icon: Droplets,    color: '#4E7CB0' },
  electric: { label: 'عطل كهربائي',       Icon: Zap,         color: '#F59E0B' },
  crowd:    { label: 'ازدحام حرج',        Icon: UsersIcon,   color: '#B4674E' },
  food:     { label: 'مشكلة غذائية',      Icon: Utensils,    color: 'rgb(var(--c-primary))' },
  medical:  { label: 'حالة طبية طارئة',   Icon: HeartPulse,  color: '#EF4444' },
  security: { label: 'بلاغ أمني',         Icon: Shield,      color: '#1F2937' },
  fire:     { label: 'حريق / دخان',       Icon: Flame,       color: '#DC2626' },
  other:    { label: 'بلاغ آخر',          Icon: FileText,    color: 'rgb(var(--c-muted))' },
  shortage: { label: 'نقص في الكميات',    Icon: Package,     color: '#EA580C' },
  delay:    { label: 'تأخر في التوزيع',   Icon: Hourglass,   color: '#3D6795' },
  quality:  { label: 'مشكلة في الجودة',   Icon: Star,        color: '#EAB308' },
  hygiene:  { label: 'مخالفة صحية',       Icon: Thermometer, color: '#5E9070' },
};
const MEAL_LABEL = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
const MEAL_COLOR = { breakfast: '#F59E0B', lunch: '#EF4444', dinner: '#B4674E' };
const HOLY_SITE_LABEL = { mina: 'منى', arafat: 'عرفات' };
const HOLY_SITE_COLOR = { mina: 'rgb(var(--c-primary))', arafat: '#5E9070' };
const HOLY_SITE_ICON  = { mina: MapPin,  arafat: Mountain };

const getRT = r => REPORT_TYPE_MAP[r.reportType] || REPORT_TYPE_MAP[r.type] || { label: r.reportType || 'بلاغ', Icon: FileText, color: 'rgb(var(--c-muted))' };
const getSV = r => SEVERITY_MAP[r.severity] || null;
const getSB = r => STATUS_LOOKUP[r.status] || STATUS_OPTIONS[0];

const NEW_THRESHOLD_MS = 10 * 60 * 1000;
const isNewReport = r => {
  if (r.status && r.status !== 'pending') return false;
  const ts = r.timestamp?.toMillis?.() ?? 0;
  return ts > 0 && (Date.now() - ts) < NEW_THRESHOLD_MS;
};

export default function AdminReports() {
  const [reports,       setReports]       = useState([]);
  const [filter,        setFilter]        = useState('all');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [expanded,      setExpanded]      = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [lightbox,      setLightbox]      = useState(null);

  useEffect(() => {
    return db.reports.subscribe(rows => {
      const docs = [...rows].sort((a, b) =>
        (b.timestamp?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0) -
        (a.timestamp?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
      );
      setReports(docs);
    });
  }, []);

  const handleStatus = (id, newStatus) => {
    const current = reports.find(r => r.id === id);
    if (!current) return db.reports.update(id, { status: newStatus });
    const update = computeStatusUpdate(current, newStatus, TERMINAL_REPORT_STATUSES);
    return db.reports.update(id, update || { status: newStatus });
  };
  const handleSaveEdit = (id, form) => {
    const current = reports.find(r => r.id === id) || {};
    const statusUpdate = computeStatusUpdate(current, form.status, TERMINAL_REPORT_STATUSES);
    return db.reports.update(id, {
      ...(statusUpdate || { status: form.status }),
      ...(form.severity    && { severity:    form.severity    }),
      ...(form.description && { description: form.description }),
    });
  };
  const handleSaveNotes = (id, adminNotes) => db.reports.update(id, { adminNotes });
  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا البلاغ؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    await db.reports.delete(id);
    if (expanded === id) setExpanded(null);
  };

  const countOf = v => reports.filter(r => r.status === v || (!r.status && v === 'pending')).length;

  const filtered = useMemo(() => {
    let list = filter === 'all' ? reports
      : reports.filter(r => r.status === filter || (!r.status && filter === 'pending'));
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(r =>
        (r.center      || '').toLowerCase().includes(q) ||
        (r.observer    || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.reportNumber || '').toString().includes(q) ||
        (getCaterer(r.center) || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [reports, filter, searchTerm]);

  return (
    <div className="space-y-5 pb-6" dir="rtl">

      {/* Page header */}
      <PageHeader
        kicker="الميدان"
        Icon={AlertTriangle}
        title="البلاغات الميدانية"
        subtitle={`${reports.length} بلاغ إجمالاً · تحديث فوري`}
        gradient={{ from: '#FCA5A5', to: '#EF4444' }}
        glowColor="rgba(239,68,68,0.4)"
        right={
          countOf('pending') > 0 ? (
            <div
              className="flex items-center gap-2.5 rounded-[11px] border px-3.5 py-2"
              style={{ background: tint('#DC2626', 12), borderColor: tint('#DC2626', 28) }}
            >
              <NotificationBadge count={countOf('pending')} variant="red" />
              <div className="text-start">
                <p className="text-[11px] font-bold leading-none" style={{ color: '#DC2626' }}>قيد الانتظار</p>
                <p className="text-[10px] text-muted mt-1 font-medium">يحتاج متابعة</p>
              </div>
            </div>
          ) : null
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: 'all',         label: 'إجمالي البلاغات', value: reports.length,         color: 'rgb(var(--c-primary))', Icon: AlertTriangle },
          { to: 'pending',     label: 'قيد الانتظار',     value: countOf('pending'),     color: '#F59E0B', Icon: Clock         },
          { to: 'in_progress', label: 'جارٍ التنفيذ',      value: countOf('in_progress'), color: '#4E7CB0', Icon: Activity      },
          { to: 'resolved',    label: 'تم الحل',           value: countOf('resolved'),    color: '#5E9070', Icon: CheckCircle2  },
        ].map(c => (
          <StatTile key={c.label} label={c.label} value={c.value} Icon={c.Icon} color={c.color}
            active={filter === c.to} onClick={() => setFilter(c.to)} />
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all',         label: 'الكل',         count: reports.length,         Icon: Filter,        color: 'rgb(var(--c-muted))' },
          { value: 'pending',     label: 'قيد الانتظار', count: countOf('pending'),     Icon: Clock,         color: '#F59E0B' },
          { value: 'in_progress', label: 'جارٍ التنفيذ',  count: countOf('in_progress'), Icon: Activity,      color: '#4E7CB0' },
          { value: 'resolved',    label: 'تم الحل',       count: countOf('resolved'),    Icon: CheckCircle2,  color: '#5E9070' },
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
          placeholder="بحث برقم البلاغ، المركز، المراقب، أو الوصف..."
          className="w-full ps-10 pe-10 py-2.5 rounded-[12px] border border-line bg-white text-[13px] font-medium text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none transition-colors shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-[rgb(var(--c-bg))] transition-colors">
            <X size={13} weight="bold" />
          </button>
        )}
      </div>

      {/* Reports list */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <Surface>
            <EmptyState Icon={AlertTriangle} title="لا توجد بلاغات تطابق البحث" />
          </Surface>
        ) : filtered.map(r => (
          <ReportCard
            key={r.id}
            report={r}
            isOpen={expanded === r.id}
            onToggle={() => setExpanded(r.id)}
          />
        ))}
      </div>

      <ReportDrawer
        report={filtered.find(x => x.id === expanded) || null}
        onClose={() => setExpanded(null)}
        onStatus={handleStatus}
        onEdit={() => { const r = reports.find(x => x.id === expanded); setExpanded(null); setEditingReport(r); }}
        onDelete={() => { handleDelete(expanded); setExpanded(null); }}
        onMedia={(m) => setLightbox(m)}
        onSaveNotes={handleSaveNotes}
      />

      {/* Edit Modal */}
      {editingReport && (
        <EditModal
          report={editingReport}
          onClose={() => setEditingReport(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Media Lightbox */}
      {lightbox && (
        <MediaLightbox
          src={lightbox.src}
          type={lightbox.type}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function ReportCard({ report: r, isOpen, onToggle }) {
  const rt = getRT(r);
  const sv = getSV(r);
  const b  = getSB(r);
  const isNew = isNewReport(r);
  const allImages = r.images?.length ? r.images : (r.photos?.length ? r.photos : []);
  const httpImages = allImages.filter(s => typeof s === 'string' && (s.startsWith('http') || s.startsWith('data:')));

  const StatusIcon = b.Icon;

  return (
    <div
      className={`group/row relative bg-white rounded-[14px] border overflow-hidden
                  shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200
                  hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)] ${
        isNew && !isOpen ? 'card-pulse-red' : ''
      }`}
      style={{ borderColor: isOpen ? tint(rt.color, 34) : 'rgb(var(--c-line))' }}
    >
      {/* Severity leads the rail when it is set; otherwise the report's own type
          colours it. Either way one solid edge replaces the old gradient strip. */}
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: sv?.bar || rt.color }} />

      {/* Card body */}
      <button onClick={onToggle}
        className="w-full text-start ps-5 pe-4 py-4 flex items-start gap-3.5 hover:bg-[rgb(var(--c-bg))] transition-colors">
        <IconTile Icon={rt.Icon} color={rt.color} size="lg" />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[14px] font-bold text-ink leading-tight">{rt.label}</p>
            {isNew && <Pill color="#DC2626" solid>جديد</Pill>}
            {r.reportNumber && (
              <Pill color="rgb(var(--c-muted))" className="tabular-nums">#{r.reportNumber}</Pill>
            )}
            {sv && <Pill color={sv.bar}>{sv.label}</Pill>}
            {r.mealType && MEAL_LABEL[r.mealType] && (
              <Pill color={MEAL_COLOR[r.mealType]}>{MEAL_LABEL[r.mealType]}</Pill>
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
            <StatusTimerChip doc={r} terminalStatuses={TERMINAL_REPORT_STATUSES} statusMeta={STATUS_LOOKUP} />
          </div>

          {/* Center-specific operations notes (collapsed: compact, expanded: full panel below) */}
          {!isOpen && <CenterNotesPanel centerId={r.center} variant="compact" />}

          {/* Description preview */}
          {r.description && !isOpen && (
            <p className="text-[12px] text-muted line-clamp-1 leading-relaxed mt-2">{r.description}</p>
          )}

          {/* Thumbnails preview */}
          {!isOpen && (httpImages.length > 0 || r.videoUrl) && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {httpImages.slice(0, 3).map((src, i) => (
                <div key={i}
                  className="w-10 h-10 rounded-[10px] border border-line overflow-hidden shrink-0 bg-white">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              {httpImages.length > 3 && (
                <span className="inline-flex items-center justify-center text-[10.5px] font-bold h-10 px-2.5 rounded-[10px] bg-[rgb(var(--c-bg))] border border-line text-muted tabular-nums">
                  +{httpImages.length - 3}
                </span>
              )}
              {r.videoUrl && (
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold h-10 px-2.5 rounded-[10px] border"
                  style={{
                    background: tint('rgb(var(--c-primary))', 12),
                    borderColor: tint('rgb(var(--c-primary))', 28),
                    color: 'rgb(var(--c-primary))',
                  }}>
                  <Play size={11} weight="fill" />
                  فيديو
                </span>
              )}
            </div>
          )}
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

      {/* Details open in a drawer of their own — see ReportDrawer. */}
    </div>
  );
}

function EditModal({ report, onClose, onSave }) {
  const [form, setForm] = useState({
    status:      report.status      || 'pending',
    severity:    report.severity    || '',
    description: report.description || '',
  });
  const [saving, setSaving] = useState(false);
  const rt = getRT(report);

  const handleSave = async () => {
    setSaving(true);
    await onSave(report.id, form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-[rgb(var(--c-ink)/0.45)]" onClick={onClose} />
      <div className="relative bg-white rounded-[18px] w-full max-w-md border border-line shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)] overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b shrink-0"
          style={{ background: tint(rt.color, 12), borderColor: tint(rt.color, 28) }}>
          <div className="flex items-center gap-3 min-w-0">
            <IconTile Icon={rt.Icon} color={rt.color} size="md" />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-ink leading-tight">تعديل البلاغ</p>
              <p className="text-[11.5px] font-medium mt-1 truncate" style={{ color: rt.color }}>{rt.label}</p>
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
              { label: 'المراقب', val: report.observer, Icon: User,     color: 'rgb(var(--c-primary))' },
              { label: 'المركز',  val: report.center,   Icon: Building2,color: rt.color  },
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
              <p className="text-[11.5px] font-bold text-primary truncate mt-0.5">{report.caterer || getCaterer(report.center) || '—'}</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-[11.5px] font-bold text-muted mb-2 block">حالة البلاغ</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(s => {
                const SIcon = s.Icon;
                const active = form.status === s.value;
                return (
                  <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[11px] font-bold border transition-colors ${
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

          {/* Severity */}
          <div>
            <label className="text-[11.5px] font-bold text-muted mb-2 block">مستوى الخطورة</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(SEVERITY_MAP).map(([key, sv]) => {
                const active = form.severity === key;
                return (
                  <button key={key} onClick={() => setForm(f => ({ ...f, severity: key }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] text-[11.5px] font-bold border transition-colors ${
                      active ? '' : 'bg-white border-line text-muted hover:bg-[rgb(var(--c-bg))]'
                    }`}
                    style={active
                      ? { background: tint(sv.bar, 12), borderColor: sv.bar, color: sv.text }
                      : undefined}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sv.bar }} />
                    {sv.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11.5px] font-bold text-muted mb-2 block">وصف المشكلة</label>
            <textarea rows={4} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3.5 py-3 border border-line rounded-[10px] text-[13px] text-ink outline-none focus:border-primary transition-colors resize-none bg-white"
              placeholder="وصف المشكلة أو الملاحظات..." />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-line flex gap-2.5 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold border border-line text-muted hover:bg-[rgb(var(--c-bg))] transition-colors">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 bg-[rgb(var(--c-primary))]">
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
