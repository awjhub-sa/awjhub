import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { ClipboardCheck, AlertTriangle, Users, Truck, TrendingUp, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-white rounded-2xl p-5 border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
      <Icon size={22} style={{ color }} strokeWidth={1.75} />
    </div>
    <div className="min-w-0">
      <p className="text-[#6D6E71] text-xs font-medium">{label}</p>
      <p className="text-2xl font-bold text-[#2D2926] leading-tight">{value ?? '—'}</p>
      {sub && <p className="text-[10px] text-[#6D6E71] mt-0.5">{sub}</p>}
    </div>
  </div>
);

const STATUS_BADGE = {
  pending:     { label: 'قيد الانتظار', cls: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'جارٍ التنفيذ',  cls: 'bg-blue-100   text-blue-700'   },
  resolved:    { label: 'تم الحل',       cls: 'bg-green-100  text-green-700'  },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [counts, setCounts]   = useState({ evals: 0, reports: 0, logistics: 0 });
  const [recent, setRecent]   = useState([]);

  useEffect(() => {
    /* Live counters */
    const unsubs = [
      onSnapshot(collection(db, 'meal_evaluations'),  s => setCounts(p => ({ ...p, evals: s.size }))),
      onSnapshot(collection(db, 'emergency_reports'), s => setCounts(p => ({ ...p, reports: s.size }))),
      onSnapshot(collection(db, 'logistics_requests'),s => setCounts(p => ({ ...p, logistics: s.size }))),
    ];

    /* Recent reports */
    const q = query(collection(db, 'emergency_reports'), orderBy('timestamp', 'desc'), limit(5));
    const unsubRecent = onSnapshot(q, snap => {
      setRecent(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubs.forEach(u => u()); unsubRecent(); };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-[#2D2926]">نظرة عامة على العمليات</h1>
        <p className="text-sm text-[#6D6E71] mt-0.5">مؤشرات الأداء الحية — موسم الحج ١٤٤٧ هـ</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="إجمالي التقييمات"     value={counts.evals}     icon={ClipboardCheck} color="#A98159" sub="تقييم جودة الوجبات" />
        <StatCard label="البلاغات الميدانية"   value={counts.reports}   icon={AlertTriangle}  color="#BA1A1A" sub="بلاغات طارئة" />
        <StatCard label="طلبات الإسناد"         value={counts.logistics} icon={Truck}          color="#1D6FA4" sub="طلبات لوجستية" />
        <StatCard label="المراقبون النشطون"     value="—"                icon={Users}          color="#386B41" sub="متصل الآن" />
      </div>

      {/* Recent reports table */}
      <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D1C4B9]">
          <div>
            <h2 className="font-bold text-[#2D2926]">آخر البلاغات الميدانية</h2>
            <p className="text-xs text-[#6D6E71]">تحديث فوري</p>
          </div>
          <button
            onClick={() => navigate('/admin/reports')}
            className="flex items-center gap-1.5 text-xs font-medium text-[#A98159] hover:underline"
          >
            عرض الكل <ArrowLeft size={13} />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="py-12 text-center text-[#6D6E71] text-sm">لا توجد بلاغات بعد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFCFB] text-[#6D6E71] text-xs">
                  <th className="px-6 py-3 text-right font-medium">المراقب</th>
                  <th className="px-6 py-3 text-right font-medium">المركز</th>
                  <th className="px-6 py-3 text-right font-medium">نوع البلاغ</th>
                  <th className="px-6 py-3 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D1C4B9]/50">
                {recent.map(r => {
                  const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
                  return (
                    <tr key={r.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="px-6 py-3 font-medium text-[#2D2926]">{r.observer || '—'}</td>
                      <td className="px-6 py-3 text-[#6D6E71]">{r.center || '—'}</td>
                      <td className="px-6 py-3 text-[#6D6E71]">{r.type || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick trend banner */}
      <div
        className="rounded-2xl p-5 text-white flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg,#3D3330 0%,#2D2926 100%)' }}
      >
        <div>
          <p className="text-[#A98159] text-xs font-bold mb-1">أداء اليوم</p>
          <p className="text-lg font-bold">اذهب إلى تحليلات الوجبات لمشاهدة الرسوم البيانية</p>
        </div>
        <button
          onClick={() => navigate('/admin/analytics')}
          className="flex-shrink-0 flex items-center gap-2 bg-[#A98159] text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:opacity-90 transition"
        >
          <TrendingUp size={16} /> التحليلات
        </button>
      </div>
    </div>
  );
}
