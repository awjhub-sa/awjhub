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
import MediaLightbox from '../../components/MediaLightbox.jsx';
import ReportDrawer from '../../components/details/ReportDrawer.jsx';
import NotificationBadge from '../../components/NotificationBadge.jsx';
import { getCaterer, getShakhis, getLocation } from '../../config/centers.js';
import {
  computeStatusUpdate, TERMINAL_REPORT_STATUSES,
} from '../../lib/statusTracking.js';
import { StatusTimerChip, StatusTimeline } from '../../components/StatusTimeline.jsx';
import CenterNotesPanel from '../../components/CenterNotesPanel.jsx';

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
            <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 rounded-2xl px-4 py-2 shadow-[0_2px_10px_rgba(239,68,68,0.12)]">
              <NotificationBadge count={countOf('pending')} variant="red" />
              <div className="text-right">
                <p className="text-[10px] font-bold text-red-700 leading-none">قيد الانتظار</p>
                <p className="text-[9px] text-red-500 mt-1 font-medium">يحتاج متابعة</p>
              </div>
            </div>
          ) : null
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي البلاغات', value: reports.length,         color: 'rgb(var(--c-primary))', Icon: AlertTriangle },
          { label: 'قيد الانتظار',     value: countOf('pending'),     color: '#F59E0B', Icon: Clock         },
          { label: 'جارٍ التنفيذ',      value: countOf('in_progress'), color: '#4E7CB0', Icon: Activity      },
          { label: 'تم الحل',           value: countOf('resolved'),    color: '#5E9070', Icon: CheckCircle2  },
        ].map(c => (
          <div key={c.label}
            className="bg-white rounded-2xl p-4 border border-line shadow-[0_2px_8px_rgb(var(--c-ink)/0.07)] flex items-center gap-3"
            style={{ borderRight: `3px solid ${c.color}` }}>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted mb-0.5">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${c.color}18` }}>
              <c.Icon size={18} style={{ color: c.color }} weight="regular" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="bg-white border border-line rounded-2xl p-1.5 flex overflow-x-auto no-scrollbar shadow-[0_2px_8px_rgb(var(--c-ink)/0.05)]">
        {[
          { value: 'all',         label: 'الكل',         count: reports.length,         Icon: Filter,        color: 'rgb(var(--c-muted))' },
          { value: 'pending',     label: 'قيد الانتظار', count: countOf('pending'),     Icon: Clock,         color: '#F59E0B' },
          { value: 'in_progress', label: 'جارٍ التنفيذ',  count: countOf('in_progress'), Icon: Activity,      color: '#4E7CB0' },
          { value: 'resolved',    label: 'تم الحل',       count: countOf('resolved'),    Icon: CheckCircle2,  color: '#5E9070' },
        ].map(opt => {
          const active = filter === opt.value;
          const OIcon = opt.Icon;
          return (
            <button key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                active ? 'text-white shadow-md' : 'text-muted hover:text-ink hover:bg-background'
              }`}
              style={active
                ? { background: `linear-gradient(135deg, ${opt.color}, ${opt.color}DD)` }
                : undefined}>
              <OIcon size={14} weight="bold" />
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
        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted" weight="regular" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث برقم البلاغ، المركز، المراقب، أو الوصف..."
          className="w-full pr-11 pl-4 py-3 rounded-2xl border-2 border-line bg-white text-sm font-medium text-ink placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-[0_2px_8px_rgb(var(--c-ink)/0.05)]"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-[rgb(var(--c-primary-50))] transition-colors">
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

      {/* Reports list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-gradient-to-br from-white via-white to-background/40 rounded-3xl border border-line py-20 text-center shadow-[0_2px_12px_rgb(var(--c-ink)/0.06)]">
            <div className="relative w-fit mx-auto mb-3 group">
              <div className="absolute inset-0 rounded-2xl blur-xl bg-red-400 opacity-30 group-hover:opacity-60 transition-opacity" />
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                style={{ background: 'linear-gradient(135deg, #FEE2E2, #FECACA)' }}>
                <AlertTriangle size={24} className="text-red-400" weight="regular" />
                <Sparkles size={9} className="absolute -top-0.5 -right-0.5 text-red-300 drop-shadow animate-pulse" />
              </div>
            </div>
            <p className="text-muted text-sm font-medium">لا توجد بلاغات تطابق البحث</p>
          </div>
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

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
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
      className={`group/row relative bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_28px_rgb(var(--c-ink)/0.10)] ${
        isNew && !isOpen ? 'card-pulse-red' : ''
      }`}
      style={!isNew || isOpen ? {
        borderColor: isOpen ? `${rt.color}40` : 'rgb(var(--c-line))',
        boxShadow: isOpen ? `0 8px 28px ${rt.color}1F` : '0 2px 10px rgb(var(--c-ink) / 0.06)',
      } : undefined}
    >
      {/* "جديد" floating pill */}
      {isNew && !isOpen && (
        <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md text-white shadow-md tabular-nums tracking-wide"
          style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          جديد
        </span>
      )}
      {/* Top severity strip */}
      {sv && (
        <div className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${sv.bar}, ${sv.bar}66, transparent)` }} />
      )}

      {/* Card body */}
      <button onClick={onToggle}
        className="w-full text-right p-4 sm:p-5 flex items-start gap-3 sm:gap-4 hover:bg-[#FDFAF7] transition-colors">
        {/* Type icon */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl blur-md opacity-50 group-hover/row:opacity-80 transition-opacity"
            style={{ background: rt.color }} />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md"
            style={{
              background: `linear-gradient(135deg, ${rt.color}, ${rt.color}CC)`,
              border: '2px solid rgba(255,255,255,0.7)',
            }}>
            <rt.Icon size={26} className="text-white" weight="regular" />
          </div>
          {isNew && (
            <div className="absolute -top-1.5 -right-1.5 badge-pulse-red w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
              <Sparkles size={9} className="text-white" weight="bold" />
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-base sm:text-lg font-black text-ink leading-tight">{rt.label}</p>
            {r.reportNumber && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums tracking-wide ${
                isNew ? 'badge-pulse-red text-white' : 'text-ink border'
              }`}
                style={isNew
                  ? { background: 'linear-gradient(135deg, #EF4444, #DC2626)' }
                  : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))' }}>
                #{r.reportNumber}
              </span>
            )}
            {sv && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md border inline-flex items-center gap-1"
                style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sv.bar }} />
                {sv.label}
              </span>
            )}
            {r.mealType && MEAL_LABEL[r.mealType] && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md text-white inline-flex items-center"
                style={{ background: MEAL_COLOR[r.mealType] }}>
                {MEAL_LABEL[r.mealType]}
              </span>
            )}
            {r.holySite && HOLY_SITE_LABEL[r.holySite] && (() => {
              const HSIcon = HOLY_SITE_ICON[r.holySite];
              return (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md text-white inline-flex items-center gap-1"
                  style={{ background: HOLY_SITE_COLOR[r.holySite] }}>
                  <HSIcon size={10} weight="bold" />
                  {HOLY_SITE_LABEL[r.holySite]}
                </span>
              );
            })()}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px] text-muted flex-wrap mb-1.5">
            <span className="flex items-center gap-1">
              <User size={11} weight="bold" className="text-primary" />
              <span className="font-bold text-ink">{r.observer || '—'}</span>
            </span>
            <span className="flex items-center gap-1">
              <Building2 size={11} weight="bold" className="text-primary" />
              <span className="font-bold text-ink">{r.center || '—'}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} weight="bold" className="text-primary" />
              <span className="font-bold">{timeAgo(r.timestamp)}</span>
            </span>
          </div>

          {/* Caterer accent + timer chip */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary bg-background border border-line rounded-md px-2 py-0.5">
              <Factory size={10} weight="bold" />
              <span className="truncate max-w-[200px]">{r.caterer || getCaterer(r.center) || '—'}</span>
            </div>
            <StatusTimerChip doc={r} terminalStatuses={TERMINAL_REPORT_STATUSES} statusMeta={STATUS_LOOKUP} />
          </div>

          {/* Center-specific operations notes (collapsed: compact, expanded: full panel below) */}
          {!isOpen && <CenterNotesPanel centerId={r.center} variant="compact" />}

          {/* Description preview */}
          {r.description && !isOpen && (
            <p className="text-xs text-muted line-clamp-1 leading-relaxed">{r.description}</p>
          )}

          {/* Thumbnails preview */}
          {!isOpen && (httpImages.length > 0 || r.videoUrl) && (
            <div className="flex items-center gap-1.5 mt-2">
              {httpImages.slice(0, 3).map((src, i) => (
                <div key={i}
                  className="w-10 h-10 rounded-lg border-2 border-white shadow-sm overflow-hidden shrink-0"
                  style={{ marginLeft: i > 0 ? '-12px' : 0, zIndex: 3 - i }}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              {httpImages.length > 3 && (
                <span className="inline-flex items-center justify-center text-[10px] font-black h-10 px-2 rounded-lg bg-background border-2 border-white text-primary shadow-sm"
                  style={{ marginLeft: '-12px', zIndex: 0 }}>
                  +{httpImages.length - 3}
                </span>
              )}
              {r.videoUrl && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold h-10 px-2 rounded-lg bg-[#1A1A2E] text-white shadow-sm ms-1">
                  <Play size={10} weight="bold" fill="white" />
                  فيديو
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status pill + chevron */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-xl border-2"
            style={{ background: b.bg, borderColor: b.border, color: b.color }}>
            <StatusIcon size={11} weight="bold" />
            {b.label}
          </span>
          <div className="w-8 h-8 rounded-lg border border-line bg-white flex items-center justify-center transition-transform"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight size={14} className="text-primary" weight="bold" />
          </div>
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0"
          style={{ background: `linear-gradient(135deg, ${rt.color}10, rgb(var(--c-bg)))` }}>
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl blur-md opacity-40" style={{ background: rt.color }} />
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: `linear-gradient(135deg, ${rt.color}, ${rt.color}CC)` }}>
                <rt.Icon size={18} className="text-white" weight="regular" />
              </div>
            </div>
            <div>
              <p className="font-black text-ink text-sm">تعديل البلاغ</p>
              <p className="text-[11px] text-primary font-bold mt-0.5">{rt.label}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl border border-line flex items-center justify-center hover:bg-[rgb(var(--c-primary-50))] transition-colors">
            <X size={15} className="text-muted" weight="bold" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Observer info (read-only) */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'المراقب', val: report.observer, Icon: User,     color: 'rgb(var(--c-primary))' },
              { label: 'المركز',  val: report.center,   Icon: Building2,color: rt.color  },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-line p-2.5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}15` }}>
                  <c.Icon size={13} style={{ color: c.color }} weight="bold" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-muted font-bold">{c.label}</p>
                  <p className="text-[11px] font-bold text-ink truncate">{c.val || '—'}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-br from-background to-white rounded-xl border border-line p-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
              <Factory size={13} className="text-white" weight="bold" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-muted font-bold">المتعهد</p>
              <p className="text-[11px] font-black text-primary truncate">{report.caterer || getCaterer(report.center) || '—'}</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-black text-ink mb-2 block">حالة البلاغ</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(s => {
                const SIcon = s.Icon;
                const active = form.status === s.value;
                return (
                  <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black border-2 transition-all ${
                      active ? 'shadow-md scale-[1.02]' : 'bg-white border-line text-muted'
                    }`}
                    style={active
                      ? { background: s.bg, borderColor: s.color, color: s.color }
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
            <label className="text-xs font-black text-ink mb-2 block">مستوى الخطورة</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(SEVERITY_MAP).map(([key, sv]) => {
                const active = form.severity === key;
                return (
                  <button key={key} onClick={() => setForm(f => ({ ...f, severity: key }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black border-2 transition-all ${
                      active ? 'shadow-md scale-[1.02]' : 'bg-white border-line text-muted'
                    }`}
                    style={active ? { background: sv.bg, borderColor: sv.text, color: sv.text } : undefined}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sv.bar }} />
                    {sv.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-black text-ink mb-2 block">وصف المشكلة</label>
            <textarea rows={4} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-line rounded-xl text-sm text-ink outline-none focus:border-primary transition-colors resize-none bg-white"
              placeholder="وصف المشكلة أو الملاحظات..." />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line flex gap-2.5 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-black border-2 border-line text-muted hover:bg-[rgb(var(--c-primary-50))] transition-colors">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-md"
            style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={15} weight="bold" />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}
