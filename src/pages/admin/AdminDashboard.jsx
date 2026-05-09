import { useEffect, useState } from 'react';
import { collection, onSnapshot, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import {
  AlertTriangle, Truck, ClipboardList, Mountain,
  Clock, Trash2, X, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCaterer } from '../../config/centers.js';

/* ─── Lookup tables ─── */
const REPORT_TYPE = {
  water:    'تسرب مياه',
  electric: 'عطل كهربائي',
  crowd:    'ازدحام حرج',
  food:     'مشكلة غذائية',
  medical:  'حالة طبية طارئة',
  security: 'بلاغ أمني',
  fire:     'حريق / دخان',
  other:    'بلاغ آخر',
  shortage: 'نقص كميات',
  delay:    'تأخر توزيع',
  quality:  'مشكلة جودة',
  hygiene:  'مخالفة صحية',
};

const SEV = {
  high:   { label: 'عالية',   bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
  urgent: { label: 'عاجل',    bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
  medium: { label: 'متوسطة',  bg: '#FFFBEB', text: '#B45309', border: '#FCD34D' },
  low:    { label: 'منخفضة',  bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
};

const STATUS = {
  pending:     { label: 'قيد الانتظار', bg: '#FEFCE8', text: '#854D0E', border: '#FDE047' },
  in_progress: { label: 'جارٍ التنفيذ', bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
  resolved:    { label: 'تم الحل',      bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
};

const SUPPORT = { internal: 'داخلي', external: 'خارجي', both: 'داخلي وخارجي' };

/* ─── Helpers ─── */
function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)    return 'الآن';
  if (s < 3600)  return `${Math.floor(s / 60)}د`;
  if (s < 86400) return `${Math.floor(s / 3600)}س`;
  return `${Math.floor(s / 86400)} يوم`;
}

function clockTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function openImageTab(src) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>صورة البلاغ</title>
    <style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head>
    <body><img src="${src}"/></body></html>`);
  win.document.close();
}

/* ─── Stat Card ─── */
function StatCard({ label, value, icon: Icon, color, sub, onClick }) {
  return (
    <button onClick={onClick}
      className="group rounded-2xl p-5 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)] flex items-center gap-4 w-full text-right hover:shadow-[0_8px_28px_rgba(45,41,38,0.13)] hover:border-[#C9B8A8] transition-all duration-200 active:scale-[0.98]"
      style={{
        borderRight: `3px solid ${color}`,
        background: `linear-gradient(145deg, #ffffff 45%, ${color}0F 100%)`,
      }}>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[#9D8F85] mb-1">{label}</p>
        <p className="text-[2rem] font-bold leading-none tabular-nums" style={{ color }}>{value ?? '—'}</p>
        {sub && <p className="text-[11px] text-[#B5A99E] mt-1.5 font-medium">{sub}</p>}
      </div>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:shadow-md"
        style={{ background: `linear-gradient(135deg, ${color}28, ${color}14)` }}>
        <Icon size={22} style={{ color }} strokeWidth={1.5} />
      </div>
    </button>
  );
}

/* ─── Report Detail Modal ─── */
function ReportDetailModal({ report, onClose, onDelete, onStatusChange }) {
  if (!report) return null;
  const label = REPORT_TYPE[report.reportType || report.type] || 'بلاغ';
  const sv    = SEV[report.severity];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl ring-1 ring-black/5">

        {/* Modal header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-[#EDE5DC] px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <p className="font-bold text-[#2D2926] text-base">{label}</p>
            <p className="text-[11px] text-[#9D8F85] mt-0.5">{timeAgo(report.timestamp)} · {clockTime(report.timestamp)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onDelete(report.id)}
              className="h-9 px-3.5 rounded-xl border border-red-200 flex items-center gap-1.5 hover:bg-red-50 transition-colors text-red-500 text-xs font-semibold">
              <Trash2 size={13} strokeWidth={1.5} /> حذف
            </button>
            <button onClick={onClose}
              className="w-9 h-9 rounded-xl border border-[#EDE5DC] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors">
              <X size={16} className="text-[#6D6E71]" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Severity badge */}
          {sv && (
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-lg text-xs font-semibold border"
                style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                خطورة {sv.label}
              </span>
            </div>
          )}

          {/* Status selector */}
          <div>
            <p className="text-[11px] font-semibold text-[#9D8F85] mb-2">حالة البلاغ</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATUS).map(([key, s]) => {
                const active = (report.status || 'pending') === key;
                return (
                  <button key={key}
                    onClick={() => onStatusChange(report.id, key)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all"
                    style={active
                      ? { background: s.bg, borderColor: s.border, color: s.text, boxShadow: `0 2px 8px ${s.border}` }
                      : { background: '#fff', borderColor: '#EDE5DC', color: '#9D8F85' }}>
                    {active && <CheckCircle2 size={12} strokeWidth={2} />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { lbl: 'المراقب',     val: report.observer },
              { lbl: 'المركز',      val: report.center   },
              { lbl: 'نوع البلاغ',  val: label           },
              { lbl: 'وقت الإرسال', val: clockTime(report.timestamp) },
            ].map(c => (
              <div key={c.lbl} className="bg-[#FAFAF8] rounded-xl border border-[#EDE5DC] p-3.5">
                <p className="text-[10px] font-semibold text-[#9D8F85] mb-1">{c.lbl}</p>
                <p className="font-bold text-[#2D2926] text-sm">{c.val || '—'}</p>
              </div>
            ))}
            <div className="col-span-2 bg-[#FDF8F0] rounded-xl border border-[#EDE5DC] p-3.5">
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-1">المتعهد</p>
              <p className="font-bold text-[#A98159] text-sm">
                {report.caterer || getCaterer(report.center) || '—'}
              </p>
            </div>
          </div>

          {/* Description */}
          {report.description && (
            <div className="bg-[#FAFAF8] rounded-xl border border-[#EDE5DC] p-4">
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-2">وصف المشكلة</p>
              <p className="text-sm text-[#2D2926] leading-relaxed">{report.description}</p>
            </div>
          )}

          {/* Images */}
          {report.images?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-2">الصور المرفقة ({report.images.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {report.images.map((src, i) => (
                  <button key={i} onClick={() => openImageTab(src)} className="group relative block w-full">
                    <img src={src} alt="" className="w-full h-32 object-cover rounded-xl border border-[#EDE5DC]" />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-xl text-white text-xs font-semibold">
                      فتح الصورة
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {report.videos?.length > 0 && (
            <div className="bg-[#FAFAF8] rounded-xl border border-[#EDE5DC] p-3.5">
              <p className="text-[10px] font-semibold text-[#9D8F85] mb-2">مقاطع الفيديو ({report.videos.length})</p>
              {report.videos.map((name, i) => (
                <p key={i} className="text-sm text-[#2D2926] flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-red-100 text-red-500 text-[10px] flex items-center justify-center flex-shrink-0">▶</span>
                  {name}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [counts,         setCounts]         = useState({ reports: 0, evals: 0, logistics: 0, mina: 0, arafat: 0 });
  const [reports,        setReports]        = useState([]);
  const [otherFeed,      setOtherFeed]      = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [clock,          setClock]          = useState({ hijri: '', time: '' });

  /* Live clock */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({
        hijri: now.toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' }),
        time:  now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* Delete report */
  const handleDeleteReport = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا البلاغ؟')) return;
    await deleteDoc(doc(db, 'reports', id));
    setSelectedReport(null);
  };

  /* Change report status */
  const handleStatusChange = async (id, status) => {
    await updateDoc(doc(db, 'reports', id), { status });
    setSelectedReport(prev => prev?.id === id ? { ...prev, status } : prev);
  };

  /* Firestore listeners */
  useEffect(() => {
    const byTime = arr => [...arr].sort((a, b) =>
      (b.timestamp?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0) -
      (a.timestamp?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
    );

    const unsubs = [
      onSnapshot(collection(db, 'reports'), s => {
        setCounts(p => ({ ...p, reports: s.size }));
        setReports(byTime(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }),
      onSnapshot(collection(db, 'meal_evaluations'), s =>
        setCounts(p => ({ ...p, evals: s.size }))
      ),
      onSnapshot(collection(db, 'logistics_requests'), s => {
        setCounts(p => ({ ...p, logistics: s.size }));
        const items = byTime(s.docs.map(d => ({ id: d.id, ...d.data(), _col: 'logistics' })));
        setOtherFeed(p => byTime([...p.filter(i => i._col !== 'logistics'), ...items.slice(0, 3)]));
      }),
      onSnapshot(collection(db, 'mina_readiness'), s => {
        setCounts(p => ({ ...p, mina: s.size }));
        const items = byTime(s.docs.map(d => ({ id: d.id, ...d.data(), _col: 'mina' })));
        setOtherFeed(p => byTime([...p.filter(i => i._col !== 'mina'), ...items.slice(0, 3)]));
      }),
      onSnapshot(collection(db, 'arafat_readiness'), s => {
        setCounts(p => ({ ...p, arafat: s.size }));
        const items = byTime(s.docs.map(d => ({ id: d.id, ...d.data(), _col: 'arafat' })));
        setOtherFeed(p => byTime([...p.filter(i => i._col !== 'arafat'), ...items.slice(0, 3)]));
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const STATS = [
    { label: 'البلاغات الميدانية', value: counts.reports,   icon: AlertTriangle, color: '#E53E3E', sub: 'بلاغات نشطة',     nav: '/admin/reports'   },
    { label: 'التقييمات',           value: counts.evals,     icon: ClipboardList, color: '#A98159', sub: 'جودة الوجبات',    nav: '/admin/analytics' },
    { label: 'طلبات الإسناد',       value: counts.logistics, icon: Truck,         color: '#3182CE', sub: 'طلبات لوجستية',  nav: '/admin/logistics' },
    { label: 'جاهزية منى',         value: counts.mina,      icon: Mountain,      color: '#2F855A', sub: 'تقييمات منى',     nav: '/admin/analytics' },
    { label: 'جاهزية عرفة',        value: counts.arafat,    icon: Mountain,      color: '#0987A0', sub: 'تقييمات عرفة',    nav: '/admin/analytics' },
  ];

  return (
    <div className="space-y-6 pb-4">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2926] leading-tight">نظرة عامة</h1>
          <p className="text-sm text-[#9D8F85] mt-1 font-medium">مؤشرات الأداء الميداني — موسم الحج ١٤٤٧ هـ</p>
        </div>

        {/* Hijri clock — gold gradient */}
        <div className="flex items-stretch rounded-2xl overflow-hidden flex-shrink-0 shadow-[0_4px_20px_rgba(169,129,89,0.35)]"
          style={{ background: 'linear-gradient(135deg, #C4A46E 0%, #A98159 50%, #8B6840 100%)' }}>
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Clock size={15} className="text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-white/60 text-[10px] font-semibold leading-none">التاريخ الهجري</p>
              <p className="text-white text-xs font-bold mt-1 leading-tight drop-shadow">{clock.hijri || '...'}</p>
            </div>
          </div>
          <div className="w-px bg-white/20 my-3" />
          <div className="px-5 py-3.5 flex flex-col justify-center">
            <p className="text-white/60 text-[10px] font-semibold leading-none">الوقت الآن</p>
            <p className="text-white text-sm font-extrabold mt-1 tabular-nums leading-tight drop-shadow">{clock.time || '...'}</p>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {STATS.map(c => (
          <StatCard key={c.label} {...c} onClick={() => navigate(c.nav)} />
        ))}
      </div>

      {/* ── Field reports ── */}
      <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE5DC]"
          style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #fff 55%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FCA5A5, #F87171)' }}>
              <AlertTriangle size={16} className="text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-bold text-[#2D2926] text-sm">البلاغات الميدانية</h2>
              <p className="text-[11px] text-[#9D8F85] mt-0.5 font-medium">
                {counts.reports} بلاغ إجمالاً · تحديث لحظي
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/admin/reports')}
            className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg">
            عرض الكل
            <ArrowLeft size={12} strokeWidth={2} />
          </button>
        </div>

        {/* Rows */}
        {reports.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={18} className="text-gray-200" strokeWidth={1.5} />
            </div>
            <p className="text-[#9D8F85] text-sm font-medium">لا توجد بلاغات بعد</p>
          </div>
        ) : (
          reports.slice(0, 6).map((r, idx) => {
            const label = REPORT_TYPE[r.reportType || r.type] || 'بلاغ';
            const sv    = SEV[r.severity];
            const sb    = STATUS[r.status] || STATUS.pending;
            const isLast = idx === Math.min(reports.length, 6) - 1;
            return (
              <div key={r.id}
                className={`group flex items-center gap-4 px-6 py-4 hover:bg-[#FDFAF7] transition-colors ${!isLast ? 'border-b border-[#EDE5DC]' : ''}`}>
                {/* Clickable area */}
                {/* Clickable info area */}
                <button onClick={() => setSelectedReport(r)}
                  className="flex items-center gap-4 flex-1 text-right min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={14} className="text-red-400" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#2D2926] truncate">{label}</p>
                    <p className="text-[11px] text-[#9D8F85] truncate mt-0.5 font-medium">
                      {r.observer || '—'} · {r.center || '—'}
                    </p>
                  </div>
                  {/* Severity badge */}
                  {sv && (
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold border flex-shrink-0"
                      style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                      {sv.label}
                    </span>
                  )}
                  {/* Time */}
                  <div className="flex-shrink-0 text-left space-y-0.5">
                    <p className="text-[11px] text-[#9D8F85] font-medium">{timeAgo(r.timestamp)}</p>
                    <p className="text-[11px] font-bold text-[#A98159]">{clockTime(r.timestamp)}</p>
                  </div>
                </button>
                {/* Status select — inline */}
                <select
                  value={r.status || 'pending'}
                  onChange={e => { e.stopPropagation(); handleStatusChange(r.id, e.target.value); }}
                  onClick={e => e.stopPropagation()}
                  className="text-[11px] font-bold border rounded-xl px-2 py-1.5 outline-none cursor-pointer flex-shrink-0 transition-all"
                  style={{ background: sb.bg, borderColor: sb.border, color: sb.text }}>
                  {Object.entries(STATUS).map(([k, s]) =>
                    <option key={k} value={k}>{s.label}</option>
                  )}
                </select>
                {/* Delete */}
                <button onClick={() => handleDeleteReport(r.id)}
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-xl hover:bg-red-50 flex items-center justify-center text-[#C9B8A8] hover:text-red-500 transition-all flex-shrink-0">
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Other field activities ── */}
      {otherFeed.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EDE5DC]"
            style={{ background: 'linear-gradient(135deg, #FDF8F0 0%, #fff 55%)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}>
              <ClipboardList size={16} className="text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-bold text-[#2D2926] text-sm">النشاطات الميدانية</h2>
              <p className="text-[11px] text-[#9D8F85] mt-0.5 font-medium">تقييمات وطلبات إسناد حديثة</p>
            </div>
          </div>

          {/* Rows */}
          {otherFeed.slice(0, 6).map((item, i) => {
            const isLogistics = item._col === 'logistics';
            const isMina      = item._col === 'mina';
            const isReadiness = !isLogistics;

            const score = item.scoreOutOf10 ?? (
              item.maxScore > 0
                ? parseFloat(((item.totalScore / item.maxScore) * 10).toFixed(1))
                : null
            );
            const scoreSt = score == null ? null
              : score >= 8 ? { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' }
              : score >= 5 ? { bg: '#FFFBEB', text: '#B45309', border: '#FCD34D' }
              :              { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' };

            const isLast = i === Math.min(otherFeed.length, 6) - 1;

            return (
              <button key={i}
                onClick={() => navigate(isLogistics ? '/admin/logistics' : '/admin/analytics')}
                className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-[#FDFAF7] transition-colors text-right ${!isLast ? 'border-b border-[#EDE5DC]' : ''}`}>
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isLogistics ? 'bg-blue-50' : isMina ? 'bg-green-50' : 'bg-cyan-50'
                }`}>
                  {isLogistics
                    ? <Truck    size={14} className="text-blue-400"  strokeWidth={1.5} />
                    : <Mountain size={14} className={isMina ? 'text-green-500' : 'text-cyan-500'} strokeWidth={1.5} />
                  }
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2D2926] truncate">
                    {isLogistics
                      ? `طلب إسناد ${SUPPORT[item.supportType] || ''}`.trim()
                      : isMina ? 'جاهزية مشعر منى' : 'جاهزية مشعر عرفة'}
                  </p>
                  <p className="text-[11px] text-[#9D8F85] truncate mt-0.5 font-medium">
                    {item.observer || '—'} · {item.center || '—'}
                  </p>
                </div>
                {/* Score badge */}
                {isReadiness && scoreSt && score != null && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold border flex-shrink-0"
                    style={{ background: scoreSt.bg, color: scoreSt.text, borderColor: scoreSt.border }}>
                    {score.toFixed(1)} / 10
                  </span>
                )}
                {/* Time */}
                <p className="text-[11px] text-[#9D8F85] flex-shrink-0 font-medium">{timeAgo(item.timestamp)}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onDelete={handleDeleteReport}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
