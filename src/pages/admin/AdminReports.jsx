import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { getCaterer } from '../../config/centers.js';

/* ── فتح الصورة في تبويب جديد ── */
function openImageTab(src) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>صورة البلاغ</title>
    <style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head>
    <body><img src="${src}" /></body></html>`);
  win.document.close();
}

/* ── ثوابت ── */
const STATUS_OPTIONS = [
  { value: 'pending',     label: 'قيد الانتظار', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'in_progress', label: 'جارٍ التنفيذ',  cls: 'bg-blue-100   text-blue-700   border-blue-200'   },
  { value: 'resolved',    label: 'تم الحل',       cls: 'bg-green-100  text-green-700  border-green-200'  },
];

const SEVERITY_MAP = {
  high:   { label: 'عالية',   bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', dot: '#DC2626' },
  medium: { label: 'متوسطة',  bg: '#FEF3C7', border: '#FDE68A', text: '#92400E', dot: '#D97706' },
  low:    { label: 'منخفضة',  bg: '#DBEAFE', border: '#BFDBFE', text: '#1E40AF', dot: '#3B82F6' },
  urgent: { label: 'عاجل',    bg: '#FEE2E2', border: '#FECACA', text: '#991B1B', dot: '#DC2626' },
};

/* أنواع البلاغات — الجديدة والقديمة */
const REPORT_TYPE_MAP = {
  water:    { label: 'تسرب مياه',        icon: '💧' },
  electric: { label: 'عطل كهربائي',       icon: '⚡' },
  crowd:    { label: 'ازدحام حرج',        icon: '👥' },
  food:     { label: 'مشكلة غذائية',      icon: '🍽️' },
  medical:  { label: 'حالة طبية طارئة',   icon: '🚑' },
  security: { label: 'بلاغ أمني',         icon: '🛡️' },
  fire:     { label: 'حريق / دخان',       icon: '🔥' },
  other:    { label: 'بلاغ آخر',          icon: '📋' },
  shortage: { label: 'نقص في الكميات',    icon: '📦' },
  delay:    { label: 'تأخر في التوزيع',   icon: '⏱️' },
  quality:  { label: 'مشكلة في الجودة',   icon: '⭐' },
  hygiene:  { label: 'مخالفة صحية',       icon: '🌡️' },
};

const getReportType = (r) =>
  REPORT_TYPE_MAP[r.reportType] || REPORT_TYPE_MAP[r.type] || { label: r.reportType || r.type || 'بلاغ', icon: '📋' };

const getSeverity = (r) => SEVERITY_MAP[r.severity] || null;
const getStatus   = (r) => STATUS_OPTIONS.find(s => s.value === r.status) || STATUS_OPTIONS[0];

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)    return 'الآن';
  if (s < 3600)  return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  return `منذ ${Math.floor(s / 86400)} يوم`;
}

function fullDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

/* ══════════════════════════════════════════════════════════ */
export default function AdminReports() {
  const [reports,  setReports]  = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.timestamp?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const tb = b.timestamp?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      setReports(docs);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleStatus = async (id, status) => {
    await updateDoc(doc(db, 'reports', id), { status });
  };

  const filtered = filter === 'all' ? reports : reports.filter(r =>
    r.status === filter || (!r.status && filter === 'pending')
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2D2926]">البلاغات الميدانية</h1>
          <p className="text-sm text-[#6D6E71]">{reports.length} بلاغ إجمالاً — تحديث فوري</p>
        </div>
        {loading && <RefreshCw size={18} className="animate-spin text-[#A98159]" />}
      </div>

      {/* فلاتر الحالة */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: 'all', label: 'الكل' }, ...STATUS_OPTIONS].map(opt => (
          <button key={opt.value} onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              filter === opt.value
                ? 'bg-[#A98159] text-white border-[#A98159]'
                : 'bg-white text-[#6D6E71] border-[#D1C4B9] hover:border-[#A98159]'
            }`}>
            {opt.label}
            {opt.value !== 'all' && (
              <span className="mr-1.5 opacity-70">
                ({reports.filter(r => r.status === opt.value || (!r.status && opt.value === 'pending')).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* قائمة البلاغات */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#D1C4B9] py-16 text-center shadow-sm">
            <AlertTriangle size={36} className="mx-auto text-[#D1C4B9] mb-3" />
            <p className="text-[#6D6E71] text-sm">لا توجد بلاغات في هذه الفئة</p>
          </div>
        ) : filtered.map(r => {
          const rt     = getReportType(r);
          const sv     = getSeverity(r);
          const b      = getStatus(r);
          const isOpen = expanded === r.id;
          /* الصور: جديدة (images) أو قديمة (photos) */
          const allImages = r.images?.length ? r.images : (r.photos?.length ? r.photos : []);

          return (
            <div key={r.id} className="bg-white rounded-2xl border border-[#D1C4B9] shadow-sm overflow-hidden">

              {/* شريط خطورة ملوّن */}
              {sv && (
                <div className="h-1 w-full" style={{ background: sv.dot }} />
              )}

              {/* رأس البطاقة */}
              <div className="px-5 py-4 flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{rt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-bold text-[#2D2926] text-sm">{rt.label}</span>
                    {sv && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                        style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full ml-1" style={{ background: sv.dot }} />
                        خطورة {sv.label}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.cls}`}>
                      {b.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#6D6E71]">
                    👤 {r.observer || '—'} · 🏢 {r.center || '—'} · 🕐 {timeAgo(r.timestamp)}
                  </p>
                  <p className="text-[10px] text-[#A98159] font-medium mt-0.5">
                    🏭 {r.caterer || getCaterer(r.center) || '—'}
                  </p>
                  {r.description && !isOpen && (
                    <p className="text-xs text-[#2D2926]/60 mt-1.5 line-clamp-1">{r.description}</p>
                  )}
                  {/* مؤشرات المرفقات */}
                  {(allImages.length > 0 || r.videos?.length > 0) && !isOpen && (
                    <div className="flex gap-2 mt-1.5">
                      {allImages.length > 0 && (
                        <span className="text-[10px] bg-[#F5F0EB] text-[#A98159] font-bold px-2 py-0.5 rounded-full">
                          📷 {allImages.length} صورة
                        </span>
                      )}
                      {r.videos?.length > 0 && (
                        <span className="text-[10px] bg-[#F5F0EB] text-[#A98159] font-bold px-2 py-0.5 rounded-full">
                          🎥 {r.videos.length} فيديو
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <select value={r.status || 'pending'}
                    onChange={e => handleStatus(r.id, e.target.value)}
                    className={`text-xs font-bold border rounded-lg px-2 py-1 outline-none cursor-pointer ${b.cls}`}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="flex items-center gap-1 text-[#A98159] text-xs font-bold hover:underline">
                    {isOpen
                      ? <><ChevronUp size={13} /> إخفاء</>
                      : <><ChevronDown size={13} /> التفاصيل</>}
                  </button>
                </div>
              </div>

              {/* التفاصيل الموسّعة */}
              {isOpen && (
                <div className="border-t border-[#D1C4B9]/60 bg-[#FDFCFB] px-5 py-4 space-y-4">

                  {/* شبكة المعلومات */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                      <p className="text-[#6D6E71] mb-0.5">اسم المراقب</p>
                      <p className="font-bold text-[#2D2926]">{r.observer || '—'}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                      <p className="text-[#6D6E71] mb-0.5">المركز / المسكن</p>
                      <p className="font-bold text-[#2D2926]">{r.center || '—'}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-3 col-span-2 sm:col-span-1">
                      <p className="text-[#6D6E71] mb-0.5">المتعهد</p>
                      <p className="font-bold text-[#A98159] text-xs leading-snug">
                        {r.caterer || getCaterer(r.center) || '—'}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                      <p className="text-[#6D6E71] mb-0.5">نوع البلاغ</p>
                      <p className="font-bold text-[#2D2926]">{rt.icon} {rt.label}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                      <p className="text-[#6D6E71] mb-0.5">مستوى الخطورة</p>
                      {sv ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: sv.dot }} />
                          {sv.label}
                        </span>
                      ) : <p className="font-bold text-[#2D2926]">—</p>}
                    </div>
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                      <p className="text-[#6D6E71] mb-0.5">الحالة</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${b.cls}`}>{b.label}</span>
                    </div>
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                      <p className="text-[#6D6E71] mb-0.5">وقت الإرسال</p>
                      <p className="font-bold text-[#2D2926]">{fullDate(r.timestamp)}</p>
                    </div>
                  </div>

                  {/* وصف المشكلة */}
                  {r.description && (
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-4">
                      <p className="text-xs text-[#6D6E71] mb-2 font-medium">وصف المشكلة</p>
                      <p className="text-sm text-[#2D2926] leading-relaxed">{r.description}</p>
                    </div>
                  )}

                  {/* الصور */}
                  {allImages.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-4">
                      <p className="text-xs text-[#6D6E71] mb-3 font-medium">الصور المرفقة ({allImages.length})</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {allImages.map((src, i) => (
                          (src.startsWith('http') || src.startsWith('data:')) ? (
                            <button key={i} onClick={() => openImageTab(src)} className="group relative block w-full">
                              <img src={src} alt={`صورة ${i + 1}`}
                                className="w-full h-28 object-cover rounded-xl border border-[#D1C4B9]" />
                              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40 rounded-xl text-white text-xs font-bold">
                                🔍 فتح الصورة
                              </span>
                            </button>
                          ) : (
                            <span key={i} className="bg-[#F5F0EB] border border-[#D1C4B9] rounded-xl px-3 py-2 text-xs text-[#2D2926]">
                              📎 {src}
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* الفيديوهات */}
                  {r.videos?.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#D1C4B9] p-4">
                      <p className="text-xs text-[#6D6E71] mb-2 font-medium">مقاطع الفيديو ({r.videos.length})</p>
                      <div className="space-y-1.5">
                        {r.videos.map((name, i) => (
                          <div key={i} className="flex items-center gap-2 bg-[#F5F0EB] rounded-lg px-3 py-2 text-xs text-[#2D2926]">
                            <span>🎥</span>
                            <span className="font-medium">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* تحديث الحالة */}
                  <div className="flex justify-end items-center gap-2">
                    <span className="text-xs text-[#6D6E71]">تحديث الحالة:</span>
                    <select value={r.status || 'pending'}
                      onChange={e => handleStatus(r.id, e.target.value)}
                      className={`text-xs font-bold border rounded-lg px-3 py-1.5 outline-none cursor-pointer ${b.cls}`}>
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
