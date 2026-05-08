import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/db.js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { RefreshCw } from 'lucide-react';

const MEAL_QUESTIONS = [
  { id: 1, text: 'درجة حرارة الوجبة' },
  { id: 2, text: 'تغليف سليم' },
  { id: 3, text: 'ملصقات الإنتاج' },
  { id: 4, text: 'مظهر الطعام' },
  { id: 5, text: 'القفازات والكمامات' },
];

const MINA_Q  = [
  { id: 2, text: 'غسيل المطبخ' }, { id: 6, text: 'قائمة الوجبات' },
  { id: 8, text: 'ملصقات سلامة' }, { id: 13, text: 'مياه الشرب' },
  { id: 14, text: 'المواد الغذائية' },
];

const ARAFAT_Q = [
  { id: 2, text: 'غسيل المطبخ' }, { id: 5, text: 'قائمة الوجبات' },
  { id: 7, text: 'ملصقات سلامة' }, { id: 18, text: 'مياه الشرب' },
  { id: 19, text: 'المواد الغذائية' },
];

const PIE_COLORS = ['#386B41', '#BA1A1A'];

const TABS = [
  { key: 'meal',   label: 'جودة الوجبات',  col: 'meal_evaluations',  qs: MEAL_QUESTIONS,  color: '#A98159' },
  { key: 'mina',   label: 'جاهزية منى',    col: 'mina_readiness',   qs: MINA_Q,           color: '#386B41' },
  { key: 'arafat', label: 'جاهزية عرفة',   col: 'arafat_readiness', qs: ARAFAT_Q,         color: '#1D6FA4' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#D1C4B9] rounded-xl px-3 py-2 shadow-lg text-xs" dir="rtl">
      <p className="font-bold text-[#2D2926] mb-1">{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.fill || p.stroke }}>
        {p.name}: {p.value}
      </p>)}
    </div>
  );
};

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState('meal');
  const [data,      setData]      = useState({});
  const [loading,   setLoading]   = useState(false);

  const tab = TABS.find(t => t.key === activeTab);

  const load = async (key, col) => {
    setLoading(true);
    const snap = await getDocs(collection(db, col));
    setData(prev => ({ ...prev, [key]: snap.docs.map(d => d.data()) }));
    setLoading(false);
  };

  useEffect(() => { if (!data[activeTab]) load(activeTab, tab.col); }, [activeTab]);

  const docs = data[activeTab] || [];

  /* نعم/لا per question */
  const barData = tab.qs.map(q => {
    const yes = docs.filter(d => d.answers?.[q.id] === 'نعم').length;
    const no  = docs.filter(d => d.answers?.[q.id] === 'لا').length;
    return { name: q.text, نعم: yes, لا: no };
  });

  const totalYes = barData.reduce((s, d) => s + d['نعم'], 0);
  const totalNo  = barData.reduce((s, d) => s + d['لا'],  0);
  const pieData  = [{ name: 'نعم', value: totalYes }, { name: 'لا', value: totalNo }];

  /* Score trend */
  const scoreTrend = docs
    .filter(d => d.totalScore !== undefined)
    .slice(-10)
    .map((d, i) => ({ index: i + 1, درجة: +d.totalScore.toFixed(2) }));

  const avgScore = docs.length && docs[0]?.totalScore !== undefined
    ? (docs.reduce((s, d) => s + (d.totalScore || 0), 0) / docs.length).toFixed(2)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2D2926]">تحليلات التقييمات</h1>
          <p className="text-sm text-[#6D6E71]">رسوم بيانية لأداء المراقبين الميدانيين</p>
        </div>
        <button onClick={() => load(activeTab, tab.col)} className="p-2 rounded-xl border border-[#D1C4B9] hover:bg-[#FDF8F0] transition">
          <RefreshCw size={16} className={`text-[#A98159] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white border border-[#D1C4B9] rounded-2xl p-1.5 w-fit shadow-sm">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={activeTab === t.key
              ? { backgroundColor: t.color, color: '#fff' }
              : { color: '#6D6E71' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'عدد التقييمات', value: docs.length },
          { label: 'إجمالي نعم',    value: totalYes    },
          { label: 'متوسط الدرجة',  value: avgScore ?? '—' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] text-center">
            <p className="text-xs text-[#6D6E71] mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: tab.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {docs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D1C4B9] py-16 text-center shadow-sm">
          <p className="text-[#6D6E71]">لا توجد بيانات بعد لهذا القسم</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Pie */}
          <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] p-5">
            <h3 className="font-bold text-[#2D2926] mb-4">نسبة الإجابات الكلية</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                  paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar */}
          <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] p-5">
            <h3 className="font-bold text-[#2D2926] mb-4">نعم / لا لكل سؤال</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical" barSize={10} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0EAE3" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#6D6E71' }} />
                <YAxis type="category" dataKey="name" width={100}
                  tick={{ fontSize: 9, fill: '#6D6E71' }}
                  tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="نعم" fill="#386B41" radius={[0, 4, 4, 0]} />
                <Bar dataKey="لا"  fill="#BA1A1A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Score trend */}
          {scoreTrend.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] p-5 lg:col-span-2">
              <h3 className="font-bold text-[#2D2926] mb-4">اتجاه الدرجات (آخر {scoreTrend.length} تقييمات)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={scoreTrend} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE3" />
                  <XAxis dataKey="index" tick={{ fontSize: 10, fill: '#6D6E71' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#6D6E71' }} domain={[0, 10]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="درجة" stroke={tab.color} strokeWidth={2.5} dot={{ r: 4, fill: tab.color }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Compliance bars */}
          <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] p-5 lg:col-span-2">
            <h3 className="font-bold text-[#2D2926] mb-4">نسبة الامتثال لكل سؤال</h3>
            <div className="space-y-3">
              {barData.map(d => {
                const total = d['نعم'] + d['لا'];
                const pct   = total ? Math.round((d['نعم'] / total) * 100) : 0;
                return (
                  <div key={d.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#2D2926] font-medium">{d.name}</span>
                      <span className="font-bold" style={{ color: tab.color }}>{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: tab.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
