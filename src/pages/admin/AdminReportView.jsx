import { useEffect, useState, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../lib/db.js';
import {
  toMs, getTotalElapsedMs, fmtDuration,
  TERMINAL_REPORT_STATUSES, TERMINAL_LOGISTICS_STATUSES,
} from '../../lib/statusTracking.js';
import { CENTERS, getCaterer } from '../../config/centers.js';
import { MEAL_QUESTIONS } from '../../config/mealQuestions.js';
import { MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';
import { ARAFAT_ALL_CRITERIA } from '../../config/arafatQuestions.js';
import {
  Printer,
  X,
  FileText,
  Buildings as Building2,
  CalendarBlank as Calendar,
  User,
  WarningCircle as AlertCircle,
  CheckCircle as CheckCircle2,
  ForkKnife as Utensils,
  Mountains as Mountain,
  Warning as AlertTriangle,
  Truck,
} from '@phosphor-icons/react';
const logoSrc = BRAND.logo.color;
import './report-view.css';
import { BRAND } from '../../config/brand.js';

const REPORT_TYPES = {
  meal_evaluations: {
    label: 'تقييم جودة الوجبات', short: 'الوجبات',
    color: 'rgb(var(--c-primary))', accent: 'rgb(var(--c-bg))', border: 'rgb(var(--c-line))',
    Icon: Utensils,
    intro: 'جودة وسلامة الوجبات المُقدّمة في المراكز',
  },
  mina_readiness: {
    label: 'جاهزية مشعر منى', short: 'منى',
    color: '#16A34A', accent: '#F0FDF4', border: '#BBF7D0',
    Icon: Mountain,
    intro: 'جاهزية المطابخ والتجهيزات في مشعر منى',
  },
  arafat_readiness: {
    label: 'جاهزية مشعر عرفة', short: 'عرفة',
    color: '#3D6795', accent: '#EEF4FB', border: '#C4D8ED',
    Icon: Mountain,
    intro: 'جاهزية المطابخ والتجهيزات في مشعر عرفة',
  },
  reports: {
    label: 'البلاغات الميدانية', short: 'البلاغات',
    color: '#DC2626', accent: '#FEF2F2', border: '#FECACA',
    Icon: AlertTriangle,
    intro: 'البلاغات والمشكلات المُسجَّلة في المراكز',
  },
  logistics_requests: {
    label: 'طلبات الإسناد', short: 'الإسناد',
    color: '#4E7CB0', accent: '#EFF6FF', border: '#BFDBFE',
    Icon: Truck,
    intro: 'طلبات الدعم اللوجستي للوجبات والمياه',
  },
};

const QUESTION_BANK = {
  meal_evaluations: MEAL_QUESTIONS,
  mina_readiness:   MINA_ALL_CRITERIA,
  arafat_readiness: ARAFAT_ALL_CRITERIA,
};

const MEAL_LABELS = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };

const REPORT_TYPE_LABELS = {
  water: 'تسرب مياه', electric: 'عطل كهربائي', crowd: 'ازدحام حرج',
  food: 'مشكلة غذائية', medical: 'حالة طبية طارئة', security: 'بلاغ أمني',
  fire: 'حريق / دخان', other: 'بلاغ آخر', shortage: 'نقص في الكميات',
  delay: 'تأخر في التوزيع', quality: 'مشكلة في الجودة', hygiene: 'مخالفة صحية',
};
const SEVERITY_LABELS = {
  high: 'عالية', urgent: 'عاجل', medium: 'متوسطة', low: 'منخفضة',
};
const REPORT_STATUS_LABELS = {
  pending: 'قيد الانتظار', in_progress: 'جارٍ التنفيذ', resolved: 'تم الحل',
};
const SUPPORT_LABELS = {
  internal: 'داخلي', external: 'خارجي', both: 'مشترك',
};
const LOGISTICS_CATEGORY_LABELS = { meals: 'وجبات', water: 'مياه' };
const LOGISTICS_STATUS_LABELS = {
  pending: 'قيد الانتظار', approved: 'معتمد',
  delivered: 'تم التسليم', rejected: 'مرفوض',
};

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

/* Convert "٦ ذو الحجة ١٤٤٧" → 6. Returns null if not parseable. */
function dhuDayFromLabel(label) {
  if (!label) return null;
  const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  const m = String(label).trim().match(/^[٠-٩\d]+/);
  if (!m) return null;
  let n = 0;
  for (const ch of m[0]) {
    const idx = arabicDigits.indexOf(ch);
    n = n * 10 + (idx >= 0 ? idx : parseInt(ch, 10));
  }
  return Number.isFinite(n) ? n : null;
}

/* Returns day-of-month in Dhul Hijjah for a timestamp (Riyadh tz), or null. */
function dhuDayFromTimestamp(ts) {
  if (!ts) return null;
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', timeZone: 'Asia/Riyadh',
    });
    const parts = fmt.formatToParts(d);
    const day   = parseInt(parts.find(p => p.type === 'day')?.value,   10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
    return month === 12 ? day : null;
  } catch { return null; }
}

