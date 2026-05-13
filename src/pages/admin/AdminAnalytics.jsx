import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/db.js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
  ClipboardList, Mountain, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, TrendingUp, Utensils,
} from 'lucide-react';
import { getCaterer } from '../../config/centers.js';
import { MEAL_QUESTIONS } from '../../config/mealQuestions.js';

/* ── Full question definitions ── */
const MEAL_Qs = MEAL_QUESTIONS;

const MINA_Qs = [
  { id: 1,  text: 'هل الطبخ في مطبخ واحد أم عدة مطابخ؟',                  type: 'choice' },
  { id: 2,  text: 'هل تم غسيل المطبخ (الحوائط / المداخن / الأرضيات)؟' },
  { id: 3,  text: 'هل تم وضع المستندات الرسمية في لوحة ظاهرة؟' },
  { id: 5,  text: 'هل يوجد مصادر مياه متوفرة داخل المطبخ ومرافق المركز؟' },
  { id: 6,  text: 'هل تم وضع قائمة الوجبات (المنيو) بلغة الحاج؟' },
  { id: 7,  text: 'هل تم وضع مواعيد توزيع الوجبات بلغة الحاج؟' },
  { id: 8,  text: 'هل يوجد ملصقات توعوية عن سلامة الغذاء؟' },
  { id: 9,  text: 'هل تم توفير مغسلة أيدي بمستشعر داخل المطبخ؟' },
  { id: 10, text: 'هل صواعق الحشرات الكهربائية نظيفة وتعمل؟' },
  { id: 11, text: 'هل تم توفير دولاب للأغراض الشخصية للعاملين؟' },
  { id: 12, text: 'هل تم تنظيف غرفة الزيت / التفتيش من الرواسب؟' },
  { id: 13, text: 'هل تم توفير مياه الشرب بشكل كافٍ داخل الموقع؟' },
  { id: 14, text: 'هل تم توفير المواد الأساسية الغذائية من المتعهد؟' },
  { id: 15, text: 'هل مواقد الطبخ / الدوافير (الكيروسين) تعمل بشكل جيد؟' },
  { id: 16, text: 'هل تم توفير فلتر مياه (ثلاثي) داخل المطبخ؟' },
  { id: 17, text: 'هل تم توفير ثلاجات / ترامس لتبريد مياه الشرب؟',         type: 'yesno_detail' },
  { id: 18, text: 'هل تم تحديد موقع مهيأ لتخزين المواد الغذائية؟' },
  { id: 19, text: 'هل جميع المنتجات المستخدمة بها بطاقة تعريف المنتج؟' },
  { id: 20, text: 'هل يتم تخزين المواد الغذائية بطريقة آمنة وسليمة؟' },
  { id: 21, text: 'هل تم توفير معدات وأدوات الطبخ كاملة؟' },
  { id: 22, text: 'هل يوجد مستودع (غرفة) تبريد مهيأ وجاهز للاستخدام؟' },
  { id: 23, text: 'هل يوجد مستودع (غرفة) تجميد مهيأ وجاهز للاستخدام؟' },
  { id: 24, text: 'هل تم توفير حافظات (غرم الثلج)؟' },
  { id: 25, text: 'هل توفرت كميات كافية من الثلج داخل حافظة الثلج؟' },
  { id: 26, text: 'هل توفرت وجبات جافة احتياطية بكميات كافية؟' },
];

