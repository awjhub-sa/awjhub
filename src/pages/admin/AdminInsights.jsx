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
  ChartLineUp, Gauge, Buildings as Building2,
  WarningCircle, CheckCircle, Info, ArrowLeft, Sparkle,
  TrendUp, ChartDonut, Ranking, MapTrifold, ArrowsLeftRight,
  ListChecks, ClipboardText, FileText, Bank,
} from '@phosphor-icons/react';
import { db } from '../../lib/db.js';
import PageHeader from '../../components/PageHeader.jsx';
import FilterChip from '../../components/FilterChip.jsx';
import { Panel, StatTile, Pill } from '../../components/ui/index.jsx';
import { Empty, BarsH, Donut, Trend, arNum as AR } from '../../components/charts/Charts.jsx';
import {
  readinessStats, catererScorecards, buildFindings, roundComparison, operationsStats,
} from '../../lib/analytics.js';
import { compareCenters } from '../../lib/reportQuery.js';
import { MINA_SECTIONS } from '../../config/minaQuestions.js';
import { ARAFAT_SECTIONS } from '../../config/arafatQuestions.js';
import DataTable from '../../components/DataTable.jsx';

const NAVY = 'rgb(var(--c-primary))';
const GOLD = 'rgb(var(--c-accent-600))';
const GREEN = '#15803D';
const AMBER = '#B45309';
const RED = '#B91C1C';
const STEEL = '#4E7CB0';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const TONE = {
  alert: { color: RED,   Icon: WarningCircle },
  warn:  { color: AMBER, Icon: Info },
  info:  { color: STEEL, Icon: Info },
  good:  { color: GREEN, Icon: CheckCircle },
};

/* The keys assigned_tasks stores; the screen that writes them keeps the same
   list, and a raw key on an analytics page is a leak of the schema. */
const TASK_LABEL = {
  meal_evaluation: 'تقييم الوجبات',
  mina_readiness: 'جاهزية منى',
  arafat_readiness: 'جاهزية عرفة',
};

