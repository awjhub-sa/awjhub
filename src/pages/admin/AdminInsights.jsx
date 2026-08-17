/**
 * AdminInsights.jsx — /admin/insights
 *
 * The season read back as pictures and findings.
 *
 * Every other screen answers about one table. This one is the only place the
 * tables meet: a caterer's readiness beside its violations beside its reports,
 * a criterion's failure rate across every centre, a mash'ar's movement between
 * inspection rounds. That join is the whole point — the numbers exist already,
 * what was missing was somewhere they could be compared.
 *
 * The findings are computed from the same aggregates the charts draw, so the
 * text and the picture can never disagree.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartLineUp, Gauge, Buildings as Building2, Siren, Lightning,
  WarningCircle, CheckCircle, Info, ArrowLeft, Sparkle, Stack as Boxes,
} from '@phosphor-icons/react';
import { db } from '../../lib/db.js';
import PageHeader from '../../components/PageHeader.jsx';
import { Panel, Empty, BarsH, Donut, Trend, HeatGrid, Kpi, arNum as AR } from '../../components/charts/Charts.jsx';
import { readinessStats, catererScorecards, buildFindings } from '../../lib/analytics.js';
import { compareCenters } from '../../lib/reportQuery.js';
import { MINA_SECTIONS } from '../../config/minaQuestions.js';
import { ARAFAT_SECTIONS } from '../../config/arafatQuestions.js';

const NAVY = 'rgb(var(--c-primary))';
const GOLD = 'rgb(var(--c-accent-600))';
const GREEN = '#15803D';
const AMBER = '#B45309';
const RED = '#B91C1C';
const STEEL = '#4E7CB0';

const TONE = {
  alert: { color: RED,   bg: '#FEF2F2', border: '#FECACA', Icon: WarningCircle },
  warn:  { color: AMBER, bg: '#FFFBEB', border: '#FDE68A', Icon: Info },
  info:  { color: STEEL, bg: '#EEF4FB', border: '#C4D8ED', Icon: Info },
  good:  { color: GREEN, bg: '#F0FDF4', border: '#BBF7D0', Icon: CheckCircle },
};

const SOURCES = [
  ['mina',      'mina_readiness'],
  ['arafat',    'arafat_readiness'],
  ['meals',     'meal_evaluations'],
  ['reports',   'reports'],
  ['logistics', 'logistics_requests'],
  ['centers',   'centers'],
  ['caterers',  'caterers'],
];

export default function AdminInsights() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [site, setSite] = useState('mina');

  useEffect(() => {
    (async () => {
      try {
        const pairs = await Promise.all(
          SOURCES.map(async ([key, table]) => [key, await db[table].list()]),
        );
        setData(Object.fromEntries(pairs));
      } catch (ex) { setError(ex.message); }
    })();
  }, []);

  const model = useMemo(() => {
    if (!data) return null;
    const minaStats   = readinessStats(data.mina,   MINA_SECTIONS);
    const arafatStats = readinessStats(data.arafat, ARAFAT_SECTIONS);
    const scorecards  = catererScorecards({
      caterers: data.caterers, centers: data.centers,
      mina: data.mina, arafat: data.arafat,
      reports: data.reports, logistics: data.logistics,
    });
    return {
      minaStats, arafatStats, scorecards,
      findings: buildFindings({
        minaStats, arafatStats, scorecards,
        centers: data.centers, reports: data.reports, logistics: data.logistics,
      }),
    };
  }, [data]);

  if (error) {
    return <div className="p-6 text-sm font-bold text-red-700">{error}</div>;
  }
  if (!model) {
    return (
      <div className="space-y-5" dir="rtl">
        <PageHeader kicker="التحليلات" Icon={ChartLineUp} title="التحليلات"
          subtitle="جارٍ قراءة بيانات الموسم…" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-white border border-line animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { minaStats, arafatStats, scorecards, findings } = model;
  const stats = site === 'mina' ? minaStats : arafatStats;
  const bothEvals = minaStats.evaluations + arafatStats.evaluations;
  const overall = [minaStats.average, arafatStats.average].filter(v => v != null);
  const overallAvg = overall.length ? overall.reduce((a, b) => a + b, 0) / overall.length : null;

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      <PageHeader
        kicker="التحليلات"
        Icon={ChartLineUp}
        title="تحليلات الموسم"
        subtitle="كل ما في النظام مقروءًا كرسوم وقراءات — وكل رقم مرتبط بالشاشة التي يخرج منها"
        stats={[
          { value: AR(bothEvals), label: 'تقييم' },
          { value: overallAvg == null ? '—' : AR(overallAvg.toFixed(1)), label: 'متوسط الجاهزية', tone: 'gold' },
          { value: AR(findings.length), label: 'قراءة' },
        ]}
      />

      {/* ── The numbers that lead ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="متوسط جاهزية منى" Icon={Gauge}
          value={minaStats.average == null ? '—' : AR(minaStats.average.toFixed(1))}
          unit={minaStats.average == null ? '' : ' /١٠'}
          tone={NAVY} hint={`${AR(minaStats.centers)} مركز · ${AR(minaStats.evaluations)} تقييم`} />
        <Kpi label="متوسط جاهزية عرفة" Icon={Gauge}
          value={arafatStats.average == null ? '—' : AR(arafatStats.average.toFixed(1))}
          unit={arafatStats.average == null ? '' : ' /١٠'}
          tone={STEEL} hint={`${AR(arafatStats.centers)} مركز · ${AR(arafatStats.evaluations)} تقييم`} />
        <Kpi label="إجمالي المخالفات" Icon={WarningCircle}
          value={AR(minaStats.violations + arafatStats.violations)}
          tone={RED} hint="إجابات «لا» في المشعرين" />
        <Kpi label="متعهدون تحت القياس" Icon={Building2}
          value={AR(scorecards.length)}
          tone={GOLD} hint={`${AR(scorecards.filter(s => (s.rank ?? 0) >= 8).length)} منهم بتقدير ممتاز`} />
      </div>

      {/* ── Findings ── */}
      <section className="bg-white rounded-2xl border border-line overflow-hidden">
        <header className="px-4 py-3 border-b border-line flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgb(var(--c-accent)/0.15)' }}>
            <Sparkle size={15} weight="fill" className="text-accent-600" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-black text-ink">قراءات تلقائية</h2>
            <p className="text-[11px] font-bold text-muted">
              مستخرجة من أرقام الموسم — كل قراءة تحمل الرقم الذي أنتجها
            </p>
          </div>
        </header>

        {findings.length === 0 ? <Empty label="لا توجد قراءات بعد — أضف تقييمات أولاً" /> : (
          <div className="p-4 grid gap-2.5 md:grid-cols-2">
            {findings.map((f, i) => {
              const t = TONE[f.tone];
              return (
                <button key={i} onClick={() => f.to && navigate(f.to)}
                  className="text-right rounded-xl border p-3 flex items-start gap-2.5 hover:-translate-y-0.5 transition-transform"
                  style={{ background: t.bg, borderColor: t.border }}>
                  <t.Icon size={17} weight="fill" className="mt-0.5 flex-shrink-0" style={{ color: t.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-black" style={{ color: t.color }}>{f.title}</span>
                    <span className="block text-[11px] font-bold text-ink/70 mt-1 leading-relaxed">{f.body}</span>
                  </span>
                  {f.to && <ArrowLeft size={13} className="mt-1 flex-shrink-0" style={{ color: t.color }} />}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Readiness, one mash'ar at a time ── */}
      <div className="flex items-center gap-2">
        {[['mina', 'مشعر منى', minaStats], ['arafat', 'مشعر عرفة', arafatStats]].map(([k, label, s]) => (
          <button key={k} onClick={() => setSite(k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-black border transition-colors ${
              site === k ? 'text-white border-transparent' : 'bg-white text-muted border-line hover:border-primary/40'
            }`}
            style={site === k ? { background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' } : undefined}>
            {label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${site === k ? 'bg-white/25' : 'bg-background'}`}>
              {AR(s.evaluations)}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="حركة الجاهزية" subtitle="متوسط الدرجة في كل جولة تقييم">
          {/* A trend needs two points. With one round the honest thing is to
              say so and show the round, not to draw a line through a single
              value or leave the panel reading "no data". */}
          {stats.byDate.length < 2 ? (
            <div className="py-6 text-center">
              <p className="text-3xl font-black tabular-nums" style={{ color: NAVY }}>
                {stats.average == null ? '—' : AR(stats.average.toFixed(1))}
                <span className="text-base font-bold text-muted"> /١٠</span>
              </p>
              <p className="text-[11px] font-bold text-muted mt-2">
                جولة تقييم واحدة في {stats.byDate[0]?.date || '—'} — الحركة تظهر بعد الجولة الثانية
              </p>
            </div>
          ) : (
            <Trend
              labels={stats.byDate.map(d => d.date.slice(5))}
              max={10}
              series={[{
                name: site === 'mina' ? 'منى' : 'عرفة',
                color: site === 'mina' ? '#1E3A5F' : STEEL,
                points: stats.byDate.map(d => d.avg),
                note: stats.average == null ? '' : `متوسط ${stats.average.toFixed(1)}`,
              }]}
            />
          )}
        </Panel>

        <Panel title="توزيع المراكز على التقدير" subtitle="بحسب آخر تقييم لكل مركز">
          <Donut
            total={stats.centers}
            caption="مركز"
            segments={[
              { label: 'ممتاز', value: stats.bands[0].n, color: GREEN },
              { label: 'مقبول', value: stats.bands[1].n, color: AMBER },
              { label: 'ضعيف',  value: stats.bands[2].n, color: RED },
            ]}
          />
        </Panel>

        <Panel title="أكثر المعايير سقوطاً"
          subtitle="عدد مرات الإجابة بـ«لا» — أعلى ستة">
          <BarsH
            items={stats.failures.slice(0, 6).map(f => ({
              label: `${AR(f.q.id)} · ${f.q.text}`,
              value: f.fails, color: RED, wide: true,
            }))}
          />
        </Panel>

        <Panel title="أدنى المراكز جاهزية" subtitle="آخر درجة مسجّلة — أدنى ستة">
          <BarsH
            max={10}
            unit=""
            items={stats.ranked.slice(-6).reverse().map(x => ({
              label: x.center,
              value: Number(x.score.toFixed(1)),
              color: x.score >= 8 ? GREEN : x.score >= 6 ? AMBER : RED,
            }))}
          />
        </Panel>
      </div>

      {/* ── The matrix ── */}
      <Panel
        title="خريطة المخالفات"
        subtitle="المركز × المعيار — كل مربع كثافته بعدد مرات السقوط"
        right={<span className="text-[10px] font-bold text-muted">أول ٢٠ مركزاً · أعلى ١٢ معياراً</span>}
      >
        <HeatMatrix stats={stats} />
      </Panel>

      {/* ── The join nothing else makes ── */}
      <Panel
        title="بطاقة أداء المتعهدين"
        subtitle="الجاهزية والمخالفات والبلاغات على سطر واحد لكل متعهد"
        right={
          <button onClick={() => navigate('/admin/caterers')}
            className="text-[11px] font-bold text-primary hover:underline">
            سجل المتعهدين
          </button>
        }
      >
        <Scorecards rows={scorecards} />
      </Panel>
    </div>
  );
}

/* ── Centre × criterion ─────────────────────────────────────
   Twenty centres and twelve criteria is two hundred and forty numbers. As a
   grid of tints it is one glance: a dark column is a criterion the season
   fails, a dark row is a centre in trouble. */
function HeatMatrix({ stats }) {
  const cols = stats.failures.slice(0, 12).map(f => ({
    key: String(f.q.id), label: AR(f.q.id), title: f.q.text, id: f.q.id,
  }));

  const centers = [...new Set(stats.records.map(r => r.center).filter(Boolean))]
    .sort(compareCenters).slice(0, 20)
    .map(c => ({ key: String(c), label: String(c) }));

  const count = (row, col) => stats.records.filter(r => {
    if (r.center !== row.key) return false;
    const a = (r.answers || {})[col.id] ?? (r.answers || {})[col.key];
    return a === 'لا';
  }).length;

  return (
    <HeatMatrixGrid cols={cols} rows={centers} valueOf={count} />
  );
}
const HeatMatrixGrid = (props) => (
  <HeatGrid {...props} legend="الأرقام أعلى الأعمدة هي أرقام المعايير — مرّر على أي مربع لقراءته" />
);

/* ── Caterer table ──────────────────────────────────────── */
function Scorecards({ rows }) {
  if (!rows.length) return <Empty label="لا يوجد متعهدون مرتبطون بمراكز بعد" />;
  const shown = rows.filter(r => r.rank != null);
  if (!shown.length) return <Empty label="لا توجد تقييمات كافية لحساب الأداء" />;

  return (
    <div className="overflow-x-auto -m-1 p-1">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-muted border-b border-line">
            <th className="text-right font-black py-2 px-2 w-8">#</th>
            <th className="text-right font-black py-2 px-2">المتعهد</th>
            <th className="text-center font-black py-2 px-2 whitespace-nowrap">المراكز</th>
            <th className="text-center font-black py-2 px-2 whitespace-nowrap">منى</th>
            <th className="text-center font-black py-2 px-2 whitespace-nowrap">عرفة</th>
            <th className="text-center font-black py-2 px-2 whitespace-nowrap">المخالفات</th>
            <th className="text-center font-black py-2 px-2 whitespace-nowrap">البلاغات</th>
            <th className="text-right font-black py-2 px-2 w-40 whitespace-nowrap">الأداء العام</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shown.map((r, i) => {
            const tone = r.rank >= 8 ? GREEN : r.rank >= 6 ? AMBER : RED;
            return (
              <tr key={r.caterer} className="hover:bg-background transition-colors">
                <td className="py-2 px-2 text-muted tabular-nums">{AR(i + 1)}</td>
                <td className="py-2 px-2 font-black text-ink max-w-[16rem] truncate" title={r.caterer}>
                  {r.caterer}
                </td>
                <td className="py-2 px-2 text-center font-bold tabular-nums text-muted">{AR(r.centerCount)}</td>
                <td className="py-2 px-2 text-center font-bold tabular-nums">
                  {r.mina == null ? '—' : AR(r.mina.toFixed(1))}
                </td>
                <td className="py-2 px-2 text-center font-bold tabular-nums">
                  {r.arafat == null ? '—' : AR(r.arafat.toFixed(1))}
                </td>
                <td className="py-2 px-2 text-center font-bold tabular-nums"
                  style={{ color: r.violations > 0 ? RED : undefined }}>
                  {AR(r.violations)}
                </td>
                <td className="py-2 px-2 text-center font-bold tabular-nums text-muted">{AR(r.reports)}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 h-2 rounded-full bg-background overflow-hidden">
                      <span className="block h-full rounded-full"
                        style={{
                          width: `${(r.rank / 10) * 100}%`,
                          background: `linear-gradient(90deg, ${tone}, color-mix(in srgb, ${tone} 55%, #fff))`,
                        }} />
                    </span>
                    <span className="font-black tabular-nums w-8 text-left" style={{ color: tone }}>
                      {AR(r.rank.toFixed(1))}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] font-bold text-muted mt-3 leading-relaxed">
        الأداء العام = متوسط الجاهزية، ناقص أثر المخالفات والبلاغات موزوناً على عدد مراكز المتعهد —
        حتى لا يُحاسَب متعهد كبير على حجمه.
      </p>
    </div>
  );
}
