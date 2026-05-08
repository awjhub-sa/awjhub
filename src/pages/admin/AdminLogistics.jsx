import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { Truck, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { getCaterer } from '../../config/centers.js';

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'قيد الانتظار', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'approved',  label: 'موافق عليه',   cls: 'bg-blue-100   text-blue-700   border-blue-200'   },
  { value: 'delivered', label: 'تم التسليم',   cls: 'bg-green-100  text-green-700  border-green-200'  },
  { value: 'rejected',  label: 'مرفوض',        cls: 'bg-red-100    text-red-700    border-red-200'    },
];

const TYPE_LABEL = { internal: 'داخلي', external: 'خارجي', both: 'داخلي وخارجي' };

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

export default function AdminLogistics() {
  const [requests, setRequests] = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    return onSnapshot(collection(db, 'logistics_requests'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.timestamp?.toMillis?.() ?? 0;
        const tb = b.timestamp?.toMillis?.() ?? 0;
        return tb - ta;
      });
      setRequests(docs);
    });
  }, []);

  const handleStatus = async (id, status) => {
    await updateDoc(doc(db, 'logistics_requests', id), { status });
  };

  const filtered  = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pending   = requests.filter(r => !r.status || r.status === 'pending').length;
  const delivered = requests.filter(r => r.status === 'delivered').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#2D2926]">الإسناد اللوجستي</h1>
        <p className="text-sm text-[#6D6E71]">متابعة طلبات التوريد والإسناد الميداني</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الطلبات', value: requests.length,  color: '#A98159' },
          { label: 'قيد الانتظار',   value: pending,          color: '#D97706' },
          { label: 'تم التسليم',     value: delivered,        color: '#386B41' },
          { label: 'داخلي وخارجي',  value: requests.filter(r => r.supportType === 'both').length, color: '#1D6FA4' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] text-center">
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[#6D6E71] text-xs mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: 'all', label: 'الكل' }, ...STATUS_OPTIONS].map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              filter === opt.value
                ? 'bg-[#A98159] text-white border-[#A98159]'
                : 'bg-white text-[#6D6E71] border-[#D1C4B9] hover:border-[#A98159]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#D1C4B9] py-16 text-center shadow-sm">
            <Truck size={36} className="mx-auto text-[#D1C4B9] mb-3" />
            <p className="text-[#6D6E71] text-sm">لا توجد طلبات في هذه الفئة</p>
          </div>
        ) : (
          filtered.map(r => {
            const b      = STATUS_OPTIONS.find(s => s.value === r.status) || STATUS_OPTIONS[0];
            const isOpen = expanded === r.id;
            const qty    = r.supportType === 'both'
              ? `داخلي: ${r.qtyInternal ?? '—'} | خارجي: ${r.qtyExternal ?? '—'}`
              : `الكمية: ${r.qtyInternal ?? r.qtyExternal ?? '—'}`;

            return (
              <div key={r.id} className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] overflow-hidden">

                {/* Summary row */}
                <div className="px-5 py-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1D6FA4]/10 flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-[#1D6FA4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-[#2D2926] text-sm">
                        طلب إسناد {TYPE_LABEL[r.supportType] || r.supportType || ''}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.cls}`}>
                        {b.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#6D6E71]">
                      {r.observer || '—'} · {r.center || '—'} · {timeAgo(r.timestamp)}
                    </p>
                    <p className="text-[10px] text-[#A98159] font-medium mt-0.5">
                      🏭 {r.caterer || getCaterer(r.center) || '—'}
                    </p>
                    <p className="text-xs text-[#2D2926] mt-1 font-medium">{qty}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <select
                      value={r.status || 'pending'}
                      onChange={e => handleStatus(r.id, e.target.value)}
                      className={`text-xs font-bold border rounded-lg px-2 py-1 outline-none cursor-pointer ${b.cls}`}
                    >
                      {STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="flex items-center gap-1 text-[#A98159] text-xs font-bold hover:underline"
                    >
                      {isOpen ? <><ChevronUp size={13} /> إخفاء</> : <><ChevronDown size={13} /> تفاصيل</>}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-[#D1C4B9]/60 bg-[#FDFCFB] px-5 py-4 space-y-3">
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
                        <p className="text-[#6D6E71] mb-0.5">نوع الإسناد</p>
                        <p className="font-bold text-[#2D2926]">{TYPE_LABEL[r.supportType] || '—'}</p>
                      </div>
                      {r.qtyInternal != null && (
                        <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                          <p className="text-[#6D6E71] mb-0.5">الكمية الداخلية</p>
                          <p className="font-bold text-[#1D6FA4] text-base">{r.qtyInternal}</p>
                        </div>
                      )}
                      {r.qtyExternal != null && (
                        <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                          <p className="text-[#6D6E71] mb-0.5">الكمية الخارجية</p>
                          <p className="font-bold text-[#1D6FA4] text-base">{r.qtyExternal}</p>
                        </div>
                      )}
                      <div className="bg-white rounded-xl border border-[#D1C4B9] p-3">
                        <p className="text-[#6D6E71] mb-0.5">تاريخ الطلب</p>
                        <p className="font-bold text-[#2D2926]">{fullDate(r.timestamp)}</p>
                      </div>
                    </div>

                    {r.notes && (
                      <div className="bg-white rounded-xl border border-[#D1C4B9] p-3 text-xs">
                        <p className="text-[#6D6E71] mb-1 font-medium">ملاحظات المراقب</p>
                        <p className="text-[#2D2926] leading-relaxed">{r.notes}</p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6D6E71]">تحديث الحالة:</span>
                        <select
                          value={r.status || 'pending'}
                          onChange={e => handleStatus(r.id, e.target.value)}
                          className={`text-xs font-bold border rounded-lg px-3 py-1.5 outline-none cursor-pointer ${b.cls}`}
                        >
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
