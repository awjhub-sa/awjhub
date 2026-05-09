import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import {
  AlertTriangle, ChevronDown, ChevronUp,
  Pencil, Trash2, X, Save, ImageIcon, Video,
  User, Building2, Clock, ShieldAlert,
} from 'lucide-react';
import { getCaterer } from '../../config/centers.js';

/* ── helpers ── */
function openImageTab(src) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>صورة البلاغ</title>
    <style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head>
    <body><img src="${src}"/></body></html>`);
  win.document.close();
}

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
  return (ts.toDate ? ts.toDate() : new Date(ts))
    .toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

/* ── constants ── */
const STATUS_OPTIONS = [
  { value: 'pending',     label: 'قيد الانتظار', cls: 'bg-amber-50   text-amber-700   border-amber-200'  },
  { value: 'in_progress', label: 'جارٍ التنفيذ',  cls: 'bg-blue-50    text-blue-700    border-blue-200'   },
  { value: 'resolved',    label: 'تم الحل',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200'},
];

const SEVERITY_MAP = {
  high:   { label: 'عالية',   bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', bar: '#EF4444' },
  urgent: { label: 'عاجل',    bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', bar: '#DC2626' },
  medium: { label: 'متوسطة',  bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', bar: '#F59E0B' },
  low:    { label: 'منخفضة',  bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', bar: '#3B82F6' },
};

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

const getRT  = r => REPORT_TYPE_MAP[r.reportType] || REPORT_TYPE_MAP[r.type] || { label: r.reportType || 'بلاغ', icon: '📋' };
const getSV  = r => SEVERITY_MAP[r.severity] || null;
const getSB  = r => STATUS_OPTIONS.find(s => s.value === r.status) || STATUS_OPTIONS[0];

/* ── Edit Modal ── */
function EditModal({ report, onClose, onSave }) {
  const [form, setForm] = useState({
    status:      report.status      || 'pending',
    severity:    report.severity    || '',
    description: report.description || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(report.id, form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE8E3]"
          style={{ background: 'linear-gradient(135deg,#FDFCFB,#FDF8F0)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#A98159]/10 flex items-center justify-center">
              <Pencil size={15} className="text-[#A98159]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-bold text-[#2D2926] text-sm">تعديل البلاغ</p>
              <p className="text-[10px] text-[#6D6E71]">{getRT(report).icon} {getRT(report).label}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl border border-[#E8DDD4] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors">
            <X size={15} className="text-[#6D6E71]" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Observer info (read-only) */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'المراقب', val: report.observer, icon: User },
              { label: 'المركز',  val: report.center,   icon: Building2 },
            ].map(c => (
              <div key={c.label} className="bg-[#FDFCFB] rounded-2xl border border-[#EDE8E3] px-3 py-2.5">
                <p className="text-[10px] text-[#6D6E71] mb-0.5">{c.label}</p>
                <p className="text-xs font-bold text-[#2D2926] truncate">{c.val || '—'}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#FDF8F0] rounded-2xl border border-[#E8DDD4] px-3 py-2.5">
            <p className="text-[10px] text-[#6D6E71] mb-0.5">المتعهد</p>
            <p className="text-xs font-bold text-[#A98159]">{report.caterer || getCaterer(report.center) || '—'}</p>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-bold text-[#2D2926] mb-2 block">حالة البلاغ</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  className={`py-2.5 rounded-2xl text-xs font-bold border transition-all ${
                    form.status === s.value ? s.cls + ' shadow-sm' : 'bg-white text-[#6D6E71] border-[#E8DDD4]'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-xs font-bold text-[#2D2926] mb-2 block">مستوى الخطورة</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(SEVERITY_MAP).map(([key, sv]) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, severity: key }))}
                  className={`py-2.5 rounded-2xl text-xs font-bold border transition-all ${
                    form.severity === key ? '' : 'bg-white text-[#6D6E71] border-[#E8DDD4]'
                  }`}
                  style={form.severity === key ? { background: sv.bg, borderColor: sv.border, color: sv.text } : {}}>
                  {sv.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-[#2D2926] mb-2 block">وصف المشكلة</label>
            <textarea rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-4 py-3 border border-[#E8DDD4] rounded-2xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition-colors resize-none bg-[#FDFCFB]"
              placeholder="وصف المشكلة أو الملاحظات..." />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold border border-[#E8DDD4] text-[#6D6E71] hover:bg-[#F5F0EB] transition-colors">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-bold bg-[#A98159] text-white flex items-center justify-center gap-2 hover:bg-[#8E6B48] transition-colors disabled:opacity-60">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={15} strokeWidth={1.75} />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function AdminReports() {
  const [reports,       setReports]       = useState([]);
  const [filter,        setFilter]        = useState('all');
  const [expanded,      setExpanded]      = useState(null);
  const [editingReport, setEditingReport] = useState(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'reports'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) =>
        (b.timestamp?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0) -
        (a.timestamp?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
      );
      setReports(docs);
    });
  }, []);

  const handleStatus = async (id, status) =>
    updateDoc(doc(db, 'reports', id), { status });

  const handleSaveEdit = async (id, form) =>
    updateDoc(doc(db, 'reports', id), {
      status:      form.status,
      ...(form.severity    && { severity:    form.severity    }),
      ...(form.description && { description: form.description }),
    });

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا البلاغ؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    await deleteDoc(doc(db, 'reports', id));
    if (expanded === id) setExpanded(null);
  };

  const filtered = filter === 'all' ? reports
    : reports.filter(r => r.status === filter || (!r.status && filter === 'pending'));

  const countOf = v => reports.filter(r => r.status === v || (!r.status && v === 'pending')).length;

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2D2926]">البلاغات الميدانية</h1>
          <p className="text-sm text-[#6D6E71] mt-0.5">{reports.length} بلاغ إجمالاً · تحديث فوري</p>
        </div>
        <div className="flex items-center gap-2">
          {['pending','in_progress','resolved'].map(v => {
            const s = STATUS_OPTIONS.find(o => o.value === v);
            const n = countOf(v);
            return n > 0 ? (
              <span key={v} className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${s.cls}`}>
                {n} {s.label}
              </span>
            ) : null;
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: 'all', label: 'الكل', count: reports.length }, ...STATUS_OPTIONS.map(s => ({ ...s, count: countOf(s.value) }))].map(opt => (
          <button key={opt.value} onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold border transition-all ${
              filter === opt.value
                ? 'bg-[#2D2926] text-white border-[#2D2926]'
                : 'bg-white text-[#6D6E71] border-[#E8DDD4] hover:border-[#A98159] hover:text-[#A98159]'
            }`}>
            {opt.label}
            <span className={`mr-1.5 ${filter === opt.value ? 'opacity-60' : 'opacity-50'}`}>({opt.count})</span>
          </button>
        ))}
      </div>

      {/* Reports list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#E8DDD4] py-20 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F0EB] flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} className="text-[#D1C4B9]" strokeWidth={1.5} />
            </div>
            <p className="text-[#6D6E71] text-sm font-medium">لا توجد بلاغات في هذه الفئة</p>
          </div>
        ) : filtered.map(r => {
          const rt     = getRT(r);
          const sv     = getSV(r);
          const b      = getSB(r);
          const isOpen = expanded === r.id;
          const allImages = r.images?.length ? r.images : (r.photos?.length ? r.photos : []);

          return (
            <div key={r.id}
              className="bg-white rounded-3xl border border-[#E8DDD4] shadow-[0_2px_20px_rgba(45,41,38,0.06)] overflow-hidden transition-shadow hover:shadow-[0_4px_28px_rgba(45,41,38,0.1)]">

              {/* Severity color strip */}
              {sv && <div className="h-1 w-full" style={{ background: sv.bar }} />}

              {/* Card header */}
              <div className="px-5 py-4 flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
                  style={{ background: sv ? sv.bg : '#F5F0EB' }}>
                  {rt.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-bold text-[#2D2926] text-sm">{rt.label}</span>
                    {sv && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                        style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                        {sv.label}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${b.cls}`}>
                      {b.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#6D6E71] flex-wrap">
                    <span className="flex items-center gap-1">
                      <User size={11} strokeWidth={1.5} /> {r.observer || '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 size={11} strokeWidth={1.5} /> {r.center || '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} strokeWidth={1.5} /> {timeAgo(r.timestamp)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#A98159] font-semibold mt-0.5">
                    🏭 {r.caterer || getCaterer(r.center) || '—'}
                  </p>

                  {!isOpen && r.description && (
                    <p className="text-xs text-[#6D6E71] mt-1.5 line-clamp-1">{r.description}</p>
                  )}

                  {!isOpen && (allImages.length > 0 || r.videos?.length > 0) && (
                    <div className="flex gap-1.5 mt-1.5">
                      {allImages.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] bg-[#F5F0EB] text-[#A98159] font-bold px-2 py-0.5 rounded-full">
                          <ImageIcon size={9} strokeWidth={2} /> {allImages.length}
                        </span>
                      )}
                      {r.videos?.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] bg-[#F5F0EB] text-[#A98159] font-bold px-2 py-0.5 rounded-full">
                          <Video size={9} strokeWidth={2} /> {r.videos.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <select value={r.status || 'pending'}
                    onChange={e => handleStatus(r.id, e.target.value)}
                    className={`text-[10px] font-bold border rounded-xl px-2 py-1 outline-none cursor-pointer ${b.cls}`}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="flex items-center gap-1 text-[#A98159] text-xs font-bold">
                    {isOpen
                      ? <><ChevronUp size={13} strokeWidth={1.75} /> إخفاء</>
                      : <><ChevronDown size={13} strokeWidth={1.75} /> التفاصيل</>}
                  </button>
                </div>
              </div>

              {/* Expanded section */}
              {isOpen && (
                <div className="border-t border-[#EDE8E3] bg-[#FDFCFB] px-5 py-4 space-y-4">

                  {/* Info grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    {[
                      { label: 'اسم المراقب',   val: r.observer },
                      { label: 'المركز / المسكن', val: r.center   },
                      { label: 'وقت الإرسال',    val: fullDate(r.timestamp) },
                      { label: 'نوع البلاغ',     val: `${rt.icon} ${rt.label}` },
                    ].map(c => (
                      <div key={c.label} className="bg-white rounded-2xl border border-[#EDE8E3] px-3 py-2.5">
                        <p className="text-[#6D6E71] text-[10px] mb-0.5">{c.label}</p>
                        <p className="font-bold text-[#2D2926]">{c.val || '—'}</p>
                      </div>
                    ))}
                    <div className="bg-[#FDF8F0] rounded-2xl border border-[#E8DDD4] px-3 py-2.5 col-span-2 sm:col-span-1">
                      <p className="text-[#6D6E71] text-[10px] mb-0.5">المتعهد</p>
                      <p className="font-bold text-[#A98159] text-[10px] leading-snug">
                        {r.caterer || getCaterer(r.center) || '—'}
                      </p>
                    </div>
                    {sv && (
                      <div className="bg-white rounded-2xl border border-[#EDE8E3] px-3 py-2.5">
                        <p className="text-[#6D6E71] text-[10px] mb-0.5">مستوى الخطورة</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: sv.bg, borderColor: sv.border, color: sv.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sv.bar }} />
                          {sv.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {r.description && (
                    <div className="bg-white rounded-2xl border border-[#EDE8E3] px-4 py-3">
                      <p className="text-[10px] text-[#6D6E71] font-semibold mb-1.5 flex items-center gap-1">
                        <ShieldAlert size={11} strokeWidth={1.75} /> وصف المشكلة
                      </p>
                      <p className="text-sm text-[#2D2926] leading-relaxed">{r.description}</p>
                    </div>
                  )}

                  {/* Images */}
                  {allImages.length > 0 && (
                    <div>
                      <p className="text-[10px] text-[#6D6E71] font-semibold mb-2 flex items-center gap-1">
                        <ImageIcon size={11} strokeWidth={1.75} /> الصور المرفقة ({allImages.length})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {allImages.map((src, i) =>
                          src.startsWith('http') || src.startsWith('data:') ? (
                            <button key={i} onClick={() => openImageTab(src)} className="group relative block">
                              <img src={src} alt="" className="w-full h-28 object-cover rounded-2xl border border-[#EDE8E3]" />
                              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40 rounded-2xl text-white text-xs font-bold">
                                🔍 فتح
                              </span>
                            </button>
                          ) : (
                            <span key={i} className="bg-[#F5F0EB] border border-[#EDE8E3] rounded-2xl px-3 py-2 text-xs text-[#2D2926]">
                              📎 {src}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Videos */}
                  {r.videos?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-[#6D6E71] font-semibold mb-2 flex items-center gap-1">
                        <Video size={11} strokeWidth={1.75} /> مقاطع الفيديو ({r.videos.length})
                      </p>
                      <div className="space-y-1.5">
                        {r.videos.map((name, i) => (
                          <div key={i} className="flex items-center gap-2 bg-[#F5F0EB] rounded-xl px-3 py-2 text-xs text-[#2D2926]">
                            🎥 <span className="font-medium">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#EDE8E3]">
                    <div className="flex gap-2">
                      <button onClick={() => setEditingReport(r)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-[#FDF8F0] text-[#A98159] border border-[#E8DDD4] hover:bg-[#A98159] hover:text-white transition-all">
                        <Pencil size={13} strokeWidth={1.75} /> تعديل
                      </button>
                      <button onClick={() => handleDelete(r.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-red-50 text-red-500 border border-red-200 hover:bg-red-500 hover:text-white transition-all">
                        <Trash2 size={13} strokeWidth={1.75} /> حذف
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#6D6E71]">الحالة:</span>
                      <select value={r.status || 'pending'}
                        onChange={e => handleStatus(r.id, e.target.value)}
                        className={`text-xs font-bold border rounded-xl px-3 py-1.5 outline-none cursor-pointer ${b.cls}`}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingReport && (
        <EditModal
          report={editingReport}
          onClose={() => setEditingReport(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
