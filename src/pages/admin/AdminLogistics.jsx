import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { Truck, Package } from 'lucide-react';

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
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)    return 'الآن';
  if (diff < 3600)  return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  return `${Math.floor(diff / 86400)} ي`;
}

export default function AdminLogistics() {
  const [requests, setRequests] = useState([]);
  const [filter,   setFilter]   = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'logistics_requests'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleStatus = async (id, status) => {
    await updateDoc(doc(db, 'logistics_requests', id), { status });
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

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

      {/* Filter */}
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Truck size={36} className="mx-auto text-[#D1C4B9] mb-3" />
            <p className="text-[#6D6E71] text-sm">لا توجد طلبات في هذه الفئة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFCFB] text-[#6D6E71] text-xs border-b border-[#D1C4B9]">
                  <th className="px-5 py-3 text-right font-medium">المراقب</th>
                  <th className="px-5 py-3 text-right font-medium">المركز</th>
                  <th className="px-5 py-3 text-right font-medium">نوع الإسناد</th>
                  <th className="px-5 py-3 text-right font-medium">الكمية</th>
                  <th className="px-5 py-3 text-right font-medium">الوقت</th>
                  <th className="px-5 py-3 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D1C4B9]/40">
                {filtered.map(r => {
                  const b = STATUS_OPTIONS.find(s => s.value === r.status) || STATUS_OPTIONS[0];
                  const qty = r.supportType === 'both'
                    ? `د:${r.qtyInternal ?? '—'} | خ:${r.qtyExternal ?? '—'}`
                    : r.qtyInternal ?? r.qtyExternal ?? '—';
                  return (
                    <tr key={r.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-[#2D2926]">{r.observer || '—'}</td>
                      <td className="px-5 py-3.5 text-[#6D6E71]">{r.center || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5">
                          <Package size={13} className="text-[#A98159]" />
                          {TYPE_LABEL[r.supportType] || r.supportType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-[#2D2926]">{qty}</td>
                      <td className="px-5 py-3.5 text-[#6D6E71] text-xs">{timeAgo(r.timestamp)}</td>
                      <td className="px-5 py-3.5">
                        <select
                          value={r.status || 'pending'}
                          onChange={e => handleStatus(r.id, e.target.value)}
                          className={`text-xs font-bold border rounded-lg px-2 py-1 outline-none cursor-pointer ${b.cls}`}
                        >
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
