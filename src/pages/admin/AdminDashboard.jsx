import { useEffect, useState } from 'react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import {
  AlertTriangle, Truck, TrendingUp,
  ArrowLeft, Mountain, ClipboardList, X, Trash2, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCaterer } from '../../config/centers.js';

/* ── helpers ── */
const REPORT_TYPE_LABELS = {
  water:    { label: 'تسرب مياه',        icon: '💧' },
  electric: { label: 'عطل كهربائي',       icon: '⚡' },
  crowd:    { label: 'ازدحام حرج',        icon: '👥' },
  food:     { label: 'مشكلة غذائية',      icon: '🍽️' },
  medical:  { label: 'حالة طبية طارئة',   icon: '🚑' },
  security: { label: 'بلاغ أمني',         icon: '🛡️' },
  fire:     { label: 'حريق / دخان',       icon: '🔥' },
  other:    { label: 'بلاغ آخر',          icon: '📋' },
  /* legacy types */
  shortage: { label: 'نقص في الكميات',    icon: '📦' },
  delay:    { label: 'تأخر في التوزيع',   icon: '⏱️' },
  quality:  { label: 'مشكلة في الجودة',   icon: '⭐' },
  hygiene:  { label: 'مخالفة صحية',       icon: '🌡️' },
};

const SEVERITY = {
  high:   { label: 'عالية',   bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', dot: '#DC2626' },
  medium: { label: 'متوسطة',  bg: '#FEF3C7', border: '#FDE68A', text: '#92400E', dot: '#D97706' },
  low:    { label: 'منخفضة',  bg: '#DBEAFE', border: '#BFDBFE', text: '#1E40AF', dot: '#3B82F6' },
  urgent: { label: 'عاجل',    bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', dot: '#DC2626' },
};

const STATUS_BADGE = {
  pending:     { label: 'قيد الانتظار', cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'جارٍ التنفيذ',  cls: 'bg-blue-100   text-blue-700'   },
  resolved:    { label: 'تم الحل',       cls: 'bg-green-100  text-green-700'  },
};

const SUPPORT_LABELS = { internal: 'داخلي', external: 'خارجي', both: 'داخلي وخارجي' };

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)    return 'الآن';
  if (s < 3600)  return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  return `منذ ${Math.floor(s / 86400)} يوم`;
}

function exactTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function openImageTab(src) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>صورة البلاغ</title>
    <style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head>
    <body><img src="${src}" /></body></html>`);
  win.document.close();
}

/* ── StatCard ── */
const StatCard = ({ label, value, icon: Icon, color, sub, onClick }) => (
  <button onClick={onClick}
    className="bg-white rounded-3xl p-4 border border-[#D1C4B9] shadow-sm flex items-center gap-3 text-right w-full hover:shadow-md hover:border-[#A98159]/40 transition-all active:scale-[0.98]">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
      <Icon size={20} style={{ color }} strokeWidth={1.5} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[#6D6E71] text-xs">{label}</p>
      <p className="text-xl font-bold text-[#2D2926]">{value ?? '—'}</p>
      {sub && <p className="text-[10px] text-[#6D6E71]">{sub}</p>}
    </div>
    <ArrowLeft size={14} className="text-[#D1C4B9] flex-shrink-0" />
  </button>
);

/* ── ReportDetailModal ── */
function ReportDetailModal({ report, onClose, onDelete }) {
  if (!report) return null;
  const rt = REPORT_TYPE_LABELS[report.reportType || report.type] || { label: 'بلاغ', icon: '📋' };
  const sv = SEVERITY[report.severity] || SEVERITY.low;
  const sb = STATUS_BADGE[report.status] || STATUS_BADGE.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Modal header */}
        <div className="sticky top-0 bg-white border-b border-[#D1C4B9] px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{rt.icon}</span>
            <div>
              <p className="font-bold text-[#2D2926]">{rt.label}</p>
              <p className="text-xs text-[#6D6E71]">{timeAgo(report.timestamp)} · {exactTime(report.timestamp)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onDelete(report.id)} className="w-8 h-8 rounded-xl border border-red-200 flex items-center justify-center hover:bg-red-50 transition text-red-400 hover:text-red-600">
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl border border-[#D1C4B9] flex items-center justify-center hover:bg-gray-50 transition">
              <X size={16} className="text-[#6D6E71]" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold border"
              style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
              <span className="inline-block w-2 h-2 rounded-full ml-1.5" style={{ background: sv.dot }} />
              خطورة {sv.label}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${sb.cls}`}>{sb.label}</span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: 'المراقب',     val: report.observer },
              { label: 'المركز',      val: report.center   },
              { label: 'نوع البلاغ',  val: rt.label        },
              { label: 'وقت الإرسال', val: exactTime(report.timestamp) },
            ].map(c => (
              <div key={c.label} className="bg-[#FDFCFB] rounded-xl border border-[#D1C4B9] p-3">
                <p className="text-[#6D6E71] mb-0.5">{c.label}</p>
                <p className="font-bold text-[#2D2926]">{c.val || '—'}</p>
              </div>
            ))}
            <div className="col-span-2 bg-[#FDF8F0] rounded-xl border border-[#D1C4B9] p-3">
              <p className="text-[#6D6E71] mb-0.5">المتعهد</p>
              <p className="font-bold text-[#A98159]">
                {report.caterer || getCaterer(report.center) || '—'}
              </p>
            </div>
          </div>

          {/* Description */}
          {report.description && (
            <div className="bg-[#FDFCFB] rounded-xl border border-[#D1C4B9] p-4">
              <p className="text-xs text-[#6D6E71] mb-1.5 font-medium">وصف المشكلة</p>
              <p className="text-sm text-[#2D2926] leading-relaxed">{report.description}</p>
            </div>
          )}

          {/* Images */}
          {report.images?.length > 0 && (
            <div>
              <p className="text-xs text-[#6D6E71] font-medium mb-2">الصور المرفقة ({report.images.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {report.images.map((src, i) => (
                  <button key={i} onClick={() => openImageTab(src)} className="group relative block w-full">
                    <img src={src} alt="" className="w-full h-32 object-cover rounded-xl border border-[#D1C4B9]" />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40 rounded-xl text-white text-xs font-bold">
                      🔍 فتح الصورة
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {report.videos?.length > 0 && (
            <div className="bg-[#FDFCFB] rounded-xl border border-[#D1C4B9] p-3">
              <p className="text-xs text-[#6D6E71] mb-1.5 font-medium">مقاطع الفيديو ({report.videos.length})</p>
              {report.videos.map((name, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[#2D2926]">
                  <span>🎥</span><span>{name}</span>
                </div>
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
  const [counts,       setCounts]       = useState({ reports: 0, evals: 0, logistics: 0, mina: 0, arafat: 0 });
  const [reports,      setReports]      = useState([]);
  const [otherFeed,    setOtherFeed]    = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [clock,        setClock]        = useState({ hijri: '', time: '' });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({
        hijri: now.toLocaleDateString('ar-SA-u-ca-islamic', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time:  now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleDeleteReport = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا البلاغ؟')) return;
    await deleteDoc(doc(db, 'reports', id));
    setSelectedReport(null);
  };

  useEffect(() => {
    const sortByTime = (arr) => [...arr].sort((a, b) => {
      const ta = a.timestamp?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const tb = b.timestamp?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

    const unsubs = [
      onSnapshot(collection(db, 'reports'), s => {
        setCounts(p => ({ ...p, reports: s.size }));
        setReports(sortByTime(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      }),
      onSnapshot(collection(db, 'meal_evaluations'),  s => setCounts(p => ({ ...p, evals:     s.size }))),
      onSnapshot(collection(db, 'logistics_requests'),s => {
        setCounts(p => ({ ...p, logistics: s.size }));
        const items = sortByTime(s.docs.map(d => ({ id: d.id, ...d.data(), _col: 'logistics' })));
        setOtherFeed(prev => {
          const filtered = prev.filter(i => i._col !== 'logistics');
          return sortByTime([...filtered, ...items.slice(0, 3)]);
        });
      }),
      onSnapshot(collection(db, 'mina_readiness'),   s => {
        setCounts(p => ({ ...p, mina: s.size }));
        const items = sortByTime(s.docs.map(d => ({ id: d.id, ...d.data(), _col: 'mina' })));
        setOtherFeed(prev => {
          const filtered = prev.filter(i => i._col !== 'mina');
          return sortByTime([...filtered, ...items.slice(0, 3)]);
        });
      }),
      onSnapshot(collection(db, 'arafat_readiness'), s => {
        setCounts(p => ({ ...p, arafat: s.size }));
        const items = sortByTime(s.docs.map(d => ({ id: d.id, ...d.data(), _col: 'arafat' })));
        setOtherFeed(prev => {
          const filtered = prev.filter(i => i._col !== 'arafat');
          return sortByTime([...filtered, ...items.slice(0, 3)]);
        });
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const STAT_CARDS = [
    { label: 'البلاغات الميدانية',  value: counts.reports,   icon: AlertTriangle,  color: '#BA1A1A', sub: 'بلاغات طارئة',    nav: '/admin/reports'   },
    { label: 'التقييمات',            value: counts.evals,     icon: ClipboardList,  color: '#A98159', sub: 'جودة الوجبات',    nav: '/admin/analytics' },
    { label: 'طلبات الإسناد',        value: counts.logistics, icon: Truck,          color: '#1D6FA4', sub: 'طلبات لوجستية',  nav: '/admin/logistics' },
    { label: 'جاهزية منى',          value: counts.mina,      icon: Mountain,       color: '#386B41', sub: 'تقييمات منى',     nav: '/admin/analytics' },
    { label: 'جاهزية عرفة',         value: counts.arafat,    icon: Mountain,       color: '#1D6FA4', sub: 'تقييمات عرفة',    nav: '/admin/analytics' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#2D2926]">نظرة عامة على العمليات</h1>
          <p className="text-sm text-[#6D6E71] mt-0.5">مؤشرات الأداء الحية — موسم الحج ١٤٤٧ هـ</p>
        </div>
        {/* Hijri clock */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-[#2D2926] to-[#3D3330] rounded-3xl px-4 py-3 shadow-sm flex-shrink-0">
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
            <Clock size={16} className="text-[#A98159]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-white/40 text-[10px] leading-none mb-0.5">التاريخ الهجري</p>
            <p className="text-white text-xs font-bold leading-tight">{clock.hijri}</p>
          </div>
          <div className="border-r border-white/10 h-8 mx-1" />
          <div className="text-left">
            <p className="text-white/40 text-[10px] leading-none mb-0.5">الوقت</p>
            <p className="text-[#A98159] text-sm font-bold tabular-nums leading-tight">{clock.time}</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {STAT_CARDS.map(c => <StatCard key={c.label} {...c} onClick={() => navigate(c.nav)} />)}
      </div>

      {/* ── قسم البلاغات الميدانية ── */}
      <div className="bg-white rounded-3xl border border-[#D1C4B9] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D1C4B9]"
          style={{ background: 'linear-gradient(135deg,#FEF2F2,#FFF)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-[#2D2926]">البلاغات الميدانية</h2>
              <p className="text-xs text-[#6D6E71]">تحديث فوري — اضغط لعرض التفاصيل</p>
            </div>
          </div>
          <button onClick={() => navigate('/admin/reports')}
            className="flex items-center gap-1 text-xs font-bold text-red-600 hover:underline">
            عرض الكل <ArrowLeft size={12} />
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="py-10 text-center text-[#6D6E71] text-sm">لا توجد بلاغات بعد</div>
        ) : (
          <div className="divide-y divide-[#D1C4B9]/40">
            {reports.slice(0, 6).map(r => {
              const rt = REPORT_TYPE_LABELS[r.reportType || r.type] || { label: 'بلاغ', icon: '📋' };
              const sv = SEVERITY[r.severity];
              const sb = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
              return (
                <div key={r.id} className="group flex items-start gap-3 px-5 py-3.5 hover:bg-red-50/40 transition-colors">
                <button onClick={() => setSelectedReport(r)} className="flex items-start gap-3 flex-1 text-right min-w-0">
                  <span className="text-2xl mt-0.5 flex-shrink-0">{rt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-bold text-[#2D2926]">{rt.label}</span>
                      {sv && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                          {sv.label}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sb.cls}`}>{sb.label}</span>
                    </div>
                    <p className="text-xs text-[#6D6E71] truncate">
                      {r.observer || '—'} · {r.center || '—'}
                    </p>
                    <p className="text-[10px] text-[#A98159] font-medium truncate">
                      🏭 {r.caterer || getCaterer(r.center) || '—'}
                    </p>
                    {r.description && (
                      <p className="text-xs text-[#2D2926]/60 truncate mt-0.5">{r.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-left">
                    <p className="text-[10px] text-[#6D6E71]">{timeAgo(r.timestamp)}</p>
                    <p className="text-[10px] text-[#A98159] font-bold">{exactTime(r.timestamp)}</p>
                    {r.images?.length > 0 && (
                      <p className="text-[10px] text-[#6D6E71] mt-0.5">📷 {r.images.length}</p>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteReport(r.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 text-[#D1C4B9] hover:text-red-500 transition-all flex-shrink-0 self-center"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── نشاطات أخرى ── */}
      {otherFeed.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#D1C4B9] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D1C4B9]">
            <h2 className="font-bold text-[#2D2926]">نشاطات ميدانية أخرى</h2>
            <p className="text-xs text-[#6D6E71]">تقييمات وطلبات إسناد حديثة</p>
          </div>
          <div className="divide-y divide-[#D1C4B9]/40">
            {otherFeed.slice(0, 6).map((item, i) => {
              const isLogistics = item._col === 'logistics';
              const isMina      = item._col === 'mina';
              const isReadiness = isMina || item._col === 'arafat';

              /* score badge color */
              const score = item.scoreOutOf10 ?? (
                item.maxScore > 0
                  ? parseFloat(((item.totalScore / item.maxScore) * 10).toFixed(2))
                  : null
              );
              const scoreBadge = score == null ? null
                : score >= 8   ? { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' }
                : score >= 5   ? { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' }
                :                { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };

              return (
                <button key={i} onClick={() => navigate(isLogistics ? '/admin/logistics' : '/admin/analytics')}
                  className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-[#FDFCFB] transition-colors text-right">
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {isLogistics ? '🚛' : isMina ? '⛺' : '🏔️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-bold text-[#2D2926]">
                        {isLogistics
                          ? `طلب إسناد ${SUPPORT_LABELS[item.supportType] || ''}`
                          : isMina ? 'جاهزية مشعر منى' : 'جاهزية مشعر عرفة'}
                      </p>
                      {isReadiness && scoreBadge && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: scoreBadge.bg, color: scoreBadge.text, borderColor: scoreBadge.border }}>
                          {score.toFixed(1)} / 10
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#6D6E71] mb-0.5">
                      <span className="font-medium text-[#2D2926]">{item.observer || '—'}</span>
                      <span>·</span>
                      <span>{item.center || '—'}</span>
                    </div>
                    <p className="text-[10px] text-[#A98159] font-medium truncate">
                      🏭 {item.caterer || getCaterer(item.center) || '—'}
                    </p>
                  </div>
                  <p className="text-[10px] text-[#6D6E71] flex-shrink-0 mt-0.5">{timeAgo(item.timestamp)}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'البلاغات الميدانية', nav: '/admin/reports',   color: '#BA1A1A', icon: AlertTriangle },
          { label: 'الإسناد اللوجستي',   nav: '/admin/logistics', color: '#1D6FA4', icon: Truck        },
          { label: 'التقييمات',           nav: '/admin/analytics', color: '#A98159', icon: ClipboardList },
          { label: 'تقييمات الجاهزية',   nav: '/admin/analytics', color: '#386B41', icon: TrendingUp   },
        ].map(b => (
          <button key={b.label} onClick={() => navigate(b.nav)}
            className="bg-white rounded-3xl p-4 border border-[#D1C4B9] shadow-sm hover:shadow-md hover:border-[#A98159]/40 transition-all flex items-center gap-2.5 active:scale-[0.97]">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${b.color}15` }}>
              <b.icon size={16} style={{ color: b.color }} />
            </div>
            <span className="text-xs font-bold text-[#2D2926]">{b.label}</span>
          </button>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onDelete={handleDeleteReport}
        />
      )}
    </div>
  );
}