const SOURCES = [
  ['mina',      'mina_readiness'],
  ['arafat',    'arafat_readiness'],
  ['meals',     'meal_evaluations'],
  ['reports',   'reports'],
  ['logistics', 'logistics_requests'],
  ['phases',    'meal_phases'],
  ['tasks',     'assigned_tasks'],
  ['done',      'task_completions'],
  ['forms',     'form_assignments'],
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
    const rounds = {
      mina:   roundComparison(data.mina),
      arafat: roundComparison(data.arafat),
    };
    const ops = operationsStats({
      phases: data.phases, tasks: data.tasks, completions: data.done,
      forms: data.forms, centers: data.centers, caterers: data.caterers,
    });
    const scorecards  = catererScorecards({
      caterers: data.caterers, centers: data.centers,
      mina: data.mina, arafat: data.arafat,
      reports: data.reports, logistics: data.logistics,
    });
    return {
      minaStats, arafatStats, rounds, ops, scorecards,
      findings: buildFindings({
        minaStats, arafatStats, rounds, ops, scorecards,
        centers: data.centers, reports: data.reports, logistics: data.logistics,
      }),
    };
  }, [data]);

  if (error) {
    return <div className="p-6 text-[13px] font-bold text-error">{error}</div>;
  }
  if (!model) {
    return (
      <div className="space-y-5" dir="rtl">
        <PageHeader kicker="التحليلات" Icon={ChartLineUp} title="التحليلات"
          subtitle="جارٍ قراءة بيانات الموسم…" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[104px] rounded-[14px] bg-white border border-line animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { minaStats, arafatStats, rounds, ops, scorecards, findings } = model;
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
        stats={[
          { value: AR(bothEvals), label: 'تقييم' },
          { value: overallAvg == null ? '—' : AR(overallAvg.toFixed(1)), label: 'متوسط الجاهزية', tone: 'gold' },
          { value: AR(findings.length), label: 'قراءة' },
        ]}
      />

      {/* ── The numbers that lead ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* The two averages are summaries of a screen that already exists, so
            they open it. */}
        <StatTile label="متوسط جاهزية منى" Icon={Gauge} color={NAVY}
          value={minaStats.average == null ? '—' : <>{AR(minaStats.average.toFixed(1))}<span className="text-[15px] font-bold text-muted"> /١٠</span></>}
          sub={`${AR(minaStats.centers)} مركز · ${AR(minaStats.evaluations)} تقييم`}
          onClick={() => navigate('/admin/readiness/mina')} />
        <StatTile label="متوسط جاهزية عرفة" Icon={Gauge} color={STEEL}
          value={arafatStats.average == null ? '—' : <>{AR(arafatStats.average.toFixed(1))}<span className="text-[15px] font-bold text-muted"> /١٠</span></>}
          sub={`${AR(arafatStats.centers)} مركز · ${AR(arafatStats.evaluations)} تقييم`}
          onClick={() => navigate('/admin/readiness/arafat')} />
        {/* Deliberately inert: this counts failed criteria across both
            mash'ars, and no screen holds that joined list — /admin/violations
            is the notices the office issues, a different thing entirely. */}
        <StatTile label="إجمالي المخالفات" Icon={WarningCircle} color={RED}
          value={AR(minaStats.violations + arafatStats.violations)} />
        <StatTile label="متعهدون تحت القياس" Icon={Building2} color={GOLD}
          value={AR(scorecards.length)}
          sub={`${AR(scorecards.filter(s => (s.rank ?? 0) >= 8).length)} منهم بتقدير ممتاز`}
          onClick={() => navigate('/admin/caterers')} />
      </div>

      {/* ── Findings ── */}
      <Panel Icon={Sparkle} color={GOLD} title="قراءات تلقائية">
        {findings.length === 0 ? <Empty label="لا توجد قراءات بعد" /> : (
          <div className="p-4 grid gap-2.5 md:grid-cols-2">
            {findings.map((f, i) => {
              const t = TONE[f.tone];
              return (
                <button key={i} onClick={() => f.to && navigate(f.to)}
                  className="text-start rounded-[11px] border p-3 flex items-start gap-2.5
                             transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                  style={{ background: tint(t.color, 12), borderColor: tint(t.color, 28) }}>
                  <t.Icon size={17} weight="duotone" className="mt-0.5 shrink-0" style={{ color: t.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold" style={{ color: t.color }}>{f.title}</span>
                    <span className="block text-[11.5px] font-medium text-ink/75 mt-1 leading-relaxed">{f.body}</span>
                  </span>
                  {f.to && <ArrowLeft size={13} weight="bold" className="mt-1 shrink-0" style={{ color: t.color }} />}
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ── Readiness, one mash'ar at a time ── */}
      <div className="flex items-center gap-2">
        {[['mina', 'مشعر منى', minaStats, NAVY], ['arafat', 'مشعر عرفة', arafatStats, STEEL]].map(([k, label, s, c]) => (
          <FilterChip key={k} active={site === k} onClick={() => setSite(k)}
            color={c} count={AR(s.evaluations)}>
            {label}
          </FilterChip>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel Icon={TrendUp} color={site === 'mina' ? NAVY : STEEL} title="حركة الجاهزية">
          {/* A trend needs two points. With one round the honest thing is to
              say so and show the round, not to draw a line through a single
              value or leave the panel reading "no data". */}
          <div className="p-4">
            {stats.byDate.length < 2 ? (
              <div className="py-6 text-center">
                <p className="text-[34px] font-extrabold tabular-nums leading-none" style={{ color: NAVY }}>
                  {stats.average == null ? '—' : AR(stats.average.toFixed(1))}
                  <span className="text-[16px] font-bold text-muted"> /١٠</span>
                </p>
                <p className="text-[11.5px] font-medium text-muted mt-3">
                  جولة تقييم واحدة في {stats.byDate[0]?.date || '—'}
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
          </div>
        </Panel>

        <Panel Icon={ChartDonut} color={GREEN} title="توزيع المراكز على التقدير">
          <div className="p-4">
            <Donut
              total={stats.centers}
              caption="مركز"
              segments={[
                { label: 'ممتاز', value: stats.bands[0].n, color: GREEN },
                { label: 'مقبول', value: stats.bands[1].n, color: AMBER },
                { label: 'ضعيف',  value: stats.bands[2].n, color: RED },
              ]}
            />
          </div>
        </Panel>

        <Panel Icon={WarningCircle} color={RED} title="أكثر المعايير سقوطاً">
          <div className="p-4">
            <BarsH
              items={stats.failures.slice(0, 6).map(f => ({
                label: `${AR(f.q.id)} · ${f.q.text}`,
                value: f.fails, color: RED, wide: true,
              }))}
            />
          </div>
        </Panel>

        <Panel Icon={Ranking} color={AMBER} title="أدنى المراكز جاهزية">
          <div className="p-4">
            <BarsH
              max={10}
              unit=""
              items={stats.ranked.slice(-6).reverse().map(x => ({
                label: x.center,
                value: Number(x.score.toFixed(1)),
                color: x.score >= 8 ? GREEN : x.score >= 6 ? AMBER : RED,
              }))}
            />
          </div>
        </Panel>
      </div>

      {/* ── Where every centre stands, in one look ── */}
      <Panel
        Icon={MapTrifold}
        color={site === 'mina' ? NAVY : STEEL}
        title="خريطة الجاهزية"
        right={
          <div className="flex items-center gap-3 flex-wrap">
            {[['ممتاز ٨+', GREEN], ['مقبول ٦–٨', AMBER], ['ضعيف <٦', RED], ['بلا تقييم', '#94A3B8']].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} /> {l}
              </span>
            ))}
          </div>
        }
      >
        <div className="p-4">
          <ReadinessMap stats={stats} allCenters={data.centers} onPick={() => navigate(
            site === 'mina' ? '/admin/readiness/mina' : '/admin/readiness/arafat')} />
        </div>
      </Panel>

      {/* ── Did the follow-up work ── */}
      <RoundPanel cmp={site === 'mina' ? rounds.mina : rounds.arafat} label={site === 'mina' ? 'منى' : 'عرفة'} />

      {/* ── The rest of the system ──
          Readiness is the loudest section, not the only one. These four say
          where the season stands outside the two inspections — and say plainly
          when a section has not started, because a decision-maker cannot tell
          an empty chart from an all-clear. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel Icon={ListChecks} color={NAVY} title="متابعة المراحل"
          right={<Link to="/admin/phases" nav={navigate} />}>
          <div className="p-4">
            {!ops.phases.active ? (
              <NotStarted
                what="لم تُسجَّل أي مرحلة بعد"
                why="اللوحة تمتلئ أول ما يبدأ الميدان بتسجيل التجهيز والطبخ والتوزيع." />
            ) : (
              <>
                <BarsH
                  max={ops.phases.total}
                  items={ops.phases.steps.map((s, i) => ({
                    label: s.label, value: s.n, color: [NAVY, AMBER, GREEN][i],
                  }))}
                />
                <p className="text-[11px] font-medium text-muted mt-3">
                  من {AR(ops.phases.total)} سجل على {AR(ops.phases.centers)} مركز
                </p>
              </>
            )}
          </div>
        </Panel>

        <Panel Icon={ClipboardText} color={STEEL} title="المهام المسندة"
          right={<Link to="/admin/tasks" nav={navigate} />}>
          <div className="p-4">
            {!ops.tasks.active ? (
              <NotStarted what="لا توجد مهام مسنَدة" why="أسند مهمة من شاشة إسناد المهام لتظهر هنا." />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MiniStat label="إسناد" value={AR(ops.tasks.assignments)} color={NAVY} />
                  <MiniStat label="مركز مستهدف" value={AR(ops.tasks.targeted)} color={STEEL} />
                  <MiniStat label="إنجاز مسجّل" value={AR(ops.tasks.completions)}
                    color={ops.tasks.completions ? GREEN : RED} />
                </div>
                {ops.tasks.byType.length > 0 && (
                  <BarsH items={ops.tasks.byType.slice(0, 5).map(t => ({
                    label: TASK_LABEL[t.label] || t.label, value: t.n, color: STEEL, wide: true,
                  }))} />
                )}
                {ops.tasks.completions === 0 && (
                  <p className="text-[11.5px] font-bold mt-3" style={{ color: RED }}>
                    لا إنجاز مسجّل مقابل هذه المهام حتى الآن.
                  </p>
                )}
              </>
            )}
          </div>
        </Panel>

        <Panel Icon={FileText} color={GOLD} title="التزام المتعهدين بالنماذج"
          right={<Link to="/admin/forms" nav={navigate} />}>
          <div className="p-4">
            {!ops.forms.active ? (
              <NotStarted what="لا توجد نماذج مُسنَدة" why="أسند نموذجاً لمتعهد ليبدأ قياس الالتزام." />
            ) : (
              <Donut
                total={ops.forms.onTime} caption="٪ التزام"
                segments={[
                  { label: 'مقبول',            value: ops.forms.accepted, color: GREEN },
                  { label: 'مُسلَّم قيد المراجعة', value: Math.max(0, ops.forms.submitted - ops.forms.accepted), color: STEEL },
                  { label: 'مُعاد للتعديل',      value: ops.forms.returned, color: AMBER },
                  { label: 'متأخر',            value: ops.forms.overdue,  color: RED },
                  { label: 'بانتظار المتعهد',   value: Math.max(0, ops.forms.total - ops.forms.submitted - ops.forms.overdue - ops.forms.returned), color: '#CBD5E1' },
                ].filter(s => s.value > 0)}
              />
            )}
          </div>
        </Panel>

        <Panel Icon={Building2} color={GREEN} title="تغطية المراكز بالمتعهدين"
          right={<Link to="/admin/centers" nav={navigate} />}>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MiniStat label="مركز" value={AR(ops.coverage.total)} color={NAVY} />
              <MiniStat label="مُسنَد" value={AR(ops.coverage.assigned)} color={GREEN} />
              <MiniStat label="بلا متعهد" value={AR(ops.coverage.unassigned)}
                color={ops.coverage.unassigned ? RED : GREEN} />
            </div>
            <BarsH
              max={ops.coverage.total}
              items={[
                { label: 'مراكز مُسنَدة', value: ops.coverage.assigned, color: GREEN },
                { label: 'بلا متعهد',    value: ops.coverage.unassigned, color: RED },
              ]}
            />
            <p className="text-[11px] font-medium text-muted mt-3">
              {AR(ops.coverage.caterers)} متعهد مسجّل في النظام
            </p>
          </div>
        </Panel>
      </div>

      {/* فرضية الوزارة has no store behind it yet; saying so is more use than
          leaving the reader to wonder why it is missing. */}
      <Panel Icon={Bank} color={NAVY} title="فرضية الوزارة"
        right={<Link to="/admin/readiness/drill" nav={navigate} />}>
        <div className="p-4">
          <NotStarted
            what="القسم لم يُفعَّل بعد"
            why="لا يوجد مصدر بيانات للفرضيات حتى الآن — ما إن تُسجَّل أول فرضية حتى تدخل هنا مع بقية الأقسام." />
        </div>
      </Panel>

      {/* ── The join nothing else makes ── */}
      <Panel
        Icon={Ranking}
        color={GOLD}
        title="بطاقة أداء المتعهدين"
        right={
          <button onClick={() => navigate('/admin/caterers')}
            className="text-[11.5px] font-bold text-muted hover:text-primary transition-colors px-2 py-1 rounded-lg">
            سجل المتعهدين
          </button>
        }
      >
        <div className="p-4">
          <Scorecards rows={scorecards} />
        </div>
      </Panel>
    </div>
  );
}

/* ── Small parts ────────────────────────────────────────── */
const Link = ({ to, nav }) => (
  <button onClick={() => nav(to)}
    className="text-[11.5px] font-bold text-muted hover:text-primary transition-colors px-2 py-1 rounded-lg">
    افتح القسم
  </button>
);

const MiniStat = ({ label, value, color }) => (
  <div className="rounded-[10px] border p-2.5 text-center"
    style={{ background: tint(color, 12), borderColor: tint(color, 28) }}>
    <p className="text-[20px] font-extrabold tabular-nums leading-none" style={{ color }}>{value}</p>
    <p className="text-[10.5px] font-medium text-muted mt-1.5">{label}</p>
  </div>
);

/* An empty panel and an all-clear panel look identical, and they mean opposite
   things. This says which one it is. */
const NotStarted = ({ what, why }) => (
  <div className="py-6 text-center">
    <p className="text-[13px] font-bold text-muted">{what}</p>
    <p className="text-[11.5px] font-medium text-muted/70 mt-1.5 max-w-md mx-auto leading-relaxed">{why}</p>
  </div>
);

/* ── Every centre as a tile ─────────────────────────────────
   Sixty-six numbers in a table is a list to read. The same sixty-six as
   coloured tiles is a picture: where the red clusters is where the day goes. */
function ReadinessMap({ stats, allCenters, onPick }) {
  const score = new Map(stats.ranked.map(x => [String(x.center), x.score]));

  /* Centres with no inspection are shown grey rather than omitted — a centre
     missing from the map is the one most likely to be forgotten. */
  const codes = [...new Set([
    ...stats.ranked.map(x => String(x.center)),
    ...(allCenters || []).map(c => c.code).filter(Boolean).map(String),
  ])].sort(compareCenters);

  if (!codes.length) return <Empty />;

  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map(code => {
        const v = score.get(code);
        const color = v == null ? '#94A3B8' : v >= 8 ? GREEN : v >= 6 ? AMBER : RED;
        return (
          <button key={code} onClick={onPick}
            title={v == null ? `${code} — بلا تقييم` : `${code} — ${v.toFixed(1)} من ١٠`}
            className="w-[70px] rounded-[10px] border px-1.5 py-2 text-center transition-colors hover:brightness-[0.97]"
            style={{ background: tint(color, 12), borderColor: tint(color, 28) }}>
            <span className="block text-[10.5px] font-medium truncate" style={{ color }}>
              {code}
            </span>
            <span className="block text-[15px] font-extrabold tabular-nums leading-none mt-1" style={{ color }}>
              {v == null ? '—' : AR(v.toFixed(1))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── First round against the latest ─────────────────────── */
function RoundPanel({ cmp, label }) {
  if (!cmp || !cmp.moved.length) {
    return (
      <Panel Icon={ArrowsLeftRight} color={NAVY} title={`مقارنة الجولات · ${label}`}>
        <Empty label={`لم تُنفَّذ جولة ثانية في ${label} بعد`} />
      </Panel>
    );
  }

  const arrow = (d) => (d > 0 ? '▲' : d < 0 ? '▼' : '—');

  return (
    <Panel
      Icon={ArrowsLeftRight}
      color={cmp.avgDelta >= 0 ? GREEN : RED}
      title={`مقارنة الجولات · ${label}`}
      subtitle={`${AR(cmp.moved.length)} مركز له جولتان أو أكثر${cmp.single ? ` · ${AR(cmp.single)} بجولة واحدة` : ''}`}
      right={
        <Pill color={cmp.avgDelta >= 0 ? GREEN : RED}>
          {arrow(cmp.avgDelta)} {AR(Math.abs(cmp.avgDelta).toFixed(2))} نقطة في المتوسط
        </Pill>
      }
    >
      <div className="p-4">
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {[
            ['تحسّن', cmp.improved, GREEN],
            ['ثبات',  cmp.same,     STEEL],
            ['تراجع', cmp.declined, RED],
          ].map(([l, n, c]) => (
            <div key={l} className="rounded-[11px] border p-3 text-center"
              style={{ background: tint(c, 12), borderColor: tint(c, 28) }}>
              <p className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color: c }}>{AR(n)}</p>
              <p className="text-[11px] font-medium text-muted mt-2">{l}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <MoveList title="الأكثر تحسّناً" rows={cmp.top} tone={GREEN} />
          <MoveList title="الأكثر تراجعاً" rows={cmp.bottom} tone={RED} />
        </div>
      </div>
    </Panel>
  );
}

function MoveList({ title, rows, tone }) {
  return (
    <div>
      <p className="text-[11.5px] font-bold mb-2" style={{ color: tone }}>{title}</p>
      {!rows.length ? (
        <p className="text-[11.5px] font-medium text-muted/70 py-3">لا شيء في هذا الاتجاه</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(m => (
            <li key={m.center} className="flex items-center gap-2 text-[11.5px] rounded-[10px] border px-2.5 py-2"
              style={{ background: tint(tone, 9), borderColor: tint(tone, 22) }}>
              <span className="font-bold text-ink flex-1 truncate">{m.center}</span>
              <span className="font-medium tabular-nums text-muted">{AR(m.first.toFixed(1))}</span>
              <ArrowLeft size={11} weight="bold" className="text-muted/50" />
              <span className="font-bold tabular-nums text-ink">{AR(m.last.toFixed(1))}</span>
              <span className="font-extrabold tabular-nums w-12 text-end" style={{ color: tone }}>
                {m.delta > 0 ? '▲' : '▼'} {AR(Math.abs(m.delta).toFixed(1))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Caterer table ──────────────────────────────────────── */
function Scorecards({ rows }) {
  if (!rows.length) return <Empty label="لا يوجد متعهدون مرتبطون بمراكز بعد" />;
  const shown = rows.filter(r => r.rank != null);
  if (!shown.length) return <Empty label="لا توجد تقييمات كافية لحساب الأداء" />;

  return (
    <DataTable className="-m-1 p-1">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="text-muted border-b border-line">
            <th className="text-start font-bold py-2 px-2 w-8">#</th>
            <th className="text-start font-bold py-2 px-2">المتعهد</th>
            <th className="text-center font-bold py-2 px-2 whitespace-nowrap">المراكز</th>
            <th className="text-center font-bold py-2 px-2 whitespace-nowrap">منى</th>
            <th className="text-center font-bold py-2 px-2 whitespace-nowrap">عرفة</th>
            <th className="text-center font-bold py-2 px-2 whitespace-nowrap">المخالفات</th>
            <th className="text-center font-bold py-2 px-2 whitespace-nowrap">البلاغات</th>
            <th className="text-start font-bold py-2 px-2 w-40 whitespace-nowrap">الأداء العام</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shown.map((r, i) => {
            const tone = r.rank >= 8 ? GREEN : r.rank >= 6 ? AMBER : RED;
            return (
              <tr key={r.caterer} className="hover:bg-[rgb(var(--c-bg))] transition-colors">
                <td className="py-2.5 px-2 text-muted tabular-nums">{AR(i + 1)}</td>
                <td className="py-2.5 px-2 font-bold text-ink max-w-[16rem] truncate" title={r.caterer}>
                  {r.caterer}
                </td>
                <td className="py-2.5 px-2 text-center font-medium tabular-nums text-muted">{AR(r.centerCount)}</td>
                <td className="py-2.5 px-2 text-center font-medium tabular-nums text-ink">
                  {r.mina == null ? '—' : AR(r.mina.toFixed(1))}
                </td>
                <td className="py-2.5 px-2 text-center font-medium tabular-nums text-ink">
                  {r.arafat == null ? '—' : AR(r.arafat.toFixed(1))}
                </td>
                <td className="py-2.5 px-2 text-center font-bold tabular-nums"
                  style={{ color: r.violations > 0 ? RED : undefined }}>
                  {AR(r.violations)}
                </td>
                <td className="py-2.5 px-2 text-center font-medium tabular-nums text-muted">{AR(r.reports)}</td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 h-1.5 rounded-full bg-[rgb(var(--c-bg))] overflow-hidden">
                      <span className="block h-full rounded-full"
                        style={{ width: `${(r.rank / 10) * 100}%`, background: tone }} />
                    </span>
                    <span className="font-extrabold tabular-nums w-8 text-end" style={{ color: tone }}>
                      {AR(r.rank.toFixed(1))}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTable>
  );
}
