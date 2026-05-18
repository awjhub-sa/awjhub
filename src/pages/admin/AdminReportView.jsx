import { useEffect, useState, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../lib/db.js';
import { CENTERS, getCaterer } from '../../config/centers.js';
import { MEAL_QUESTIONS } from '../../config/mealQuestions.js';
import { MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';
import { ARAFAT_ALL_CRITERIA } from '../../config/arafatQuestions.js';
import {
  Printer, X, FileText, Building2, Calendar, User, AlertCircle, CheckCircle2,
  Utensils, Mountain,
} from 'lucide-react';
import logoSrc from '../../assets/logo-color.svg';
import './report-view.css';

const REPORT_TYPES = {
  meal_evaluations: {
    label: 'تقييم جودة الوجبات', short: 'الوجبات',
    color: '#A98159', accent: '#FDF8F0', border: '#E8DDD4',
    Icon: Utensils,
    intro: 'جودة وسلامة الوجبات المُقدّمة في المراكز',
  },
  mina_readiness: {
    label: 'جاهزية مشعر منى', short: 'منى',
    color: '#2F855A', accent: '#F0FDF4', border: '#BBF7D0',
    Icon: Mountain,
    intro: 'جاهزية المطابخ والتجهيزات في مشعر منى',
  },
  arafat_readiness: {
    label: 'جاهزية مشعر عرفة', short: 'عرفة',
    color: '#0987A0', accent: '#ECFEFF', border: '#A5F3FC',
    Icon: Mountain,
    intro: 'جاهزية المطابخ والتجهيزات في مشعر عرفة',
  },
};

const QUESTION_BANK = {
  meal_evaluations: MEAL_QUESTIONS,
  mina_readiness:   MINA_ALL_CRITERIA,
  arafat_readiness: ARAFAT_ALL_CRITERIA,
};

const MEAL_LABELS = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };

/* ── Helpers ─────────────────────────────────────────────────────── */
function getRecordScore(rec) {
  if (rec.scoreOutOf10 != null) return Number(rec.scoreOutOf10);
  const max = Number(rec.maxScore);
  const tot = Number(rec.totalScore);
  if (max > 0 && !isNaN(tot)) return parseFloat(((tot / max) * 10).toFixed(2));
  const pct = parseFloat(rec.percentage);
  if (!isNaN(pct)) return parseFloat((pct / 10).toFixed(2));
  return null;
}

function formatTime(ts) {
  if (!ts) return '—';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return '—'; }
}

async function fetchReportData({ centerFilter, dateFilter, types }) {
  const result = {};
  await Promise.all(types.map(async (type) => {
    const opts = centerFilter !== 'all' ? { filter: { center: centerFilter } } : {};
    let docs = await db[type].list(opts);
    if (dateFilter) {
      docs = docs.filter(d => (d.scheduledDate ?? '') === dateFilter);
    }
    docs.sort((a, b) =>
      (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0)
    );
    result[type] = docs;
  }));
  return result;
}

export default function AdminReportView() {
  const [params] = useSearchParams();

  const centerFilter = params.get('center') || 'all';
  const dateFilter   = params.get('date')   || '';
  const types        = (params.get('types') || '').split(',').filter(Boolean);
  const detailed     = params.get('detailed') === '1';

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!types.length) {
      setError('لم يتم تحديد أي نوع تقرير');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchReportData({ centerFilter, dateFilter, types })
      .then(setData)
      .catch(err => setError(err.message || 'حدث خطأ في جلب البيانات'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerFilter, dateFilter, params.get('types')]);

  /* ── Derived: centers in scope ── */
  const centers = useMemo(() => {
    if (!data) return [];
    if (centerFilter !== 'all') return [centerFilter];
    const set = new Set();
    types.forEach(t => (data[t] || []).forEach(d => d.center && set.add(d.center)));
    return [...set].sort((a, b) => {
      const na = parseInt((a ?? '').replace(/\D/g, '')) || 0;
      const nb = parseInt((b ?? '').replace(/\D/g, '')) || 0;
      return na - nb;
    });
  }, [data, centerFilter, types]);

  /* ── Totals for cover page ── */
  const totals = useMemo(() => {
    if (!data) return { total: 0, perType: {} };
    let total = 0;
    const perType = {};
    types.forEach(t => {
      const n = (data[t] || []).length;
      perType[t] = n;
      total += n;
    });
    return { total, perType };
  }, [data, types]);

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="report-view" dir="rtl">
      <Toolbar />

      {loading && <LoadingCard />}
      {error && !loading && <ErrorCard message={error} />}

      {data && !loading && !error && (
        <>
          <CoverPage
            centerFilter={centerFilter}
            dateFilter={dateFilter}
            types={types}
            totals={totals}
          />
          {types.map(type => {
            const records = data[type] || [];
            if (!records.length) return null;
            // Centers that have records for this type, in numeric order
            const typeCenters = centers.filter(
              c => records.some(r => r.center === c)
            );
            return (
              <Fragment key={type}>
                <TypeCoverPage type={type} records={records} centers={typeCenters} />
                {typeCenters.map(center => {
                  const centerRecs = records.filter(r => r.center === center);
                  return (
                    <SectionPage
                      key={`${type}__${center}`}
                      center={center}
                      type={type}
                      records={centerRecs}
                      detailed={detailed}
                    />
                  );
                })}
              </Fragment>
            );
          })}
        </>
      )}
    </div>
  );
}

