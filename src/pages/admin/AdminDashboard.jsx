import { useEffect, useState, useMemo } from 'react';
import { db } from '../../lib/db.js';
import { formatHijri } from '../../lib/hijri.js';
import AdminReportGenerator from './AdminReportGenerator.jsx';
import {
  AlertTriangle, Truck, ClipboardList, Mountain, Clock, Trash2, X, ArrowLeft,
  CheckCircle2, ChevronDown, Filter, Search, LayoutDashboard, Sparkles,
  User, Building2, Calendar, ChevronRight, Activity, ThumbsUp, XCircle,
  ShieldCheck, Utensils, Droplets, Factory, ArrowRight, Layers, Package, MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import NotificationBadge from '../../components/NotificationBadge.jsx';
import { getCaterer } from '../../config/centers.js';
import {
  computeStatusUpdate, TERMINAL_REPORT_STATUSES, TERMINAL_LOGISTICS_STATUSES,
} from '../../lib/statusTracking.js';
import { StatusTimerChip, StatusTimeline } from '../../components/StatusTimeline.jsx';
import { NATIONALITIES } from '../../config/nationalities.js';

/* ─── Lookup tables ─── */
const REPORT_TYPE = {
  water: 'تسرب مياه', electric: 'عطل كهربائي', crowd: 'ازدحام حرج', food: 'مشكلة غذائية',
  medical: 'حالة طبية طارئة', security: 'بلاغ أمني', fire: 'حريق / دخان', other: 'بلاغ آخر',
  shortage: 'نقص كميات', delay: 'تأخر توزيع', quality: 'مشكلة جودة', hygiene: 'مخالفة صحية',
};

const MEAL_LABEL = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
const MEAL_COLOR = { breakfast: '#F59E0B', lunch: '#EF4444', dinner: '#6366F1' };
const HOLY_SITE_LABEL = { mina: 'منى', arafat: 'عرفات' };
const HOLY_SITE_COLOR = { mina: '#A98159', arafat: '#0E7C66' };
const HOLY_SITE_ICON  = { mina: MapPin,   arafat: Mountain };

const SEV = {
  high:   { label: 'عالية',   bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5', bar: '#EF4444' },
  urgent: { label: 'عاجل',    bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5', bar: '#DC2626' },
  medium: { label: 'متوسطة',  bg: '#FFFBEB', text: '#B45309', border: '#FCD34D', bar: '#F59E0B' },
  low:    { label: 'منخفضة',  bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD', bar: '#3B82F6' },
};

const STATUS = {
  pending:     { label: 'قيد الانتظار', bg: '#FFFBEB', text: '#B45309', color: '#B45309', border: '#FDE68A', Icon: Clock        },
  in_progress: { label: 'جارٍ التنفيذ', bg: '#EFF6FF', text: '#1D4ED8', color: '#1D4ED8', border: '#BFDBFE', Icon: Activity     },
  resolved:    { label: 'تم الحل',      bg: '#F0FDF4', text: '#15803D', color: '#15803D', border: '#86EFAC', Icon: CheckCircle2 },
};

const SUPPORT = {
  internal: { label: 'داخلي',            short: 'داخلي',        Icon: ArrowRight, color: '#3B82F6' },
  external: { label: 'خارجي',            short: 'خارجي',        Icon: ArrowLeft,  color: '#8B5CF6' },
  both:     { label: 'داخلي وخارجي',     short: 'مشترك',         Icon: Layers,     color: '#1D6FA4' },
};

const LOGISTICS_STATUS = {
  pending:   { label: 'قيد الانتظار', bg: '#FFFBEB', text: '#B45309', color: '#B45309', border: '#FDE68A', Icon: Clock        },
  approved:  { label: 'موافق عليه',   bg: '#EFF6FF', text: '#1D4ED8', color: '#1D4ED8', border: '#BFDBFE', Icon: ThumbsUp     },
  delivered: { label: 'تم التسليم',   bg: '#F0FDF4', text: '#15803D', color: '#15803D', border: '#86EFAC', Icon: CheckCircle2 },
  rejected:  { label: 'مرفوض',        bg: '#FEF2F2', text: '#DC2626', color: '#DC2626', border: '#FECACA', Icon: XCircle      },
};

/* Newly-arrived helpers */
const NEW_THRESHOLD_MS = 10 * 60 * 1000;
const isNewReport = r => {
  if (r.status && r.status !== 'pending') return false;
  const ts = r.timestamp?.toMillis?.() ?? 0;
  return ts > 0 && (Date.now() - ts) < NEW_THRESHOLD_MS;
};
const isNewLogistics = r => {
  if (r.status && r.status !== 'pending') return false;
  const ts = r.timestamp?.toMillis?.() ?? r.createdAt?.toMillis?.() ?? 0;
  return ts > 0 && (Date.now() - ts) < NEW_THRESHOLD_MS;
};

/* ─── Helpers ─── */
function timeAgo(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60)    return 'الآن';
    if (s < 3600)  return `${Math.floor(s / 60)}د`;
    if (s < 86400) return `${Math.floor(s / 3600)}س`;
    return `${Math.floor(s / 86400)} يوم`;
  } catch { return '—'; }
}
function clockTime(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function openImageTab(src) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>صورة البلاغ</title>
    <style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head>
    <body><img src="${src}"/></body></html>`);
  win.document.close();
}

const getActivityCenter   = i => i.center || i.centerId || '—';
const getActivityObserver = i => i.observer || i.observerName || '—';
function getActivityScore(item) {
  if (item._col === 'meal') {
    const pct = parseFloat(item.percentage);
    return isNaN(pct) ? null : parseFloat((pct / 10).toFixed(1));
  }
  if (item.scoreOutOf10 != null) return Number(item.scoreOutOf10);
  return null;
}

/* ─── Stat Card ─── */
function StatCard({ label, value, Icon, color, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl p-4 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)] flex items-center gap-3 w-full text-right transition-all hover:shadow-[0_8px_24px_rgba(45,41,38,0.10)] hover:-translate-y-0.5"
      style={{ borderRight: `3px solid ${color}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-[#9D8F85] mb-0.5">{label}</p>
        <p className="text-2xl font-black tabular-nums leading-none" style={{ color }}>{value ?? '—'}</p>
        {sub && <p className="text-[10px] text-[#B5A99E] mt-1 font-bold">{sub}</p>}
      </div>
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity"
          style={{ background: color }} />
        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
          <Icon size={20} className="text-white" strokeWidth={2} />
        </div>
      </div>
    </button>
  );
}

/* ─── Report Detail Modal ─── */
function ReportDetailModal({ report, onClose, onDelete, onStatusChange, onSaveNotes }) {
  if (!report) return null;
  const label = REPORT_TYPE[report.reportType || report.type] || report.reportType || report.type || 'بلاغ';
  const sv    = SEV[report.severity];
  const [notes, setNotes]       = useState(report.adminNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes,  setSavedNotes]  = useState(false);

  /* Only re-sync from props when we open a different report — depending
     on report.adminNotes too would clobber the saved-notes badge the
     moment the parent's optimistic update echoes back. */
  useEffect(() => {
    setNotes(report.adminNotes || '');
    setSavedNotes(false);
  }, [report.id]);

  const handleSaveNotes = async () => {
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      await onSaveNotes?.(report.id, notes);
      setSavedNotes(true);
      setTimeout(() => setSavedNotes(false), 4000);
    } catch (e) {
      alert(`فشل حفظ الملاحظات: ${e?.message || e}`);
    }
    setSavingNotes(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">

        <div className="sticky top-0 bg-white border-b border-[#EDE5DC] px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl blur-md bg-red-500 opacity-40" />
              <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg, #F87171, #DC2626)' }}>
                <AlertTriangle size={18} className="text-white" strokeWidth={2.25} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-black text-[#2D2926] text-sm truncate">{label}</p>
                {report.reportNumber && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums"
                    style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                    #{report.reportNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#A98159] font-bold mt-0.5">{timeAgo(report.timestamp)} · {clockTime(report.timestamp)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onDelete(report.id)}
              className="w-9 h-9 rounded-xl border-2 border-red-200 flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors text-red-500">
              <Trash2 size={14} strokeWidth={2.25} />
            </button>
            <button onClick={onClose}
              className="w-9 h-9 rounded-xl border border-[#EDE5DC] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors">
              <X size={15} className="text-[#6D6E71]" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {sv && (
            <div className="flex gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg border"
                style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sv.bar }} />
                خطورة {sv.label}
              </span>
            </div>
          )}

          {/* Status timeline */}
          <StatusTimeline
            doc={report}
            terminalStatuses={TERMINAL_REPORT_STATUSES}
            statusOrder={['pending', 'in_progress', 'resolved']}
            statusMeta={STATUS}
            accentColor="#DC2626"
          />

          {/* Status changer */}
          <div className="bg-white rounded-2xl border border-[#EDE5DC] p-3">
            <p className="text-[10px] font-bold text-[#9D8F85] mb-2 flex items-center gap-1">
              <Activity size={11} strokeWidth={2.25} className="text-red-500" />
              تغيير الحالة
            </p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATUS).map(([key, s]) => {
                const SIcon = s.Icon;
                const active = (report.status || 'pending') === key;
                return (
                  <button key={key}
                    onClick={() => onStatusChange(report.id, key)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black border-2 transition-all ${
                      active ? 'shadow-md scale-[1.02]' : 'bg-white border-[#EDE5DC] text-[#6D6E71]'
                    }`}
                    style={active
                      ? { background: s.bg, borderColor: s.text, color: s.text }
                      : undefined}>
                    <SIcon size={12} strokeWidth={2.5} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { lbl: 'المراقب', val: report.observer, Icon: User,     color: '#A98159' },
              { lbl: 'المركز',  val: report.center,   Icon: Building2,color: '#DC2626' },
              { lbl: 'المشعر',  val: HOLY_SITE_LABEL[report.holySite] || '—', Icon: HOLY_SITE_ICON[report.holySite] || MapPin, color: HOLY_SITE_COLOR[report.holySite] || '#9D8F85' },
              { lbl: 'الوجبة',  val: MEAL_LABEL[report.mealType] || '—', Icon: Utensils, color: MEAL_COLOR[report.mealType] || '#A98159' },
              { lbl: 'الوقت',   val: clockTime(report.timestamp), Icon: Calendar, color: '#6D6E71' },
            ].map(c => (
              <div key={c.lbl} className="bg-white rounded-xl border border-[#EDE5DC] p-2.5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}15` }}>
                  <c.Icon size={13} style={{ color: c.color }} strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-[#9D8F85] font-bold">{c.lbl}</p>
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
              <p className="text-[11px] font-black text-[#A98159] truncate">{report.caterer || getCaterer(report.center) || '—'}</p>
            </div>
          </div>

          {report.description && (
            <div className="bg-white rounded-2xl border border-[#EDE5DC] p-4">
              <p className="text-[10px] text-[#9D8F85] font-bold mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-4 rounded-full bg-red-500" />
                وصف المشكلة
              </p>
              <p className="text-sm text-[#2D2926] leading-relaxed whitespace-pre-wrap">{report.description}</p>
            </div>
          )}

          {report.images?.length > 0 && (
            <div>
              <p className="text-[10px] text-[#9D8F85] font-bold mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-4 rounded-full bg-[#A98159]" />
                الصور المرفقة ({report.images.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {report.images.map((src, i) => (
                  <button key={i} onClick={() => openImageTab(src)} className="group relative block rounded-xl overflow-hidden border-2 border-[#EDE5DC] hover:border-[#A98159] transition-colors">
                    <img src={src} alt="" className="w-full h-32 object-cover transition-transform group-hover:scale-105" />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30 text-white text-xs font-black">
                      فتح الصورة
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {report.videoUrl && (
            <div>
              <p className="text-[10px] text-[#9D8F85] font-bold mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-4 rounded-full bg-indigo-500" />
                الفيديو المرفق
              </p>
              <video src={report.videoUrl} controls
                className="w-full rounded-xl border border-[#EDE5DC] bg-black max-h-72" />
            </div>
          )}

          {/* Admin notes — operations room */}
          <div className="bg-gradient-to-br from-[#FDF8F0] to-white border border-[#E8DDD4] rounded-2xl p-4">
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
              placeholder="اكتب ملاحظات تظهر للمراقب/المشرف الذي رفع البلاغ..."
              className="w-full px-3 py-2.5 border border-[#E8DDD4] rounded-xl text-sm text-[#2D2926] placeholder-[#C9B8A8] focus:border-[#A98159] focus:ring-2 focus:ring-[#A98159]/15 outline-none transition-all bg-white resize-none"
            />
            <button onClick={handleSaveNotes} disabled={savingNotes || notes === (report.adminNotes || '')}
              className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-br from-[#C4A46E] to-[#A98159] text-white text-sm font-black shadow-sm active:scale-[0.98] transition-all disabled:opacity-50">
              {savingNotes ? 'جارٍ الحفظ...' : 'حفظ الملاحظات'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Logistics Detail Modal ─── */
function LogisticsDetailModal({ item, onClose, onDelete, onStatusChange, onSaveNotes }) {
  if (!item) return null;
  const st = SUPPORT[item.supportType] || SUPPORT.internal;
  const [notes, setNotes]       = useState(item.adminNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedNotes,  setSavedNotes]  = useState(false);

  useEffect(() => {
    setNotes(item.adminNotes || '');
    setSavedNotes(false);
  }, [item.id]);

  const handleSaveNotes = async () => {
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      await onSaveNotes?.(item.id, notes);
      setSavedNotes(true);
      setTimeout(() => setSavedNotes(false), 4000);
    } catch (e) {
      alert(`فشل حفظ الملاحظات: ${e?.message || e}`);
    }
    setSavingNotes(false);
  };
  const SupportIcon = st.Icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">

        <div className="sticky top-0 bg-white border-b border-[#EDE5DC] px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl blur-md opacity-40" style={{ background: st.color }} />
              <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: `linear-gradient(135deg, ${st.color}, ${st.color}CC)` }}>
                <Package size={18} className="text-white" strokeWidth={2.25} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-black text-[#2D2926] text-sm">طلب إسناد</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border"
                  style={{ background: `${st.color}15`, borderColor: `${st.color}40`, color: st.color }}>
                  <SupportIcon size={10} strokeWidth={2.5} />
                  {st.short}
                </span>
                {item.requestNumber && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums"
                    style={{ background: '#EFF6FF', color: '#3B82F6', border: '1px solid #BFDBFE' }}>
                    #{item.requestNumber}
                  </span>
                )}
                {item.holySite && HOLY_SITE_LABEL[item.holySite] && (() => {
                  const HSIcon = HOLY_SITE_ICON[item.holySite];
                  return (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md text-white inline-flex items-center gap-1"
                      style={{ background: HOLY_SITE_COLOR[item.holySite] }}>
                      <HSIcon size={10} strokeWidth={2.5} />
                      {HOLY_SITE_LABEL[item.holySite]}
                    </span>
                  );
                })()}
              </div>
              <p className="text-[11px] text-[#A98159] font-bold mt-0.5">{timeAgo(item.timestamp)} · {clockTime(item.timestamp)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onDelete(item.id)}
              className="w-9 h-9 rounded-xl border-2 border-red-200 flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors text-red-500">
              <Trash2 size={14} strokeWidth={2.25} />
            </button>
            <button onClick={onClose}
              className="w-9 h-9 rounded-xl border border-[#EDE5DC] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors">
              <X size={15} className="text-[#6D6E71]" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Linked report banner */}
          {item.reportNumber && (
            <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50/40 rounded-2xl border-2 border-amber-200 p-3.5 flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-xl blur-md bg-amber-400 opacity-40" />
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                  <AlertTriangle size={16} className="text-white" strokeWidth={2.25} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-0.5">مرتبط ببلاغ</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-black text-[#2D2926]">{REPORT_TYPE[item.reportType] || item.reportType || 'بلاغ ميداني'}</p>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md tabular-nums bg-white border border-amber-300 text-amber-700">
                    #{item.reportNumber}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Status timeline */}
          <StatusTimeline
            doc={item}
            terminalStatuses={TERMINAL_LOGISTICS_STATUSES}
            statusOrder={['pending', 'approved', 'delivered', 'rejected']}
            statusMeta={LOGISTICS_STATUS}
            accentColor="#2563EB"
          />

          {/* Status changer */}
          <div className="bg-white rounded-2xl border border-[#EDE5DC] p-3">
            <p className="text-[10px] font-bold text-[#9D8F85] mb-2 flex items-center gap-1">
              <Activity size={11} strokeWidth={2.25} className="text-blue-500" />
              تغيير الحالة
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(LOGISTICS_STATUS).map(([key, s]) => {
                const SIcon = s.Icon;
                const active = (item.status || 'pending') === key;
                return (
                  <button key={key}
                    onClick={() => onStatusChange(item.id, key)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black border-2 transition-all ${
                      active ? 'shadow-md scale-[1.02]' : 'bg-white border-[#EDE5DC] text-[#6D6E71]'
                    }`}
                    style={active
                      ? { background: s.bg, borderColor: s.text, color: s.text }
                      : undefined}>
                    <SIcon size={12} strokeWidth={2.5} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantities */}
          {(item.qtyInternal || item.qtyExternal) && (
            <div className="grid grid-cols-2 gap-2.5">
              {item.qtyInternal != null && (
                <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #60A5FA, #3B82F6)' }}>
                    <ArrowRight size={16} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-blue-700">داخلي</p>
                    <p className="text-xl font-black tabular-nums text-blue-700 leading-tight">{item.qtyInternal}</p>
                  </div>
                </div>
              )}
              {item.qtyExternal != null && (
                <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' }}>
                    <ArrowLeft size={16} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-violet-700">خارجي</p>
                    <p className="text-xl font-black tabular-nums text-violet-700 leading-tight">{item.qtyExternal}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { lbl: 'المراقب', val: item.observer, Icon: User,     color: '#A98159' },
              { lbl: 'المركز',  val: item.center,   Icon: Building2,color: st.color  },
              { lbl: 'الوقت',   val: clockTime(item.timestamp), Icon: Calendar, color: '#6D6E71' },
            ].map(c => (
              <div key={c.lbl} className="bg-white rounded-xl border border-[#EDE5DC] p-2.5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}15` }}>
                  <c.Icon size={13} style={{ color: c.color }} strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-[#9D8F85] font-bold">{c.lbl}</p>
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
              <p className="text-[11px] font-black text-[#A98159] truncate">{item.caterer || getCaterer(item.center) || '—'}</p>
            </div>
          </div>

          {item.notes && (
            <div className="bg-white rounded-2xl border border-[#EDE5DC] p-4">
              <p className="text-[10px] text-[#9D8F85] font-bold mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-4 rounded-full bg-blue-500" />
                ملاحظات
              </p>
              <p className="text-sm text-[#2D2926] leading-relaxed whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          {/* Admin notes — operations room */}
          <div className="bg-gradient-to-br from-[#FDF8F0] to-white border border-[#E8DDD4] rounded-2xl p-4">
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
            <button onClick={handleSaveNotes} disabled={savingNotes || notes === (item.adminNotes || '')}
              className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-br from-[#C4A46E] to-[#A98159] text-white text-sm font-black shadow-sm active:scale-[0.98] transition-all disabled:opacity-50">
              {savingNotes ? 'جارٍ الحفظ...' : 'حفظ الملاحظات'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section panel header ─── */
function PanelHeader({ title, subtitle, count, gradient, Icon, onViewAll, viewAllColor, badge, badgeVariant }) {
  return (
    <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-3.5 border-b border-[#EDE5DC] gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ background: gradient.from }} />
          <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}>
            <Icon size={17} className="text-white" strokeWidth={2.25} />
          </div>
          {badge != null && badge > 0 && (
            <NotificationBadge count={badge} variant={badgeVariant} floating />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-black text-[#2D2926] text-sm truncate">{title}</p>
          <p className="text-[11px] text-[#9D8F85] mt-0.5 font-bold truncate">{subtitle}</p>
        </div>
      </div>
      <button onClick={onViewAll}
        className="flex items-center gap-1.5 text-[11px] font-black transition-all px-3 py-1.5 rounded-xl shrink-0"
        style={{ color: viewAllColor, background: `${viewAllColor}10`, border: `1px solid ${viewAllColor}30` }}>
        عرض الكل
        <ArrowLeft size={11} strokeWidth={2.25} />
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [counts,            setCounts]            = useState({ reports: 0, evals: 0, logistics: 0, mina: 0, arafat: 0 });
  const [reports,           setReports]           = useState([]);
  const [pendingReports,    setPendingReports]    = useState(0);
  const [logisticsFeed,     setLogisticsFeed]     = useState([]);
  const [pendingLogistics,  setPendingLogistics]  = useState(0);
  const [activityFeed,      setActivityFeed]      = useState([]);
  const [selectedReport,    setSelectedReport]    = useState(null);
  const [selectedLogistics, setSelectedLogistics] = useState(null);
  const [centerFilter,      setCenterFilter]      = useState('');
  const [searchQuery,       setSearchQuery]       = useState('');
  const [clock,             setClock]             = useState({ hijri: '', time: '' });

  /* Live clock */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({
        hijri: formatHijri(now),
        time:  now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleDeleteReport = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا البلاغ؟')) return;
    await db.reports.delete(id);
    setSelectedReport(null);
  };
  const handleStatusChange = async (id, status) => {
    const current = reports.find(r => r.id === id) || selectedReport || {};
    const update  = computeStatusUpdate(current, status, TERMINAL_REPORT_STATUSES) || { status };
    await db.reports.update(id, update);
    setSelectedReport(prev => prev?.id === id ? { ...prev, ...update, status } : prev);
  };
  const handleLogisticsStatusChange = async (id, status) => {
    const current = logisticsFeed.find(i => i.id === id) || selectedLogistics || {};
    const update  = computeStatusUpdate(current, status, TERMINAL_LOGISTICS_STATUSES) || { status };
    await db.logistics_requests.update(id, update);
    setLogisticsFeed(prev => prev.map(i => i.id === id ? { ...i, ...update, status } : i));
    setSelectedLogistics(prev => prev?.id === id ? { ...prev, ...update, status } : prev);
  };
  const handleDeleteLogistics = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    await db.logistics_requests.delete(id);
    setSelectedLogistics(null);
  };
  const handleSaveReportNotes = async (id, adminNotes) => {
    await db.reports.update(id, { adminNotes });
    setSelectedReport(prev => prev?.id === id ? { ...prev, adminNotes } : prev);
  };
  const handleSaveLogisticsNotes = async (id, adminNotes) => {
    await db.logistics_requests.update(id, { adminNotes });
    setSelectedLogistics(prev => prev?.id === id ? { ...prev, adminNotes } : prev);
  };

  useEffect(() => {
    const byTime = arr => [...arr].sort((a, b) =>
      (b.timestamp?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0) -
      (a.timestamp?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
    );

    const unsubs = [
      db.reports.subscribe(items => {
        const sorted = byTime(items);
        setCounts(p => ({ ...p, reports: sorted.length }));
        setReports(sorted);
        setPendingReports(sorted.filter(i => (i.status || 'pending') === 'pending').length);
      }),
      db.logistics_requests.subscribe(items => {
        const sorted = byTime(items);
        setCounts(p => ({ ...p, logistics: sorted.length }));
        setLogisticsFeed(sorted);
        setPendingLogistics(sorted.filter(i => (i.status || 'pending') === 'pending').length);
      }),
      db.meal_evaluations.subscribe(items => {
        const tagged = items.map(i => ({ ...i, _col: 'meal' }));
        setCounts(p => ({ ...p, evals: tagged.length }));
        setActivityFeed(p => byTime([...p.filter(i => i._col !== 'meal'), ...tagged]));
      }),
      db.mina_readiness.subscribe(items => {
        const tagged = items.map(i => ({ ...i, _col: 'mina' }));
        setCounts(p => ({ ...p, mina: tagged.length }));
        setActivityFeed(p => byTime([...p.filter(i => i._col !== 'mina'), ...tagged]));
      }),
      db.arafat_readiness.subscribe(items => {
        const tagged = items.map(i => ({ ...i, _col: 'arafat' }));
        setCounts(p => ({ ...p, arafat: tagged.length }));
        setActivityFeed(p => byTime([...p.filter(i => i._col !== 'arafat'), ...tagged]));
      }),
    ];
    return () => unsubs.forEach(u => u?.());
  }, []);

  const centerOptions = useMemo(() => {
    const set = new Set();
    activityFeed.forEach(i => {
      const c = getActivityCenter(i);
      if (c && c !== '—') set.add(c);
    });
    return [...set].sort((a, b) => {
      const na = parseInt(a.replace(/[^0-9]/g, '')) || 0;
      const nb = parseInt(b.replace(/[^0-9]/g, '')) || 0;
      return na - nb;
    });
  }, [activityFeed]);

  const filteredActivity = useMemo(() =>
    centerFilter
      ? activityFeed.filter(i => getActivityCenter(i) === centerFilter)
      : activityFeed,
    [activityFeed, centerFilter]
  );

  const STATS = [
    { label: 'البلاغات الميدانية', value: counts.reports,   Icon: AlertTriangle,  color: '#EF4444', sub: 'بلاغات نشطة',    nav: '/admin/reports'   },
    { label: 'تقييم الوجبات',       value: counts.evals,     Icon: Utensils,       color: '#A98159', sub: 'جودة الوجبات',   nav: '/admin/phases'    },
    { label: 'طلبات الإسناد',       value: counts.logistics, Icon: Truck,          color: '#3B82F6', sub: 'طلبات لوجستية',  nav: '/admin/logistics' },
    { label: 'جاهزية منى',          value: counts.mina,      Icon: ShieldCheck,    color: '#10B981', sub: 'تقييمات منى',    nav: '/admin/analytics' },
    { label: 'جاهزية عرفة',         value: counts.arafat,    Icon: ShieldCheck,    color: '#1D6FA4', sub: 'تقييمات عرفة',   nav: '/admin/analytics' },
  ];

  return (
    <div className="space-y-5 pb-6" dir="rtl">

      {/* Page header */}
      <PageHeader
        Icon={LayoutDashboard}
        title="نظرة عامة"
        subtitle="مؤشرات الأداء الميداني — موسم الحج ١٤٤٧ هـ"
        right={
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
            <AdminReportGenerator />
            <div className="hidden md:flex items-stretch rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(169,129,89,0.25)]"
              style={{ background: 'linear-gradient(135deg, #C4A46E 0%, #A98159 50%, #8B6840 100%)' }}>
              <div className="flex items-center gap-2.5 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Calendar size={14} className="text-white" strokeWidth={2.25} />
                </div>
                <div>
                  <p className="text-white/70 text-[9px] font-bold leading-none">التاريخ الهجري</p>
                  <p className="text-white text-[11px] font-black mt-1 leading-tight">{clock.hijri || '...'}</p>
                </div>
              </div>
              <div className="w-px bg-white/20 my-3" />
              <div className="px-4 py-3 flex flex-col justify-center">
                <p className="text-white/70 text-[9px] font-bold leading-none">الوقت الآن</p>
                <p className="text-white text-sm font-black mt-1 tabular-nums leading-tight">{clock.time || '...'}</p>
              </div>
            </div>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {STATS.map(c => (
          <StatCard key={c.label} {...c} onClick={() => navigate(c.nav)} />
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9D8F85]" strokeWidth={2} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="بحث برقم البلاغ، طلب الإسناد، المركز، أو المراقب..."
          className="w-full pr-11 pl-4 py-3 rounded-2xl border-2 border-[#EDE5DC] bg-white text-sm font-medium text-[#2D2926] placeholder:text-[#C9B8A8] focus:border-[#A98159] focus:outline-none transition-colors shadow-[0_2px_8px_rgba(45,41,38,0.05)]"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-[#9D8F85] hover:bg-[#F5F0EB] transition-colors">
            <X size={14} strokeWidth={2.25} />
          </button>
        )}
      </div>

      {/* Reports + Logistics: stacked, full width */}
      <div className="space-y-4">

        {/* Field reports */}
        <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_10px_rgba(45,41,38,0.06)] overflow-hidden">
          <PanelHeader
            title="البلاغات الميدانية"
            subtitle={`${counts.reports} بلاغ ${pendingReports > 0 ? `· ${pendingReports} قيد الانتظار` : ''}`}
            gradient={{ from: '#F87171', to: '#DC2626' }}
            Icon={AlertTriangle}
            onViewAll={() => navigate('/admin/reports')}
            viewAllColor="#DC2626"
            badge={pendingReports}
            badgeVariant="red"
          />

          {(() => {
            const q = searchQuery.trim().toLowerCase();
            const displayed = q
              ? reports.filter(r =>
                  (r.reportNumber || '').toString().toLowerCase().includes(q) ||
                  (r.center        || '').toLowerCase().includes(q) ||
                  (r.observer      || '').toLowerCase().includes(q))
              : reports.slice(0, 6);
            if (displayed.length === 0) return (
              <div className="py-12 text-center px-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, #FEE2E2, #FECACA)' }}>
                  <Search size={20} className="text-red-400" strokeWidth={2} />
                </div>
                <p className="text-[#9D8F85] text-sm font-bold">
                  {q ? 'لا توجد نتائج' : 'لا توجد بلاغات بعد'}
                </p>
              </div>
            );
            return displayed.map((r, idx) => {
              const label  = REPORT_TYPE[r.reportType || r.type] || r.reportType || r.type || 'بلاغ';
              const sv     = SEV[r.severity];
              const sb     = STATUS[r.status] || STATUS.pending;
              const SIcon  = sb.Icon;
              const isLast = idx === displayed.length - 1;
              const isNew  = isNewReport(r);
              return (
                <button key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className={`group relative w-full text-right flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-3.5 transition-colors ${!isLast ? 'border-b border-[#EDE5DC]' : ''} ${isNew ? 'row-pulse-red' : 'hover:bg-red-50/30'}`}>
                  {/* "جديد" pill on new rows */}
                  {isNew && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md text-white shadow-md tabular-nums tracking-wide"
                      style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      جديد
                    </span>
                  )}
                  {/* Icon */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-xl blur-md bg-red-400 opacity-0 group-hover:opacity-50 transition-opacity" />
                    <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #F87171, #DC2626)' }}>
                      <AlertTriangle size={18} className="text-white" strokeWidth={2.25} />
                    </div>
                    {isNew && (
                      <div className="absolute -top-1 -right-1 badge-pulse-red w-4 h-4 rounded-full bg-red-500 border-2 border-white" />
                    )}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <p className="text-sm font-black text-[#2D2926] truncate">{label}</p>
                      {r.reportNumber && (
                        <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums tracking-wide ${
                          isNew ? 'badge-pulse-red text-white' : 'text-red-700 border'
                        }`}
                          style={isNew
                            ? { background: 'linear-gradient(135deg, #EF4444, #DC2626)' }
                            : { background: '#FEF2F2', borderColor: '#FECACA' }}>
                          #{r.reportNumber}
                        </span>
                      )}
                      {sv && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
                          style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: sv.bar }} />
                          {sv.label}
                        </span>
                      )}
                      {r.mealType && MEAL_LABEL[r.mealType] && (
                        <span className="inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                          style={{ background: MEAL_COLOR[r.mealType] || '#A98159' }}>
                          {MEAL_LABEL[r.mealType]}
                        </span>
                      )}
                      {r.holySite && HOLY_SITE_LABEL[r.holySite] && (() => {
                        const HSIcon = HOLY_SITE_ICON[r.holySite];
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                            style={{ background: HOLY_SITE_COLOR[r.holySite] }}>
                            <HSIcon size={9} strokeWidth={2.5} />
                            {HOLY_SITE_LABEL[r.holySite]}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#6D6E71] flex-wrap">
                      <span className="flex items-center gap-1">
                        <User size={10} strokeWidth={2.25} className="text-[#A98159]" />
                        <span className="font-bold text-[#2D2926] truncate max-w-[80px]">{r.observer || '—'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 size={10} strokeWidth={2.25} className="text-[#A98159]" />
                        <span className="font-bold text-[#2D2926] truncate max-w-[80px]">{r.center || '—'}</span>
                      </span>
                    </div>
                    <div className="mt-1">
                      <StatusTimerChip doc={r} terminalStatuses={TERMINAL_REPORT_STATUSES} statusMeta={STATUS} compact />
                    </div>
                  </div>
                  {/* Status pill */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border-2"
                      style={{ background: sb.bg, borderColor: sb.border, color: sb.text }}>
                      <SIcon size={10} strokeWidth={2.5} />
                      {sb.label}
                    </span>
                    <ChevronRight size={12} className="text-[#C9B8A8] group-hover:text-red-500 transition-colors" strokeWidth={2.25} />
                  </div>
                </button>
              );
            });
          })()}
        </div>

        {/* Logistics requests */}
        <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_10px_rgba(45,41,38,0.06)] overflow-hidden">
          <PanelHeader
            title="طلبات الإسناد"
            subtitle={`${counts.logistics} طلب ${pendingLogistics > 0 ? `· ${pendingLogistics} قيد الانتظار` : ''}`}
            gradient={{ from: '#60A5FA', to: '#2563EB' }}
            Icon={Truck}
            onViewAll={() => navigate('/admin/logistics')}
            viewAllColor="#2563EB"
            badge={pendingLogistics}
            badgeVariant="blue"
          />

          {(() => {
            const q = searchQuery.trim().toLowerCase();
            const displayed = q
              ? logisticsFeed.filter(r =>
                  (r.requestNumber || '').toString().toLowerCase().includes(q) ||
                  (r.reportNumber  || '').toString().toLowerCase().includes(q) ||
                  (r.center        || '').toLowerCase().includes(q) ||
                  (r.observer      || '').toLowerCase().includes(q))
              : logisticsFeed.slice(0, 6);
            if (displayed.length === 0) return (
              <div className="py-12 text-center px-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)' }}>
                  <Search size={20} className="text-blue-400" strokeWidth={2} />
                </div>
                <p className="text-[#9D8F85] text-sm font-bold">
                  {q ? 'لا توجد نتائج' : 'لا توجد طلبات إسناد بعد'}
                </p>
              </div>
            );
            return displayed.map((item, idx) => {
              const sb = LOGISTICS_STATUS[item.status] || LOGISTICS_STATUS.pending;
              const SIcon = sb.Icon;
              const st = SUPPORT[item.supportType] || SUPPORT.internal;
              const SupportIcon = st.Icon;
              const isLast = idx === displayed.length - 1;
              const isNew  = isNewLogistics(item);
              return (
                <button key={item.id}
                  onClick={() => setSelectedLogistics(item)}
                  className={`group relative w-full text-right flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-3.5 transition-colors ${!isLast ? 'border-b border-[#EDE5DC]' : ''} ${isNew ? 'row-pulse-blue' : 'hover:bg-blue-50/30'}`}>
                  {/* "جديد" pill on new rows */}
                  {isNew && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md text-white shadow-md tabular-nums tracking-wide"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      جديد
                    </span>
                  )}
                  {/* Icon */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity"
                      style={{ background: st.color }} />
                    <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${st.color}, ${st.color}CC)` }}>
                      <Package size={18} className="text-white" strokeWidth={2.25} />
                    </div>
                    {isNew && (
                      <div className="absolute -top-1 -right-1 badge-pulse-blue w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                    )}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <p className="text-sm font-black text-[#2D2926]">طلب إسناد</p>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
                        style={{ background: `${st.color}15`, borderColor: `${st.color}40`, color: st.color }}>
                        <SupportIcon size={9} strokeWidth={2.5} />
                        {st.short}
                      </span>
                      {item.requestNumber && (
                        <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums tracking-wide ${
                          isNew ? 'badge-pulse-blue text-white' : 'text-blue-700 border'
                        }`}
                          style={isNew
                            ? { background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }
                            : { background: '#EFF6FF', borderColor: '#BFDBFE' }}>
                          #{item.requestNumber}
                        </span>
                      )}
                      {item.holySite && HOLY_SITE_LABEL[item.holySite] && (() => {
                        const HSIcon = HOLY_SITE_ICON[item.holySite];
                        return (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                            style={{ background: HOLY_SITE_COLOR[item.holySite] }}>
                            <HSIcon size={9} strokeWidth={2.5} />
                            {HOLY_SITE_LABEL[item.holySite]}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#6D6E71] flex-wrap">
                      <span className="flex items-center gap-1">
                        <User size={10} strokeWidth={2.25} className="text-[#A98159]" />
                        <span className="font-bold text-[#2D2926] truncate max-w-[80px]">{item.observer || '—'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 size={10} strokeWidth={2.25} className="text-[#A98159]" />
                        <span className="font-bold text-[#2D2926] truncate max-w-[80px]">{item.center || '—'}</span>
                      </span>
                    </div>
                    <div className="mt-1">
                      <StatusTimerChip doc={item} terminalStatuses={TERMINAL_LOGISTICS_STATUSES} statusMeta={LOGISTICS_STATUS} compact />
                    </div>
                    {item.reportNumber && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
                        <AlertTriangle size={9} strokeWidth={2.5} className="text-amber-600" />
                        بلاغ
                        <span className="tabular-nums bg-white border border-amber-300 rounded px-1 text-amber-700">#{item.reportNumber}</span>
                      </div>
                    )}
                  </div>
                  {/* Status pill */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border-2"
                      style={{ background: sb.bg, borderColor: sb.border, color: sb.text }}>
                      <SIcon size={10} strokeWidth={2.5} />
                      {sb.label}
                    </span>
                    <ChevronRight size={12} className="text-[#C9B8A8] group-hover:text-blue-500 transition-colors" strokeWidth={2.25} />
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Today's menu — coverage strip per nationality */}
      <MenuOverview navigate={navigate} />

      {/* Field activities */}
      <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_10px_rgba(45,41,38,0.06)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EDE5DC] gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl blur-md opacity-50 bg-[#A98159]" />
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
                <ClipboardList size={17} className="text-white" strokeWidth={2.25} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-black text-[#2D2926] text-sm truncate">النشاطات الميدانية</p>
              <p className="text-[11px] text-[#9D8F85] mt-0.5 font-bold truncate">
                تقييمات الوجبات وجاهزية المشاعر
              </p>
            </div>
          </div>

          {centerOptions.length > 0 && (
            <div className="relative shrink-0">
              <Filter size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A98159] pointer-events-none" strokeWidth={2.25} />
              <select
                value={centerFilter}
                onChange={e => setCenterFilter(e.target.value)}
                className="appearance-none text-[11px] font-black border-2 border-[#E8DDD4] rounded-xl pl-7 pr-7 py-1.5 outline-none cursor-pointer transition-all bg-[#FDF8F0] text-[#2D2926] hover:border-[#A98159] focus:border-[#A98159]"
              >
                <option value="">جميع المراكز</option>
                {centerOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9D8F85] pointer-events-none" strokeWidth={2.25} />
            </div>
          )}
        </div>

        {filteredActivity.length === 0 ? (
          <div className="py-12 text-center px-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #FDF8F0, #F3EAE0)' }}>
              <ClipboardList size={20} className="text-[#C4A46E]" strokeWidth={2} />
            </div>
            <p className="text-[#9D8F85] text-sm font-bold">
              {centerFilter ? `لا توجد نشاطات لـ ${centerFilter}` : 'لا توجد نشاطات بعد'}
            </p>
          </div>
        ) : (
          filteredActivity.slice(0, 8).map((item, i) => {
            const isMina = item._col === 'mina';
            const isMeal = item._col === 'meal';
            const center   = getActivityCenter(item);
            const observer = getActivityObserver(item);
            const score    = getActivityScore(item);
            const scoreSt = score == null ? null
              : score >= 8 ? { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' }
              : score >= 5 ? { bg: '#FFFBEB', text: '#B45309', border: '#FCD34D' }
              :              { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' };
            const isLast = i === Math.min(filteredActivity.length, 8) - 1;

            const meta = isMeal
              ? { Icon: Utensils,    color: '#F59E0B', label: 'تقييم جودة الوجبات', nav: '/admin/phases'    }
              : isMina
              ? { Icon: ShieldCheck, color: '#10B981', label: 'جاهزية مشعر منى',    nav: '/admin/analytics' }
              : { Icon: ShieldCheck, color: '#1D6FA4', label: 'جاهزية مشعر عرفة',   nav: '/admin/analytics' };

            return (
              <button key={`${item._col}-${item.id}`}
                onClick={() => navigate(meta.nav)}
                className={`group w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#FDFAF7] transition-colors text-right ${!isLast ? 'border-b border-[#EDE5DC]' : ''}`}>
                {/* Icon */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity"
                    style={{ background: meta.color }} />
                  <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)` }}>
                    <meta.Icon size={18} className="text-white" strokeWidth={2.25} />
                  </div>
                </div>
                {/* Body */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#2D2926] truncate mb-1">{meta.label}</p>
                  <div className="flex items-center gap-2 text-[11px] text-[#6D6E71] flex-wrap">
                    <span className="flex items-center gap-1">
                      <User size={10} strokeWidth={2.25} className="text-[#A98159]" />
                      <span className="font-bold text-[#2D2926] truncate max-w-[120px]">{observer}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 size={10} strokeWidth={2.25} className="text-[#A98159]" />
                      <span className="font-bold text-[#2D2926] truncate max-w-[120px]">{center}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} strokeWidth={2.25} className="text-[#A98159]" />
                      <span className="font-bold">{timeAgo(item.timestamp)}</span>
                    </span>
                  </div>
                </div>
                {scoreSt && score != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border-2 tabular-nums shrink-0"
                    style={{ background: scoreSt.bg, color: scoreSt.text, borderColor: scoreSt.border }}>
                    <Sparkles size={10} strokeWidth={2.5} />
                    {score.toFixed(1)}
                    <span className="text-[9px] opacity-70">/10</span>
                  </span>
                )}
                <ChevronRight size={12} className="text-[#C9B8A8] group-hover:text-[#A98159] transition-colors shrink-0" strokeWidth={2.25} />
              </button>
            );
          })
        )}
      </div>

      {/* Modals */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onDelete={handleDeleteReport}
          onStatusChange={handleStatusChange}
          onSaveNotes={handleSaveReportNotes}
        />
      )}
      {selectedLogistics && (
        <LogisticsDetailModal
          item={selectedLogistics}
          onClose={() => setSelectedLogistics(null)}
          onDelete={handleDeleteLogistics}
          onStatusChange={handleLogisticsStatusChange}
          onSaveNotes={handleSaveLogisticsNotes}
        />
      )}
    </div>
  );
}

function MenuOverview({ navigate }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_10px_rgba(45,41,38,0.06)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EDE5DC]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50 bg-amber-500" />
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              <Utensils size={17} className="text-white" strokeWidth={2.25} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-black text-[#2D2926] text-sm truncate">منيو الجنسيات</p>
            <p className="text-[11px] text-[#9D8F85] mt-0.5 font-bold truncate">
              تغطية المنيو حسب الجنسية ليوم ذو الحجة والوجبة
            </p>
          </div>
        </div>
        <button onClick={() => navigate('/admin/menu')}
          className="flex items-center gap-1.5 text-[11px] font-black transition-all px-3 py-1.5 rounded-xl shrink-0"
          style={{ color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          إدارة المنيو
          <ArrowLeft size={11} strokeWidth={2.25} />
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {NATIONALITIES.map(s => (
          <button key={s.key}
            onClick={() => navigate('/admin/menu')}
            className="group text-right bg-white rounded-xl border-2 border-[#EDE5DC] p-3 hover:shadow-md hover:border-[#D9CEBC] hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-lg blur-sm opacity-40"
                  style={{ background: s.color }} />
                <div className="relative w-9 h-9 rounded-lg flex items-center justify-center text-base shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}CC)` }}>
                  <span className="drop-shadow">{s.flag}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-[#2D2926] truncate">{s.label}</p>
                <p className="text-[9px] text-[#9D8F85] font-bold mt-0.5">{s.centers.length} مركز</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