const ARAFAT_Qs = [
  { id: 1,  text: 'هل الطبخ في مطبخ واحد أم عدة مطابخ؟',                  type: 'choice' },
  { id: 2,  text: 'هل تم غسيل المطبخ (الحوائط / المداخن / الأرضيات)؟' },
  { id: 3,  text: 'هل تم وضع المستندات الرسمية في لوحة ظاهرة؟' },
  { id: 4,  text: 'هل يوجد مصادر مياه مع توفر المياه في الخزان الاحتياطي؟' },
  { id: 5,  text: 'هل تم وضع قائمة الوجبات (المنيو) بلغة الحاج؟' },
  { id: 6,  text: 'هل تم وضع مواعيد توزيع الوجبات بلغة الحاج؟' },
  { id: 7,  text: 'هل يوجد ملصقات توعوية عن سلامة الغذاء؟' },
  { id: 8,  text: 'هل صواعق الحشرات الكهربائية نظيفة وتعمل؟' },
  { id: 9,  text: 'هل تم توفير دولاب للأغراض الشخصية للعاملين؟' },
  { id: 10, text: 'هل تم توفير حافظات (غرف الثلج)؟' },
  { id: 11, text: 'هل توفرت كميات كافية من الثلج داخل حافظة الثلج؟' },
  { id: 12, text: 'هل مواقد الطبخ تم إنشاؤها وتجربتها؟' },
  { id: 13, text: 'هل تم توفير فلتر مياه (ثلاثي) داخل المطبخ؟' },
  { id: 14, text: 'هل تم توفير ثلاجات / ترامس لتبريد مياه الشرب؟',         type: 'yesno_detail' },
  { id: 15, text: 'هل تم تحديد موقع مهيأ لتخزين المواد الغذائية؟' },
  { id: 16, text: 'هل جميع المنتجات المستخدمة بها بطاقة تعريف المنتج؟' },
  { id: 17, text: 'هل يتم تخزين المواد الغذائية بطريقة آمنة وسليمة؟' },
  { id: 18, text: 'هل تم توفير مياه الشرب بشكل كافٍ داخل الموقع؟' },
  { id: 19, text: 'هل تم توفير المواد الأساسية الغذائية من المتعهد؟' },
  { id: 20, text: 'هل تم توفير معدات وأدوات الطبخ (القدور – الحطب)؟' },
  { id: 21, text: 'هل يوجد مستودع (غرفة) تبريد مهيأ وجاهز للاستخدام؟' },
  { id: 22, text: 'هل تم توفير مستودع منفصل لتخزين الحطب؟' },
  { id: 23, text: 'هل الحطب متوفر بكميات كافية؟' },
  { id: 24, text: 'هل توفرت وجبات جافة احتياطية بكميات كافية؟' },
];

/* 5 representative questions plotted on the bar chart for the meal tab */
const MEAL_CHART_Qs = [
  { id: 2,  text: 'المستندات الرسمية' },
  { id: 12, text: 'شهادات صحية' },
  { id: 16, text: 'الإجراءات الصحية' },
  { id: 25, text: 'مواعيد التوزيع' },
  { id: 32, text: 'حافظات النقل' },
];
const MINA_CHART_Qs   = [
  { id: 2, text: 'غسيل المطبخ' }, { id: 6, text: 'قائمة الوجبات' },
  { id: 8, text: 'ملصقات سلامة' }, { id: 13, text: 'مياه الشرب' },
  { id: 14, text: 'المواد الغذائية' },
];
const ARAFAT_CHART_Qs = [
  { id: 2, text: 'غسيل المطبخ' }, { id: 5, text: 'قائمة الوجبات' },
  { id: 7, text: 'ملصقات سلامة' }, { id: 18, text: 'مياه الشرب' },
  { id: 19, text: 'المواد الغذائية' },
];

const PIE_COLORS = ['#386B41', '#BA1A1A'];

const TABS = [
  { key: 'meal',   label: 'تقييم الوجبات', col: 'meal_evaluations',  color: '#A98159', icon: Utensils,     allQs: MEAL_Qs,   chartQs: MEAL_CHART_Qs,   hasScore: true  },
  { key: 'mina',   label: 'جاهزية منى',    col: 'mina_readiness',   color: '#386B41', icon: Mountain,     allQs: MINA_Qs,   chartQs: MINA_CHART_Qs,   hasScore: true  },
  { key: 'arafat', label: 'جاهزية عرفة',   col: 'arafat_readiness', color: '#1D6FA4', icon: Mountain,     allQs: ARAFAT_Qs, chartQs: ARAFAT_CHART_Qs, hasScore: true  },
];

/* ── Helpers ── */
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

function getScore(doc) {
  if (doc.scoreOutOf10 != null) return Number(doc.scoreOutOf10);
  const max = Number(doc.maxScore);
  const tot = Number(doc.totalScore);
  if (max > 0 && !isNaN(tot)) return parseFloat(((tot / max) * 10).toFixed(2));
  // legacy fallback: docs that only have a percentage string (0-100)
  const pct = parseFloat(doc.percentage);
  if (!isNaN(pct)) return parseFloat((pct / 10).toFixed(2));
  return null;
}

/* Field-name normalizers — different pages historically saved different keys. */
const getObserver = d => d.observer || d.observerName || '—';
const getCenter   = d => d.center   || d.centerId     || '—';