function Toolbar() {
  return (
    <div className="report-toolbar no-print">
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-[0_4px_16px_rgba(169,129,89,0.35)] hover:shadow-[0_6px_24px_rgba(169,129,89,0.45)] transition-shadow"
        style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}
      >
        <Printer size={16} strokeWidth={2.25} />
        اطبع / احفظ PDF
      </button>
      <button
        onClick={() => window.close()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#EDE5DC] bg-white text-[#6D6E71] font-bold text-sm hover:bg-[#FDF8F0] hover:border-[#A98159] transition-colors"
      >
        <X size={14} strokeWidth={2.25} />
        إغلاق
      </button>
      <div className="text-xs text-[#9D8F85] mr-auto leading-relaxed max-w-md">
        💡 عند الطباعة، فعّل خيار <span className="font-bold text-[#A98159]">«Background graphics»</span> في إعدادات المتصفح ليطبع التنسيق الملوّن.
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <article className="report-page-card flex items-center justify-center text-center">
      <div>
        <div className="w-12 h-12 border-4 border-[#EDE5DC] border-t-[#A98159] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#6D6E71] text-lg font-medium">جارٍ تحضير التقرير...</p>
      </div>
    </article>
  );
}

function ErrorCard({ message }) {
  return (
    <article className="report-page-card flex items-center justify-center text-center">
      <div>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background: 'linear-gradient(135deg, #FEE2E2, #FECACA)' }}>
          <AlertCircle size={26} className="text-red-500" strokeWidth={2} />
        </div>
        <p className="text-[#6D6E71] text-base font-medium">{message}</p>
      </div>
    </article>
  );
}

