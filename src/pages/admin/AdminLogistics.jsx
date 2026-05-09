import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import {
  Truck, Package, ChevronDown, ChevronUp,
  Pencil, Trash2, X, Save, User, Building2, Clock,
} from 'lucide-react';
import { getCaterer } from '../../config/centers.js';

/* ── constants ── */
const STATUS_OPTIONS = [
  { value: 'pending',   label: 'قيد الانتظار', cls: 'bg-amber-50   text-amber-700   border-amber-200'   },
  { value: 'approved',  label: 'موافق عليه',   cls: 'bg-blue-50    text-blue-700    border-blue-200'    },
  { value: 'delivered', label: 'تم التسليم',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'rejected',  label: 'مرفوض',        cls: 'bg-red-50     text-red-700     border-red-200'     },
];

const TYPE_LABEL = { internal: 'داخلي', external: 'خارجي', both: 'داخلي وخارجي' };

const SUPPORT_TYPES = [
  { value: 'internal', label: 'داخلي' },
  { value: 'external', label: 'خارجي' },
  { value: 'both',     label: 'داخلي وخارجي' },
];

/* ── helpers ── */
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

/* ── Edit Modal ── */
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE8E3]"
          style={{ background: 'linear-gradient(135deg,#FDFCFB,#F0F7FF)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1D6FA4]/10 flex items-center justify-center">
              <Pencil size={15} className="text-[#1D6FA4]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-bold text-[#2D2926] text-sm">تعديل طلب الإسناد</p>
              <p className="text-[10px] text-[#6D6E71]">{req.observer} · {req.center}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl border border-[#E8DDD4] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors">
            <X size={15} className="text-[#6D6E71]" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Observer info (read-only) */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'المراقب', val: req.observer },
              { label: 'المركز',  val: req.center   },
            ].map(c => (
              <div key={c.label} className="bg-[#FDFCFB] rounded-2xl border border-[#EDE8E3] px-3 py-2.5">
                <p className="text-[10px] text-[#6D6E71] mb-0.5">{c.label}</p>
                <p className="text-xs font-bold text-[#2D2926] truncate">{c.val || '—'}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#FDF8F0] rounded-2xl border border-[#E8DDD4] px-3 py-2.5">
            <p className="text-[10px] text-[#6D6E71] mb-0.5">المتعهد</p>
            <p className="text-xs font-bold text-[#A98159]">{req.caterer || getCaterer(req.center) || '—'}</p>
          </div>

          {/* Support type */}
          <div>
            <label className="text-xs font-bold text-[#2D2926] mb-2 block">نوع الإسناد</label>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORT_TYPES.map(t => (
                <button key={t.value}
                  onClick={() => setForm(f => ({ ...f, supportType: t.value, qtyInternal: '', qtyExternal: '' }))}
                  className={`py-2.5 rounded-2xl text-xs font-bold border transition-all ${
                    form.supportType === t.value
                      ? 'bg-[#1D6FA4] text-white border-[#1D6FA4]'
                      : 'bg-white text-[#6D6E71] border-[#E8DDD4]'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-2 gap-3">
            {showInternal && (
              <div>
                <label className="text-xs font-bold text-[#2D2926] mb-1.5 block">
                  {form.supportType === 'both' ? 'الكمية الداخلية' : 'الكمية'}
                </label>
                <input type="number" min="1" value={form.qtyInternal}
                  onChange={e => setForm(f => ({ ...f, qtyInternal: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#E8DDD4] rounded-2xl text-sm text-[#2D2926] outline-none focus:border-[#1D6FA4] transition-colors bg-[#FDFCFB]"
                  placeholder="0" />
              </div>
            )}
            {showExternal && (
              <div>
                <label className="text-xs font-bold text-[#2D2926] mb-1.5 block">
                  {form.supportType === 'both' ? 'الكمية الخارجية' : 'الكمية'}
                </label>
                <input type="number" min="1" value={form.qtyExternal}
                  onChange={e => setForm(f => ({ ...f, qtyExternal: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#E8DDD4] rounded-2xl text-sm text-[#2D2926] outline-none focus:border-[#1D6FA4] transition-colors bg-[#FDFCFB]"
                  placeholder="0" />
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-bold text-[#2D2926] mb-2 block">حالة الطلب</label>
            <div className="grid grid-cols-2 gap-2">
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

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-[#2D2926] mb-1.5 block">ملاحظات</label>
            <textarea rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-4 py-3 border border-[#E8DDD4] rounded-2xl text-sm text-[#2D2926] outline-none focus:border-[#1D6FA4] transition-colors resize-none bg-[#FDFCFB]"
              placeholder="ملاحظات إضافية..." />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold border border-[#E8DDD4] text-[#6D6E71] hover:bg-[#F5F0EB] transition-colors">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-bold bg-[#1D6FA4] text-white flex items-center justify-center gap-2 hover:bg-[#1a5f8e] transition-colors disabled:opacity-60">
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
export default function AdminLogistics() {
  const [requests,    setRequests]    = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [expanded,    setExpanded]    = useState(null);
  const [editingReq,  setEditingReq]  = useState(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'logistics_requests'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
      setRequests(docs);
    });
  }, []);

  const handleStatus = async (id, status) =>
    updateDoc(doc(db, 'logistics_requests', id), { status });

  const handleSaveEdit = async (id, form) => {
    const data = {
      supportType: form.supportType,
      status:      form.status,
      notes:       form.notes,
    };
    if ((form.supportType === 'internal' || form.supportType === 'both') && form.qtyInternal !== '')
      data.qtyInternal = Number(form.qtyInternal);
    if ((form.supportType === 'external' || form.supportType === 'both') && form.qtyExternal !== '')
      data.qtyExternal = Number(form.qtyExternal);
    await updateDoc(doc(db, 'logistics_requests', id), data);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    await deleteDoc(doc(db, 'logistics_requests', id));
    if (expanded === id) setExpanded(null);
  };

  const filtered  = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pending   = requests.filter(r => !r.status || r.status === 'pending').length;
  const delivered = requests.filter(r => r.status === 'delivered').length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #fff 55%)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #93C5FD, #3182CE)' }}>
            <Truck size={20} className="text-white" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-[#2D2926]">الإسناد اللوجستي</h1>
            <p className="text-xs text-[#9D8F85] mt-0.5">متابعة طلبات التوريد والإسناد الميداني</p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الطلبات', value: requests.length,                                      color: '#A98159' },
          { label: 'قيد الانتظار',   value: pending,                                               color: '#D97706' },
          { label: 'تم التسليم',     value: delivered,                                             color: '#2F855A' },
          { label: 'داخلي وخارجي',  value: requests.filter(r => r.supportType === 'both').length, color: '#3182CE' },
        ].map(c => (
          <div key={c.label}
            className="rounded-2xl p-4 border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] text-center"
            style={{ borderRight: `3px solid ${c.color}`, background: `linear-gradient(145deg, #fff, ${c.color}0A)` }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[#9D8F85] text-xs mt-0.5 font-semibold">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: 'all', label: 'الكل', count: requests.length }, ...STATUS_OPTIONS.map(s => ({ ...s, count: requests.filter(r => r.status === s.value).length }))].map(opt => (
          <button key={opt.value} onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold border transition-all ${
              filter === opt.value
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white text-[#6D6E71] border-[#EDE5DC] hover:border-[#3182CE]/40 hover:text-[#3182CE]'
            }`}
            style={filter === opt.value ? { background: 'linear-gradient(135deg, #3182CE, #2563EB)' } : {}}>
            {opt.label}
            <span className={`mr-1.5 ${filter === opt.value ? 'opacity-70' : 'opacity-50'}`}>({opt.count})</span>
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#EDE5DC] py-20 text-center shadow-[0_2px_12px_rgba(45,41,38,0.06)]">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)' }}>
              <Truck size={24} className="text-blue-300" strokeWidth={1.5} />
            </div>
            <p className="text-[#6D6E71] text-sm font-medium">لا توجد طلبات في هذه الفئة</p>
          </div>
        ) : filtered.map(r => {
          const b      = STATUS_OPTIONS.find(s => s.value === r.status) || STATUS_OPTIONS[0];
          const isOpen = expanded === r.id;
          const qty    = r.supportType === 'both'
            ? `داخلي: ${r.qtyInternal ?? '—'} · خارجي: ${r.qtyExternal ?? '—'}`
            : `الكمية: ${r.qtyInternal ?? r.qtyExternal ?? '—'}`;

          return (
            <div key={r.id}
              className="bg-white rounded-3xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden transition-all hover:shadow-[0_6px_24px_rgba(45,41,38,0.12)] hover:border-[#C9B8A8]">

              {/* Card header */}
              <div className="px-5 py-4 flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #93C5FD28, #3182CE14)' }}>
                  <Package size={18} style={{ color: '#3182CE' }} strokeWidth={1.5} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-bold text-[#2D2926] text-sm">
                      طلب إسناد {TYPE_LABEL[r.supportType] || r.supportType || ''}
                    </span>
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
                  <p className="text-xs text-[#2D2926] font-medium mt-1">{qty}</p>
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

              {/* Expanded */}
              {isOpen && (
                <div className="border-t border-[#EDE8E3] bg-[#FDFCFB] px-5 py-4 space-y-4">

                  {/* Info grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    {[
                      { label: 'اسم المراقب',    val: r.observer },
                      { label: 'المركز / المسكن', val: r.center   },
                      { label: 'نوع الإسناد',     val: TYPE_LABEL[r.supportType] || '—' },
                      { label: 'وقت الإرسال',     val: fullDate(r.timestamp), time: true },
                      ...(r.qtyInternal != null ? [{ label: 'الكمية الداخلية', val: String(r.qtyInternal), blue: true }] : []),
                      ...(r.qtyExternal != null ? [{ label: 'الكمية الخارجية', val: String(r.qtyExternal), blue: true }] : []),
                    ].map(c => (
                      <div key={c.label}
                        className="rounded-2xl border px-3 py-2.5"
                        style={c.time
                          ? { background: '#EFF6FF80', borderColor: '#3182CE40' }
                          : { background: '#fff', borderColor: '#EDE8E3' }}>
                        <p className="text-[#6D6E71] text-[10px] mb-0.5">{c.label}</p>
                        <p className={`font-bold text-[10px] leading-snug ${c.blue ? 'text-base' : ''}`}
                          style={c.time ? { color: '#3182CE' } : c.blue ? { color: '#3182CE' } : { color: '#2D2926' }}>
                          {c.val || '—'}
                        </p>
                      </div>
                    ))}
                    <div className="bg-[#FDF8F0] rounded-2xl border border-[#E8DDD4] px-3 py-2.5 col-span-2 sm:col-span-1">
                      <p className="text-[#6D6E71] text-[10px] mb-0.5">المتعهد</p>
                      <p className="font-bold text-[#A98159] text-[10px] leading-snug">
                        {r.caterer || getCaterer(r.center) || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  {r.notes && (
                    <div className="bg-white rounded-2xl border border-[#EDE8E3] px-4 py-3">
                      <p className="text-[10px] text-[#6D6E71] font-semibold mb-1.5">ملاحظات المراقب</p>
                      <p className="text-sm text-[#2D2926] leading-relaxed">{r.notes}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#EDE8E3]">
                    <div className="flex gap-2">
                      <button onClick={() => setEditingReq(r)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-[#F0F7FF] text-[#1D6FA4] border border-[#BFDBFE] hover:bg-[#1D6FA4] hover:text-white transition-all">
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