function scoreBadgeStyle(score) {
  if (score == null) return null;
  if (score >= 8) return { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
  if (score >= 5) return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
  return              { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E8E0D8] rounded-2xl px-3 py-2 shadow-lg text-xs" dir="rtl">
      <p className="font-bold text-[#2D2926] mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.stroke }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════ */
export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState('meal');
  const [data,      setData]      = useState({ meal: null, mina: null, arafat: null });
  const [expanded,  setExpanded]  = useState(null);

  useEffect(() => {
    const unsubs = TABS.map(t =>
      onSnapshot(collection(db, t.col), snap => {
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
        setData(prev => ({ ...prev, [t.key]: docs }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, []);

  const tab  = TABS.find(t => t.key === activeTab);
  const docs = data[activeTab] ?? [];

  const barData = tab.chartQs.map(q => {
    const yes = docs.filter(d => d.answers?.[q.id] === 'نعم').length;
    const no  = docs.filter(d => d.answers?.[q.id] === 'لا').length;
    return { name: q.text, نعم: yes, لا: no };
  });
  const totalYes = barData.reduce((s, d) => s + d['نعم'], 0);
  const totalNo  = barData.reduce((s, d) => s + d['لا'],  0);
  const pieData  = [{ name: 'نعم', value: totalYes }, { name: 'لا', value: totalNo }];

  const scoreDocs  = docs.filter(d => getScore(d) != null);
  const avgScore   = scoreDocs.length
    ? (scoreDocs.reduce((s, d) => s + getScore(d), 0) / scoreDocs.length).toFixed(1)
    : null;
  const scoreTrend = scoreDocs.slice(-10).map((d, i) => ({
    index: i + 1,
    درجة: parseFloat(getScore(d).toFixed(1)),
  }));

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="bg-white rounded-3xl border border-[#E8E0D8] shadow-[0_2px_20px_rgba(45,41,38,0.06)] px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#A9815922,#A9815910)' }}>
            <ClipboardList size={22} className="text-[#A98159]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2D2926]">التقييمات</h1>
            <p className="text-sm text-[#6D6E71]">تقييمات الوجبات والجاهزية الميدانية — موسم الحج ١٤٤٧ هـ</p>
          </div>
        </div>
      </div>

      {/* ── Sub-section selectors ── */}
      <div className="grid grid-cols-3 gap-3">
        {TABS.map(t => {
          const Icon  = t.icon;
          const active = activeTab === t.key;
          const count  = data[t.key]?.length ?? null;
          return (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key); setExpanded(null); }}
              className={`relative flex flex-col items-center gap-2.5 px-4 py-5 rounded-3xl border-2 transition-all duration-200 ${
                active
                  ? 'shadow-[0_6px_28px_rgba(45,41,38,0.14)]'
                  : 'bg-white border-[#E8E0D8] shadow-[0_2px_12px_rgba(45,41,38,0.04)] hover:shadow-[0_4px_20px_rgba(45,41,38,0.08)]'
              }`}
              style={active
                ? { background: `linear-gradient(135deg,${t.color}1A,${t.color}07)`, borderColor: t.color }
                : {}}
            >
              <div className="w-13 h-13 w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                style={{ background: active ? `${t.color}25` : `${t.color}13` }}>
                <Icon size={22} style={{ color: t.color }} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold leading-snug"
                  style={{ color: active ? t.color : '#2D2926' }}>
                  {t.label}
                </p>
                {count != null && (
                  <p className="text-[11px] text-[#6D6E71] mt-0.5">{count} تقييم</p>
                )}
              </div>
              {active && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full"
                  style={{ backgroundColor: t.color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'عدد التقييمات', value: docs.length,                                              color: tab.color  },
          { label: 'إجمالي نعم',    value: totalYes,                                                  color: '#386B41'  },
          { label: tab.hasScore ? 'متوسط الدرجة' : 'إجمالي لا',
            value: tab.hasScore ? (avgScore ? `${avgScore}/10` : '—') : totalNo,
            color: tab.hasScore ? '#A98159' : '#BA1A1A' },
        ].map(c => (
          <div key={c.label}
            className="bg-white rounded-3xl p-4 border border-[#E8E0D8] shadow-[0_2px_20px_rgba(45,41,38,0.06)] text-center">
            <p className="text-[10px] text-[#6D6E71] mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {data[activeTab] === null ? (
        <div className="bg-white rounded-3xl border border-[#E8E0D8] py-16 text-center shadow-[0_2px_20px_rgba(45,41,38,0.06)]">
          <div className="w-6 h-6 border-2 border-[#A98159]/30 border-t-[#A98159] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#6D6E71] text-sm">جارٍ التحميل...</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#E8E0D8] py-16 text-center shadow-[0_2px_20px_rgba(45,41,38,0.06)]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: `${tab.color}12` }}>
            <tab.icon size={22} style={{ color: tab.color }} strokeWidth={1.5} />
          </div>
          <p className="text-[#6D6E71] font-medium">لا توجد بيانات بعد لهذا القسم</p>
        </div>
      ) : (
        <>
          {/* ── Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Pie chart */}
            <div className="bg-white rounded-3xl border border-[#E8E0D8] shadow-[0_2px_20px_rgba(45,41,38,0.06)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E8E0D8]"
                style={{ background: `linear-gradient(135deg,${tab.color}0A,transparent)` }}>
                <h3 className="font-bold text-[#2D2926] text-sm">نسبة الإجابات الكلية</h3>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar chart */}
            <div className="bg-white rounded-3xl border border-[#E8E0D8] shadow-[0_2px_20px_rgba(45,41,38,0.06)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E8E0D8]"
                style={{ background: `linear-gradient(135deg,${tab.color}0A,transparent)` }}>
                <h3 className="font-bold text-[#2D2926] text-sm">نعم / لا لكل سؤال</h3>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} layout="vertical" barSize={9} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0EAE3" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#6D6E71' }} />
                    <YAxis type="category" dataKey="name" width={90}
                      tick={{ fontSize: 9, fill: '#6D6E71' }}
                      tickFormatter={v => v.length > 10 ? v.slice(0, 10) + '…' : v} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="نعم" fill="#386B41" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="لا"  fill="#BA1A1A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score trend */}
            {tab.hasScore && scoreTrend.length > 1 && (
              <div className="bg-white rounded-3xl border border-[#E8E0D8] shadow-[0_2px_20px_rgba(45,41,38,0.06)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E8E0D8]"
                  style={{ background: `linear-gradient(135deg,${tab.color}0A,transparent)` }}>
                  <h3 className="font-bold text-[#2D2926] text-sm">
                    اتجاه الدرجات (آخر {scoreTrend.length} تقييمات)
                  </h3>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={scoreTrend} margin={{ left: 0, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE3" />
                      <XAxis dataKey="index" tick={{ fontSize: 10, fill: '#6D6E71' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#6D6E71' }} domain={[0, 10]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="درجة" stroke={tab.color} strokeWidth={2.5}
                        dot={{ r: 4, fill: tab.color }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Compliance bars */}
            <div className={`bg-white rounded-3xl border border-[#E8E0D8] shadow-[0_2px_20px_rgba(45,41,38,0.06)] overflow-hidden ${
              tab.hasScore && scoreTrend.length > 1 ? '' : 'lg:col-span-2'
            }`}>
              <div className="px-5 py-4 border-b border-[#E8E0D8]"
                style={{ background: `linear-gradient(135deg,${tab.color}0A,transparent)` }}>
                <h3 className="font-bold text-[#2D2926] text-sm">نسبة الامتثال لكل سؤال</h3>
              </div>
              <div className="p-5 space-y-3">
                {barData.map(d => {
                  const total = d['نعم'] + d['لا'];
                  const pct   = total ? Math.round((d['نعم'] / total) * 100) : 0;
                  return (
                    <div key={d.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#2D2926] font-medium">{d.name}</span>
                        <span className="font-bold" style={{ color: tab.color }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#F0EAE3] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: tab.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Evaluations divider ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E8E0D8]" />
            <span className="text-xs font-bold px-3 py-1.5 rounded-full border"
              style={{ color: tab.color, background: `${tab.color}10`, borderColor: `${tab.color}30` }}>
              قائمة التقييمات ({docs.length})
            </span>
            <div className="h-px flex-1 bg-[#E8E0D8]" />
          </div>

          {/* ── Evaluations list ── */}
          <div className="space-y-3">
            {docs.map(item => {
              const score     = getScore(item);
              const badge     = scoreBadgeStyle(score);
              const noAnswers = tab.allQs.filter(q => item.answers?.[q.id] === 'لا');
              const isOpen    = expanded === item.id;
              const Icon      = tab.icon;

              return (
                <div key={item.id}
                  className="bg-white rounded-3xl border border-[#E8E0D8] shadow-[0_2px_20px_rgba(45,41,38,0.06)] overflow-hidden hover:shadow-[0_4px_24px_rgba(45,41,38,0.10)] transition-shadow">

                  {/* Colored accent strip */}
                  <div className="h-0.5" style={{ backgroundColor: tab.color }} />

                  {/* Summary row */}
                  <div className="px-5 py-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg,${tab.color}20,${tab.color}10)` }}>
                      <Icon size={18} style={{ color: tab.color }} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-[#2D2926]">{getObserver(item)}</span>
                        {badge && score != null && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                            style={{ background: badge.bg, color: badge.text, borderColor: badge.border }}>
                            {score.toFixed(1)} / 10
                          </span>
                        )}
                        {noAnswers.length > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
                            {noAnswers.length} ملاحظة
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6D6E71]">{getCenter(item)}</p>
                      <p className="text-[10px] text-[#A98159] font-medium mt-0.5">
                        🏭 {item.caterer || getCaterer(getCenter(item)) || '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <p className="text-[10px] text-[#6D6E71]">{timeAgo(item.timestamp)}</p>
                      <button
                        onClick={() => setExpanded(isOpen ? null : item.id)}
                        className="flex items-center gap-1 text-xs font-bold transition-colors"
                        style={{ color: tab.color }}
                      >
                        {isOpen
                          ? <><ChevronUp size={13} /> إخفاء</>
                          : <><ChevronDown size={13} /> التفاصيل</>}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="border-t border-[#E8E0D8]/60 bg-[#FDFCFB] px-5 py-4 space-y-4">

                      {/* Observer / center / caterer / timestamp */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {[
                          { label: 'المراقب',      val: getObserver(item),                                bold: true },
                          { label: 'المركز',        val: getCenter(item),                                  bold: true },
                          { label: 'المتعهد',       val: item.caterer || getCaterer(getCenter(item)),      gold: true },
                          { label: 'وقت الإرسال',  val: fullDate(item.timestamp),                         time: true },
                        ].map(c => (
                          <div key={c.label} className="bg-white rounded-2xl border border-[#E8E0D8] p-3"
                            style={c.time ? { borderColor: `${tab.color}40`, background: `${tab.color}06` } : {}}>
                            <p className="text-[#6D6E71] text-[10px] mb-0.5">{c.label}</p>
                            <p className={`font-bold text-[10px] leading-snug ${c.gold ? 'text-[#A98159]' : c.time ? '' : 'text-[#2D2926]'} ${!c.time ? 'truncate' : ''}`}
                              style={c.time ? { color: tab.color } : {}}>
                              {c.val || '—'}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Score progress bar */}
                      {tab.hasScore && score != null && (
                        <div className="bg-white rounded-2xl border border-[#E8E0D8] p-3.5">
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-[#6D6E71] font-medium">الدرجة الإجمالية</span>
                            <span className="font-bold" style={{ color: tab.color }}>{score.toFixed(2)} / 10</span>
                          </div>
                          <div className="h-2 bg-[#F0EAE3] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.min(score * 10, 100)}%`, backgroundColor: tab.color }} />
                          </div>
                        </div>
                      )}

                      {/* Questions answered لا */}
                      {noAnswers.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1.5">
                            <XCircle size={13} strokeWidth={1.5} />
                            الأسئلة المجابة بـ «لا» ({noAnswers.length})
                          </p>
                          <div className="space-y-1.5">
                            {noAnswers.map(q => (
                              <div key={q.id}
                                className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-2xl px-3 py-2.5">
                                <span className="text-[10px] font-bold text-red-400 mt-0.5 flex-shrink-0">#{q.id}</span>
                                <p className="text-xs text-red-700 leading-relaxed">{q.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* All answers */}
                      <div>
                        <p className="text-xs font-bold text-[#6D6E71] mb-2 flex items-center gap-1.5">
                          <TrendingUp size={13} strokeWidth={1.5} />
                          جميع الإجابات
                        </p>
                        <div className="space-y-1.5">
                          {tab.allQs.map(q => {
                            const ans   = item.answers?.[q.id];
                            if (!ans) return null;
                            const isYes = ans === 'نعم';
                            const isNo  = ans === 'لا';
                            return (
                              <div key={q.id} className={`flex items-center gap-2 rounded-2xl px-3 py-2 border ${
                                isYes ? 'bg-green-50 border-green-100'
                                : isNo ? 'bg-red-50 border-red-100'
                                :        'bg-gray-50 border-gray-100'
                              }`}>
                                <span className="text-[10px] font-bold flex-shrink-0"
                                  style={{ color: isYes ? '#386B41' : isNo ? '#BA1A1A' : '#6D6E71' }}>
                                  #{q.id}
                                </span>
                                <p className="text-xs flex-1 leading-relaxed"
                                  style={{ color: isYes ? '#166534' : isNo ? '#991B1B' : '#2D2926' }}>
                                  {q.text}
                                </p>
                                <span className={`text-[10px] font-bold flex-shrink-0 flex items-center gap-0.5 ${
                                  isYes ? 'text-green-600' : isNo ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                  {isYes
                                    ? <CheckCircle2 size={12} strokeWidth={2} />
                                    : isNo ? <XCircle size={12} strokeWidth={2} /> : null}
                                  {ans}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