function CoverPage({ centerFilter, dateFilter, types, totals }) {
  const now = new Date();
  const generatedAt = now.toLocaleString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const contractor = centerFilter !== 'all'
    ? (CENTERS.find(c => c.id === centerFilter)?.caterer ?? '—')
    : '—';

  return (
    <article className="report-page-card">
      {/* Top brand band */}
      <div
        className="rounded-2xl p-7 text-white shadow-md relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #C4A46E 0%, #A98159 60%, #8B6840 100%)' }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(40%, -50%)' }} />
        <div className="flex items-center gap-5 relative">
          <div className="bg-white rounded-2xl p-3 shadow-md flex-shrink-0">
            <img src={logoSrc} alt="ضيوف البيت" className="w-20 h-auto" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">ضيوف البيت</h1>
            <p className="text-white/85 text-sm font-medium">لجنة التغذية</p>
          </div>
        </div>
      </div>

      {/* Center title */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
        <p className="text-sm text-[#9D8F85] font-semibold mb-2">تقرير</p>
        <h2 className="text-4xl font-bold text-[#2D2926] mb-3">الرقابة الميدانية</h2>
        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-[#A98159]" />
          <p className="text-base text-[#A98159] font-bold">موسم الحج ١٤٤٧ هـ</p>
          <span className="w-2 h-2 rounded-full bg-[#A98159]" />
        </div>

        {/* Filters summary card */}
        <div className="bg-[#FDF8F0] border-2 border-[#E8DDD4] rounded-2xl p-6 max-w-xl w-full text-right shadow-sm">
          <div className="space-y-3.5">
            <Row Icon={Building2} label="المركز" value={centerFilter === 'all' ? 'جميع المراكز' : centerFilter} />
            <Row Icon={FileText}  label="اسم المتعهد" value={contractor} />
            <Row Icon={Calendar}  label="التاريخ"  value={dateFilter || 'جميع الأيام'} />
            <Row
              Icon={CheckCircle2}
              label="أنواع التقارير"
              value={types.map(t => REPORT_TYPES[t]?.label).filter(Boolean).join(' • ')}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatBlock label="إجمالي السجلات" value={totals.total} accent="#A98159" />
        {types.map(t => (
          <StatBlock
            key={t}
            label={REPORT_TYPES[t]?.label.replace('جاهزية ', '').replace('تقييم جودة الوجبات', 'الوجبات').replace('مشعر ', '')}
            value={totals.perType[t] ?? 0}
            accent={REPORT_TYPES[t]?.color || '#A98159'}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#EDE5DC] pt-4 text-xs text-[#9D8F85] flex justify-between">
        <span>
          <span className="font-bold text-[#2D2926]">تاريخ الإصدار:</span> {generatedAt}
        </span>
        <span className="font-bold text-[#A98159]">منظومة المراقبة الميدانية</span>
      </div>
    </article>
  );
}

function Row({ Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-[#A98159]/10 border border-[#A98159]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-[#A98159]" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#9D8F85] font-semibold">{label}</p>
        <p className="text-sm text-[#2D2926] font-bold leading-snug">{value || '—'}</p>
      </div>
    </div>
  );
}

function StatBlock({ label, value, accent }) {
  return (
    <div
      className="rounded-xl p-3.5 text-center border"
      style={{ borderColor: `${accent}40`, background: `${accent}10` }}
    >
      <p className="text-[11px] text-[#9D8F85] font-semibold mb-1">{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function TypeCoverPage({ type, records, centers }) {
  const meta = REPORT_TYPES[type];
  if (!meta) return null;
  const TypeIcon = meta.Icon;

  /* Stats */
  const totalRecs = records.length;
  const totalCenters = centers.length;

  const scores = records
    .map(getRecordScore)
    .filter(s => s != null && !isNaN(s));
  const avgScore = scores.length
    ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1)
    : null;

  /* Distribution: high / medium / low */
  const highCount = scores.filter(s => s >= 8).length;
  const medCount  = scores.filter(s => s >= 5 && s < 8).length;
  const lowCount  = scores.filter(s => s < 5).length;

  return (
    <article className="report-page-card">
      {/* Top brand band — matches main cover but tinted with type color */}
      <div
        className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}CC, ${meta.color}AA)` }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(40%, -50%)' }} />
        <div className="flex items-center gap-4 relative">
          <div className="bg-white rounded-2xl p-2.5 shadow-md flex-shrink-0">
            <img src={logoSrc} alt="ضيوف البيت" className="w-16 h-auto" />
          </div>
          <div>
            <p className="text-white/85 text-xs font-bold uppercase tracking-widest">قسم التقارير</p>
            <h2 className="text-xl font-bold mt-0.5">{meta.label}</h2>
          </div>
        </div>
      </div>

      {/* Massive type label centered */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
        <div className="relative mb-6">
          {/* Glow halo behind icon */}
          <div className="absolute inset-0 rounded-full blur-3xl opacity-30"
            style={{ background: meta.color }} />
          <div
            className="relative w-28 h-28 rounded-3xl flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}DD)` }}
          >
            <TypeIcon size={56} className="text-white" strokeWidth={1.75} />
          </div>
        </div>

        <p className="text-sm text-[#9D8F85] font-semibold mb-2">قسم</p>
        <h1
          className="text-6xl md:text-7xl leading-none font-bold mb-3"
          style={{ color: meta.color }}
        >
          {meta.short}
        </h1>
        <p className="text-base text-[#6D6E71] font-medium max-w-md">{meta.intro}</p>

        {/* Stats strip */}
        <div className="mt-10 bg-white border-2 rounded-2xl px-6 py-5 inline-flex gap-8 items-center shadow-sm"
          style={{ borderColor: `${meta.color}33` }}>
          <div className="text-center">
            <p className="text-xs text-[#9D8F85] font-semibold mb-1">عدد السجلات</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: meta.color }}>{totalRecs}</p>
          </div>
          <div className="w-px h-14" style={{ background: `${meta.color}22` }} />
          <div className="text-center">
            <p className="text-xs text-[#9D8F85] font-semibold mb-1">عدد المراكز</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: meta.color }}>{totalCenters}</p>
          </div>
          {avgScore != null && (
            <>
              <div className="w-px h-14" style={{ background: `${meta.color}22` }} />
              <div className="text-center">
                <p className="text-xs text-[#9D8F85] font-semibold mb-1">متوسط الدرجة</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: meta.color }}>
                  {avgScore}<span className="text-base">/10</span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Score distribution if we have scores */}
        {scores.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {highCount > 0 && (
              <DistPill label="ممتاز (٨+)" value={highCount} color="#16A34A" />
            )}
            {medCount > 0 && (
              <DistPill label="متوسط (٥-٨)" value={medCount} color="#F59E0B" />
            )}
            {lowCount > 0 && (
              <DistPill label="منخفض (<٥)" value={lowCount} color="#DC2626" />
            )}
          </div>
        )}
      </div>

      {/* Centers chip list */}
      {centers.length > 0 && (
        <div className="rounded-2xl border border-[#EDE5DC] bg-[#FDF8F0]/50 p-4 mb-4">
          <p className="text-xs text-[#9D8F85] font-bold mb-2.5 flex items-center gap-1.5">
            <Building2 size={12} className="text-[#A98159]" strokeWidth={2} />
            المراكز المشمولة في هذا القسم
          </p>
          <div className="flex flex-wrap gap-1.5">
            {centers.map(c => (
              <span key={c}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full border text-[#2D2926] bg-white"
                style={{ borderColor: `${meta.color}40` }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#EDE5DC] pt-4 text-xs text-[#9D8F85] flex justify-between">
        <span className="font-bold text-[#A98159]">لجنة التغذية | ضيوف البيت</span>
        <span>موسم الحج ١٤٤٧ هـ</span>
      </div>
    </article>
  );
}

function DistPill({ label, value, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border"
      style={{ background: `${color}10`, borderColor: `${color}40`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}: <span className="tabular-nums">{value}</span>
    </span>
  );
}

function SectionPage({ center, type, records, detailed }) {
  const meta = REPORT_TYPES[type] || REPORT_TYPES.meal_evaluations;
  const caterer = CENTERS.find(c => c.id === center)?.caterer ?? '';

  const avgScore = records.length
    ? (records.reduce((s, d) => s + (getRecordScore(d) ?? 0), 0) / records.length).toFixed(1)
    : '—';

  return (
    <article className="report-page-card">
      {/* Section header */}
      <div className="rounded-2xl p-5 text-white shadow-md mb-5"
        style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}DD)` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1.5">
              {meta.label}
            </p>
            <h2 className="text-2xl font-bold mb-1.5">{center}</h2>
            {caterer && (
              <p className="text-white/85 text-xs font-medium leading-relaxed">
                <span className="font-bold">المتعهد:</span> {caterer}
              </p>
            )}
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 text-center flex-shrink-0">
            <p className="text-[10px] text-white/80 font-semibold mb-0.5">عدد السجلات</p>
            <p className="text-2xl font-bold tabular-nums">{records.length}</p>
          </div>
          {avgScore !== '—' && (
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 text-center flex-shrink-0">
              <p className="text-[10px] text-white/80 font-semibold mb-0.5">متوسط الدرجة</p>
              <p className="text-2xl font-bold tabular-nums">{avgScore}<span className="text-sm">/10</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Records summary table */}
      <RecordsTable type={type} records={records} accent={meta.color} />

      {/* Detailed mode: per-record "no" answers */}
      {detailed && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl py-2 px-4 text-white font-bold text-sm"
            style={{ background: meta.color }}>
            التفاصيل الفردية — {records.length} سجل
          </div>
          {records.map(rec => (
            <DetailCard key={rec.id} record={rec} type={type} accent={meta.color} />
          ))}
        </div>
      )}
    </article>
  );
}

function RecordsTable({ type, records, accent }) {
  const isMeal = type === 'meal_evaluations';

  return (
    <div className="rounded-2xl border border-[#EDE5DC] overflow-hidden">
      <table className="w-full text-xs">
        <thead style={{ background: accent, color: '#fff' }}>
          <tr>
            <th className="text-right px-4 py-3 font-bold">المراقب</th>
            <th className="text-right px-4 py-3 font-bold">التاريخ</th>
            {isMeal && <th className="text-right px-4 py-3 font-bold">الوجبة</th>}
            <th className="text-center px-4 py-3 font-bold">نعم</th>
            <th className="text-center px-4 py-3 font-bold">لا</th>
            <th className="text-center px-4 py-3 font-bold">الدرجة</th>
            <th className="text-right px-4 py-3 font-bold">وقت الإرسال</th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec, i) => {
            const ans = rec.answers ?? {};
            const yes = Object.values(ans).filter(v => v === 'نعم').length;
            const no  = Object.values(ans).filter(v => v === 'لا').length;
            const s   = getRecordScore(rec);
            return (
              <tr key={rec.id} style={{ background: i % 2 === 0 ? '#fff' : '#FDF8F0' }}
                className="border-b border-[#EDE5DC] last:border-b-0">
                <td className="px-4 py-2.5 font-bold text-[#2D2926]">{rec.observer ?? rec.observerName ?? '—'}</td>
                <td className="px-4 py-2.5 text-[#6D6E71]">{rec.scheduled_date ?? rec.scheduledDate ?? '—'}</td>
                {isMeal && <td className="px-4 py-2.5 text-[#6D6E71]">{MEAL_LABELS[rec.mealType] ?? rec.mealType ?? '—'}</td>}
                <td className="px-4 py-2.5 text-center font-bold tabular-nums" style={{ color: '#386B41' }}>{yes}</td>
                <td className="px-4 py-2.5 text-center font-bold tabular-nums" style={{ color: '#BA1A1A' }}>{no}</td>
                <td className="px-4 py-2.5 text-center font-bold tabular-nums" style={{ color: accent }}>
                  {s == null ? '—' : `${s.toFixed(1)}/10`}
                </td>
                <td className="px-4 py-2.5 text-[#9D8F85] text-[11px]">{formatTime(rec.timestamp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailCard({ record, type, accent }) {
  const allQs = QUESTION_BANK[type] || [];
  const qsById = new Map(allQs.map(q => [String(q.id), q]));
  const ans = record.answers ?? {};
  const noQs = [];
  for (const [k, v] of Object.entries(ans)) {
    if (v !== 'لا') continue;
    const q = qsById.get(String(k));
    if (q) noQs.push(q);
  }
  const score = getRecordScore(record);
  const observer = record.observer ?? record.observerName ?? '—';
  const dateStr = record.scheduled_date ?? record.scheduledDate ?? '—';
  const mealLbl = record.mealType ? (MEAL_LABELS[record.mealType] ?? record.mealType) : '';

  return (
    <div className="rounded-2xl border border-[#EDE5DC] overflow-hidden bg-white">
      {/* Card head */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-[#EDE5DC]"
        style={{ background: '#FDF8F0' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
            style={{ background: accent }}>
            <User size={14} strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#2D2926]">{observer}</p>
            <p className="text-[11px] text-[#9D8F85]">
              {dateStr}{mealLbl ? ` • ${mealLbl}` : ''} • {formatTime(record.timestamp)}
            </p>
          </div>
        </div>
        {score != null && (
          <div className="px-3 py-1 rounded-full text-xs font-bold tabular-nums text-white"
            style={{ background: accent }}>
            {score.toFixed(1)}/10
          </div>
        )}
      </div>

      {/* "No" answers */}
      <div className="p-4">
        {noQs.length > 0 ? (
          <>
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-1 h-4 rounded-full bg-red-500" />
              <p className="text-xs font-bold text-red-700">
                الأسئلة المُجابة بـ «لا» ({noQs.length})
              </p>
            </div>
            <ul className="space-y-2">
              {noQs.map(q => (
                <li key={q.id}
                  className="text-sm text-[#2D2926] bg-red-50 border border-red-200/60 rounded-lg px-3 py-2 leading-relaxed">
                  {q.text}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} strokeWidth={2.25} />
            لا توجد أسئلة مُجابة بـ «لا» في هذا السجل
          </div>
        )}
      </div>
    </div>
  );
}
