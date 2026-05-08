import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'قيد الانتظار', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'in_progress', label: 'جارٍ التنفيذ',  cls: 'bg-blue-100   text-blue-700   border-blue-200'   },
  { value: 'resolved',    label: 'تم الحل',       cls: 'bg-green-100  text-green-700  border-green-200'  },
];

const badge = (status) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)   return 'الآن';
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400)return `${Math.floor(diff / 3600)} س`;
  return `${Math.floor(diff / 86400)} ي`;
}

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [filter,  setFilter]  = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'emergency_reports'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleStatus = async (id, status) => {
    await updateDoc(doc(db, 'emergency_reports', id), { status });
  };

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#2D2926]">البلاغات الميدانية</h1>
          <p className="text-sm text-[#6D6E71]">{reports.length} بلاغ إجمالاً — تحديث فوري</p>
        </div>
        {loading && <RefreshCw size={18} className="animate-spin text-[#A98159]" />}
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
            {opt.value !== 'all' && (
              <span className="mr-1.5 opacity-70">
                ({reports.filter(r => r.status === opt.value || (!r.status && opt.value === 'pending')).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <AlertTriangle size={36} className="mx-auto text-[#D1C4B9] mb-3" />
            <p className="text-[#6D6E71] text-sm">لا توجد بلاغات في هذه الفئة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFCFB] text-[#6D6E71] text-xs border-b border-[#D1C4B9]">
                  <th className="px-5 py-3 text-right font-medium">المراقب</th>
                  <th className="px-5 py-3 text-right font-medium">المركز</th>
                  <th className="px-5 py-3 text-right font-medium">نوع البلاغ</th>
                  <th className="px-5 py-3 text-right font-medium">الوقت</th>
                  <th className="px-5 py-3 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D1C4B9]/40">
                {filtered.map(r => {
                  const b = badge(r.status || 'pending');
                  return (
                    <tr key={r.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-[#2D2926]">{r.observer || '—'}</td>
                      <td className="px-5 py-3.5 text-[#6D6E71]">{r.center || '—'}</td>
                      <td className="px-5 py-3.5 text-[#6D6E71]">{r.type || r.description?.slice(0,30) || '—'}</td>
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