/* centerFilter is an array of exact center IDs (empty = all centers).
   dateFilter matches either the legacy scheduledDate string OR the
   timestamp's Hijri day in Riyadh. */
async function fetchReportData({ centerFilter, dateFilter, types }) {
  const result = {};
  const wantCenters = Array.isArray(centerFilter) && centerFilter.length > 0
    ? new Set(centerFilter)
    : null;
  const wantDay = dateFilter ? dhuDayFromLabel(dateFilter) : null;
  await Promise.all(types.map(async (type) => {
    let docs = await db[type].list();
    if (wantCenters) {
      docs = docs.filter(d => wantCenters.has(d.center));
    }
    if (dateFilter) {
      docs = docs.filter(d => {
        if ((d.scheduledDate ?? '') === dateFilter) return true;
        if (wantDay != null && dhuDayFromTimestamp(d.timestamp) === wantDay) return true;
        return false;
      });
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

  /* `center` URL param can be comma-separated for multi-select.
     Missing/empty = all centers. */
  const rawCenter    = params.get('center') || '';
  const centerFilter = rawCenter ? rawCenter.split(',').filter(Boolean) : [];
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
  }, [rawCenter, dateFilter, params.get('types')]);

  /* ── Derived: centers in scope ── */
  const centers = useMemo(() => {
    if (!data) return [];
    const sortByNum = (a, b) => {
      const na = parseInt((a ?? '').replace(/\D/g, '')) || 0;
      const nb = parseInt((b ?? '').replace(/\D/g, '')) || 0;
      return na - nb;
    };
    if (centerFilter.length > 0) return [...centerFilter].sort(sortByNum);
    const set = new Set();
    types.forEach(t => (data[t] || []).forEach(d => d.center && set.add(d.center)));
    return [...set].sort(sortByNum);
  }, [data, rawCenter, types]);

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
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-[0_4px_16px_rgb(var(--c-primary)/0.35)] hover:shadow-[0_6px_24px_rgb(var(--c-primary)/0.45)] transition-shadow"
        style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}
      >
        <Printer size={16} weight="bold" />
        اطبع / احفظ PDF
      </button>
      <button
        onClick={() => window.close()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-white text-muted font-bold text-sm hover:bg-background hover:border-primary transition-colors"
      >
        <X size={14} weight="bold" />
        إغلاق
      </button>
      <div className="text-xs text-muted mr-auto leading-relaxed max-w-md">
        💡 عند الطباعة، فعّل خيار <span className="font-bold text-primary">«Background graphics»</span> في إعدادات المتصفح ليطبع التنسيق الملوّن.
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <article className="report-page-card flex items-center justify-center text-center">
      <div>
        <div className="w-12 h-12 border-4 border-line border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted text-lg font-medium">جارٍ تحضير التقرير...</p>
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
          <AlertCircle size={26} className="text-red-500" weight="regular" />
        </div>
        <p className="text-muted text-base font-medium">{message}</p>
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
  /* Multi-select friendly labels for the cover page */
  const centerLabel = centerFilter.length === 0
    ? 'جميع المراكز'
    : centerFilter.length === 1
      ? centerFilter[0]
      : centerFilter.length <= 4
        ? centerFilter.join(' • ')
        : `${centerFilter.length} مراكز محددة`;
  const contractor = centerFilter.length === 1
    ? (CENTERS.find(c => c.id === centerFilter[0])?.caterer ?? '—')
    : '—';

  return (
    <article className="report-page-card">
      {/* Top brand band */}
      <div
        className="rounded-2xl p-7 text-white shadow-md relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)) 0%, rgb(var(--c-primary)) 60%, rgb(var(--c-primary-700)) 100%)' }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(40%, -50%)' }} />
        <div className="flex items-center gap-5 relative">
          <div className="bg-white rounded-2xl p-3 shadow-md flex-shrink-0">
            <img src={logoSrc} alt={BRAND.companyName} className="w-20 h-auto" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">{BRAND.companyName}</h1>
            <p className="text-white/85 text-sm font-medium"></p>
          </div>
        </div>
      </div>

      {/* Center title */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
        <p className="text-sm text-muted font-semibold mb-2">تقرير</p>
        <h2 className="text-4xl font-bold text-ink mb-3">الرقابة الميدانية</h2>
        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <p className="text-base text-primary font-bold"></p>
          <span className="w-2 h-2 rounded-full bg-primary" />
        </div>

        {/* Filters summary card */}
        <div className="bg-background border-2 border-line rounded-2xl p-6 max-w-xl w-full text-right shadow-sm">
          <div className="space-y-3.5">
            <Row Icon={Building2} label="المركز" value={centerLabel} />
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
        <StatBlock label="إجمالي السجلات" value={totals.total} accent="rgb(var(--c-primary))" />
        {types.map(t => (
          <StatBlock
            key={t}
            label={REPORT_TYPES[t]?.label.replace('جاهزية ', '').replace('تقييم جودة الوجبات', 'الوجبات').replace('مشعر ', '')}
            value={totals.perType[t] ?? 0}
            accent={REPORT_TYPES[t]?.color || 'rgb(var(--c-primary))'}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-line pt-4 text-xs text-muted flex justify-between">
        <span>
          <span className="font-bold text-ink">تاريخ الإصدار:</span> {generatedAt}
        </span>
        <span className="font-bold text-primary">{BRAND.tagline}</span>
      </div>
    </article>
  );
}

function Row({ Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-primary" weight="regular" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted font-semibold">{label}</p>
        <p className="text-sm text-ink font-bold leading-snug">{value || '—'}</p>
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
      <p className="text-[11px] text-muted font-semibold mb-1">{label}</p>
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
            <img src={logoSrc} alt={BRAND.companyName} className="w-16 h-auto" />
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
            <TypeIcon size={56} className="text-white" weight="regular" />
          </div>
        </div>

        <p className="text-sm text-muted font-semibold mb-2">قسم</p>
        <h1
          className="text-6xl md:text-7xl leading-none font-bold mb-3"
          style={{ color: meta.color }}
        >
          {meta.short}
        </h1>
        <p className="text-base text-muted font-medium max-w-md">{meta.intro}</p>

        {/* Stats strip */}
        <div className="mt-10 bg-white border-2 rounded-2xl px-6 py-5 inline-flex gap-8 items-center shadow-sm"
          style={{ borderColor: `${meta.color}33` }}>
          <div className="text-center">
            <p className="text-xs text-muted font-semibold mb-1">عدد السجلات</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: meta.color }}>{totalRecs}</p>
          </div>
          <div className="w-px h-14" style={{ background: `${meta.color}22` }} />
          <div className="text-center">
            <p className="text-xs text-muted font-semibold mb-1">عدد المراكز</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: meta.color }}>{totalCenters}</p>
          </div>
          {avgScore != null && (
            <>
              <div className="w-px h-14" style={{ background: `${meta.color}22` }} />
              <div className="text-center">
                <p className="text-xs text-muted font-semibold mb-1">متوسط الدرجة</p>
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
        <div className="rounded-2xl border border-line bg-background/50 p-4 mb-4">
          <p className="text-xs text-muted font-bold mb-2.5 flex items-center gap-1.5">
            <Building2 size={12} className="text-primary" weight="regular" />
            المراكز المشمولة في هذا القسم
          </p>
          <div className="flex flex-wrap gap-1.5">
            {centers.map(c => (
              <span key={c}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full border text-ink bg-white"
                style={{ borderColor: `${meta.color}40` }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-line pt-4 text-xs text-muted flex justify-between">
        <span className="font-bold text-primary">{BRAND.productName}</span>
        <span></span>
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

  const isScorable = type === 'meal_evaluations' || type === 'mina_readiness' || type === 'arafat_readiness';
  const avgScore = isScorable && records.length
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

      {/* Detailed mode: per-record "no" answers — only for types with a question bank */}
      {detailed && QUESTION_BANK[type] && (
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
  if (type === 'reports') return <ReportsTable records={records} accent={accent} />;
  if (type === 'logistics_requests') return <LogisticsTable records={records} accent={accent} />;

  const isMeal = type === 'meal_evaluations';

  return (
    <div className="rounded-2xl border border-line overflow-hidden">
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
              <tr key={rec.id} style={{ background: i % 2 === 0 ? '#fff' : 'rgb(var(--c-bg))' }}
                className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5 font-bold text-ink">{rec.observer ?? rec.observerName ?? '—'}</td>
                <td className="px-4 py-2.5 text-muted">{rec.scheduled_date ?? rec.scheduledDate ?? '—'}</td>
                {isMeal && <td className="px-4 py-2.5 text-muted">{MEAL_LABELS[rec.mealType] ?? rec.mealType ?? '—'}</td>}
                <td className="px-4 py-2.5 text-center font-bold tabular-nums" style={{ color: 'rgb(var(--c-success))' }}>{yes}</td>
                <td className="px-4 py-2.5 text-center font-bold tabular-nums" style={{ color: 'rgb(var(--c-error))' }}>{no}</td>
                <td className="px-4 py-2.5 text-center font-bold tabular-nums" style={{ color: accent }}>
                  {s == null ? '—' : `${s.toFixed(1)}/10`}
                </td>
                <td className="px-4 py-2.5 text-muted text-[11px]">{formatTime(rec.timestamp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="text-muted font-bold shrink-0">{label}:</span>
      <span className={`text-ink font-medium ${mono ? 'tabular-nums' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

function ReportCard({ rec, accent }) {
  const closedMs = toMs(rec.closedAt);
  const isClosed = TERMINAL_REPORT_STATUSES.includes(rec.status) && closedMs != null;
  const elapsedMs = getTotalElapsedMs(rec, TERMINAL_REPORT_STATUSES);

  return (
    <div className="rounded-2xl border border-line overflow-hidden bg-white"
      style={{ breakInside: 'avoid' }}>
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: `${accent}12`, borderBottom: `1px solid ${accent}25` }}>
        <span className="font-black tabular-nums text-sm" style={{ color: accent }}>
          {rec.reportNumber ?? '—'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border"
          style={{ background: '#fff', borderColor: `${accent}40`, color: accent }}>
          {REPORT_STATUS_LABELS[rec.status] ?? '—'}
        </span>
      </div>

      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <InfoRow label="المراقب"   value={rec.observer} />
        <InfoRow label="النوع"     value={REPORT_TYPE_LABELS[rec.reportType] ?? rec.reportType} />
        <InfoRow label="الخطورة"   value={SEVERITY_LABELS[rec.severity]} />
        <InfoRow label="المركز"    value={rec.center} />
        <InfoRow label="جاء في" value={formatTime(rec.timestamp)} mono />
        {isClosed && (
          <InfoRow label="تاريخ الإغلاق" value={formatTime(rec.closedAt)} mono />
        )}
        <InfoRow label={isClosed ? 'المدة الكاملة (مغلق)' : 'المدة حتى الآن'}
                 value={fmtDuration(elapsedMs)} mono />
      </div>

      {rec.description && (
        <div className="px-4 pb-4">
          <p className="text-[10px] font-bold text-muted mb-1">الوصف</p>
          <p className="text-[12px] text-ink leading-relaxed whitespace-pre-wrap bg-bg border border-line rounded-xl p-2.5">
            {rec.description}
          </p>
        </div>
      )}
    </div>
  );
}

function ReportsTable({ records, accent }) {
  return (
    <div className="space-y-3">
      {records.map(rec => <ReportCard key={rec.id} rec={rec} accent={accent} />)}
    </div>
  );
}

function LogisticsCard({ rec, accent }) {
  const closedMs = toMs(rec.closedAt);
  const isClosed = TERMINAL_LOGISTICS_STATUSES.includes(rec.status) && closedMs != null;
  const elapsedMs = getTotalElapsedMs(rec, TERMINAL_LOGISTICS_STATUSES);

  return (
    <div className="rounded-2xl border border-line overflow-hidden bg-white"
      style={{ breakInside: 'avoid' }}>
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: `${accent}12`, borderBottom: `1px solid ${accent}25` }}>
        <span className="font-black tabular-nums text-sm" style={{ color: accent }}>
          {rec.requestNumber ?? '—'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border"
          style={{ background: '#fff', borderColor: `${accent}40`, color: accent }}>
          {LOGISTICS_STATUS_LABELS[rec.status] ?? '—'}
        </span>
      </div>

      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <InfoRow label="المراقب"   value={rec.observer} />
        <InfoRow label="الفئة"     value={LOGISTICS_CATEGORY_LABELS[rec.category] ?? rec.category} />
        <InfoRow label="نوع الإسناد" value={SUPPORT_LABELS[rec.supportType] ?? rec.supportType} />
        <InfoRow label="المركز"    value={rec.center} />
        {rec.qtyInternal != null && <InfoRow label="كمية داخلي" value={rec.qtyInternal} mono />}
        {rec.qtyExternal != null && <InfoRow label="كمية خارجي" value={rec.qtyExternal} mono />}
        {rec.reportNumber && <InfoRow label="بلاغ مرتبط" value={`#${rec.reportNumber}`} mono />}
        <InfoRow label="جاء في" value={formatTime(rec.timestamp)} mono />
        {isClosed && (
          <InfoRow label="تاريخ الإغلاق" value={formatTime(rec.closedAt)} mono />
        )}
        <InfoRow label={isClosed ? 'المدة الكاملة (مغلق)' : 'المدة حتى الآن'}
                 value={fmtDuration(elapsedMs)} mono />
      </div>

      {rec.notes && (
        <div className="px-4 pb-4">
          <p className="text-[10px] font-bold text-muted mb-1">ملاحظات</p>
          <p className="text-[12px] text-ink leading-relaxed whitespace-pre-wrap bg-bg border border-line rounded-xl p-2.5">
            {rec.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function LogisticsTable({ records, accent }) {
  return (
    <div className="space-y-3">
      {records.map(rec => <LogisticsCard key={rec.id} rec={rec} accent={accent} />)}
    </div>
  );
}

function DetailCard({ record, type, accent }) {
  const allQs = QUESTION_BANK[type] || [];
  const qsById = new Map(allQs.map(q => [String(q.id), q]));
  const ans = record.answers ?? {};
  const photos = ans.__photos ?? {};
  const detailsMap = ans.__details ?? {};
  const score = getRecordScore(record);
  const observer = record.observer ?? record.observerName ?? '—';
  const dateStr = record.scheduled_date ?? record.scheduledDate ?? '—';
  const mealLbl = record.mealType ? (MEAL_LABELS[record.mealType] ?? record.mealType) : '';

  const yesCount = allQs.filter(q => ans[q.id] === 'نعم').length;
  const noCount  = allQs.filter(q => ans[q.id] === 'لا').length;

  return (
    <div className="rounded-2xl border border-line overflow-hidden bg-white"
      style={{ breakInside: 'avoid' }}>
      {/* Card head */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-line"
        style={{ background: 'rgb(var(--c-bg))' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
            style={{ background: accent }}>
            <User size={14} weight="bold" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">{observer}</p>
            <p className="text-[11px] text-muted">
              {dateStr}{mealLbl ? ` • ${mealLbl}` : ''} • {formatTime(record.timestamp)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 tabular-nums">
            ✓ {yesCount}
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 tabular-nums">
            ✗ {noCount}
          </span>
          {score != null && (
            <div className="px-3 py-1 rounded-full text-xs font-bold tabular-nums text-white"
              style={{ background: accent }}>
              {score.toFixed(1)}/10
            </div>
          )}
        </div>
      </div>

      {/* All questions with answers + photos */}
      <div className="p-4 space-y-2">
        {allQs.map(q => {
          const a = ans[q.id];
          const photoUrl = photos[q.id];
          const detail = detailsMap[q.id];
          const isYes = a === 'نعم';
          const isNo  = a === 'لا';
          return (
            <div key={q.id}
              className={`rounded-lg px-3 py-2.5 border ${
                isYes ? 'bg-green-50/40 border-green-200/60'
              : isNo  ? 'bg-red-50/40 border-red-200/60'
              :         'bg-bg border-line'
              }`}
              style={{ breakInside: 'avoid' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="inline-block text-[10px] font-black px-1.5 py-0.5 rounded-md text-white tabular-nums shrink-0 mt-0.5"
                    style={{ background: accent }}>
                    {q.id}
                  </span>
                  <p className="text-[12px] text-ink leading-relaxed">{q.text}</p>
                </div>
                {a && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full shrink-0 ${
                    isYes ? 'bg-green-500 text-white'
                  : isNo  ? 'bg-red-500 text-white'
                  :         'bg-gray-200 text-gray-700'
                  }`}>
                    {isYes && <CheckCircle2 size={11} weight="bold" />}
                    {a}
                  </span>
                )}
              </div>
              {detail && (
                <p className="mt-2 text-[11px] text-muted bg-white border border-line rounded px-2 py-1 leading-snug">
                  {detail}
                </p>
              )}
              {photoUrl && (
                <a href={photoUrl} target="_blank" rel="noreferrer"
                  className="mt-2 block">
                  <img src={photoUrl} alt={`q${q.id}`}
                    className="rounded-lg border border-line max-h-48 object-cover" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
