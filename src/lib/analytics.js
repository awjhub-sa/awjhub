/**
 * src/lib/analytics.js
 *
 * Turns the season's rows into the handful of things worth knowing.
 *
 * Two halves. The first aggregates — scores per day, failures per criterion,
 * a scorecard per caterer. The second reads those aggregates and writes the
 * findings out in Arabic: which caterer is behind, which criterion the whole
 * season keeps failing, which centre was never inspected at all.
 *
 * The findings are computed, not generated. Each one carries the figure that
 * produced it, so nothing on the screen has to be taken on trust — and when a
 * model is put behind this later, these same aggregates are what it reads.
 */

import { dhuDayOf, DHU_DAYS } from '../config/reportSources.js';
import { scoreOf, bandOf, compareCenters } from './reportQuery.js';

const NO = 'لا';
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/* A centre is inspected many times; its standing is its latest score. An
   average across rounds would let an early failure follow a centre that has
   since been fixed. */
function latestByCenter(records) {
  const m = new Map();
  for (const r of records) {
    const key = r.center;
    if (!key) continue;
    const ts = new Date(r.timestamp ?? 0).getTime() || 0;
    const prev = m.get(key);
    if (!prev || ts >= prev.ts) m.set(key, { ts, rec: r, score: scoreOf(r) });
  }
  return m;
}

function failuresByCriterion(records, sections) {
  const all = sections.flatMap(s => s.criteria);
  return all
    .map(q => ({
      q,
      fails: records.filter(r => {
        const a = (r.answers || {})[q.id] ?? (r.answers || {})[String(q.id)];
        return a === NO;
      }).length,
    }))
    .filter(x => x.fails > 0)
    .sort((a, b) => b.fails - a.fails);
}

/* ── Readiness of one mash'ar ─────────────────────────────── */
export function readinessStats(records, sections) {
  const latest = latestByCenter(records);
  const scores = [...latest.values()].map(x => x.score).filter(v => v != null);

  const byDay = DHU_DAYS.map(d => {
    const ofDay = records.filter(r => dhuDayOf(r.timestamp) === d);
    const s = ofDay.map(scoreOf).filter(v => v != null);
    return { day: d, n: ofDay.length, avg: avg(s) };
  });

  /* The dates the data actually falls on, so a season inspected outside
     Dhul-Hijjah still charts. */
  const byDate = [...new Set(records
    .map(r => (r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 10) : null))
    .filter(Boolean))].sort().map(date => {
      const ofDate = records.filter(r =>
        r.timestamp && new Date(r.timestamp).toISOString().slice(0, 10) === date);
      return { date, n: ofDate.length, avg: avg(ofDate.map(scoreOf).filter(v => v != null)) };
    });

  const ranked = [...latest.entries()]
    .map(([center, x]) => ({ center, score: x.score, rec: x.rec }))
    .filter(x => x.score != null)
    .sort((a, b) => b.score - a.score);

  return {
    records,
    sections,
    centers: latest.size,
    evaluations: records.length,
    average: avg(scores),
    bands: ['ممتاز', 'مقبول', 'ضعيف'].map(label => ({
      label,
      n: scores.filter(v => bandOf(v).label === label).length,
    })),
    byDay: byDay.filter(d => d.n > 0),
    byDate,
    ranked,
    failures: failuresByCriterion(records, sections),
    violations: records.reduce(
      (n, r) => n + Object.values(r.answers || {}).filter(v => v === NO).length, 0),
  };
}

/* ── First round against the ones after it ────────────────
   A single inspection says how a centre was on one morning. Two say whether
   anyone acted on the first. That difference is the only thing in the data
   that measures the follow-up rather than the site. */
export function roundComparison(records) {
  const byCenter = new Map();
  for (const r of records) {
    if (!r.center) continue;
    const score = scoreOf(r);
    if (score == null) continue;
    const ts = new Date(r.timestamp ?? 0).getTime() || 0;
    const list = byCenter.get(r.center) || [];
    list.push({ ts, score, rec: r });
    byCenter.set(r.center, list);
  }

  const moved = [];
  let single = 0;
  for (const [center, list] of byCenter) {
    if (list.length < 2) { single++; continue; }
    list.sort((a, b) => a.ts - b.ts);
    const first = list[0], last = list[list.length - 1];
    moved.push({
      center,
      rounds: list.length,
      first: first.score,
      last: last.score,
      delta: last.score - first.score,
      firstAt: first.ts ? new Date(first.ts).toISOString().slice(0, 10) : null,
      lastAt: last.ts ? new Date(last.ts).toISOString().slice(0, 10) : null,
    });
  }
  moved.sort((a, b) => b.delta - a.delta);

  /* A tenth of a point is noise, not movement. */
  const EPS = 0.15;
  return {
    moved,
    single,
    improved: moved.filter(m => m.delta > EPS).length,
    same:     moved.filter(m => Math.abs(m.delta) <= EPS).length,
    declined: moved.filter(m => m.delta < -EPS).length,
    avgFirst: avg(moved.map(m => m.first)),
    avgLast:  avg(moved.map(m => m.last)),
    avgDelta: avg(moved.map(m => m.delta)),
    top:      moved.filter(m => m.delta > EPS).slice(0, 5),
    bottom:   moved.filter(m => m.delta < -EPS).slice(-5).reverse(),
  };
}

/* ── The sections that are not readiness ──────────────────
   Each returns `active: false` when its table is empty, so the screen can say
   "not started" instead of drawing a chart of nothing — a decision-maker
   reading a blank panel cannot tell the difference between all-clear and
   never-entered. */
export function operationsStats({ phases, tasks, completions, forms, centers, caterers }) {
  const phaseRows = phases || [];
  const done = (v) => v != null && v !== '';

  const phaseStats = {
    active: phaseRows.length > 0,
    total: phaseRows.length,
    steps: [
      { key: 'phase1', label: 'التجهيز', n: phaseRows.filter(p => done(p.phase1)).length },
      { key: 'phase2', label: 'الطبخ',   n: phaseRows.filter(p => done(p.phase2)).length },
      { key: 'phase3', label: 'التوزيع', n: phaseRows.filter(p => done(p.phase3)).length },
    ],
    centers: new Set(phaseRows.map(p => p.center).filter(Boolean)).size,
  };

  const taskRows = tasks || [];
  const doneRows = completions || [];
  const targeted = new Set();
  for (const t of taskRows) for (const c of (t.targetCenters || [])) targeted.add(String(c));
  const taskStats = {
    active: taskRows.length > 0,
    assignments: taskRows.length,
    targeted: targeted.size,
    completions: doneRows.length,
    coverage: targeted.size ? Math.round((new Set(doneRows.map(d => String(d.center))).size / targeted.size) * 100) : 0,
    byType: Object.entries(
      taskRows.flatMap(t => t.taskTypes || []).reduce((m, k) => ({ ...m, [k]: (m[k] || 0) + 1 }), {}),
    ).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
  };

  const formRows = forms || [];
  const now = Date.now();
  const settled = (f) => ['submitted', 'accepted'].includes(f.status);
  const formStats = {
    active: formRows.length > 0,
    total: formRows.length,
    submitted: formRows.filter(f => settled(f)).length,
    accepted:  formRows.filter(f => f.status === 'accepted').length,
    returned:  formRows.filter(f => f.status === 'returned').length,
    overdue:   formRows.filter(f => !settled(f) && f.dueAt && new Date(f.dueAt).getTime() < now).length,
  };
  formStats.onTime = formStats.total
    ? Math.round(((formStats.total - formStats.overdue) / formStats.total) * 100) : 0;

  const centerRows = centers || [];
  const coverage = {
    total: centerRows.length,
    assigned: centerRows.filter(c => c.catererId || c.catererName).length,
    caterers: (caterers || []).length,
  };
  coverage.unassigned = coverage.total - coverage.assigned;

  return { phases: phaseStats, tasks: taskStats, forms: formStats, coverage };
}

/* ── One line per caterer, across every section ───────────
   The question the season is really asking: which of them delivered. Nothing
   else in the system joins readiness, reports and logistics onto one row. */
export function catererScorecards({ caterers, centers, mina, arafat, reports, logistics }) {
  const centreOwner = new Map();          // centre code → caterer name
  for (const c of centers) {
    const name = c.catererName || caterers.find(x => x.id === c.catererId)?.name;
    if (c.code && name) centreOwner.set(String(c.code), name);
  }

  const nameOf = (row) =>
    row.caterer || row.catererName || centreOwner.get(String(row.center)) || null;

  const rows = new Map();
  const bucket = (name) => {
    if (!rows.has(name)) {
      rows.set(name, {
        caterer: name, centers: new Set(),
        minaScores: [], arafatScores: [],
        violations: 0, reports: 0, logistics: 0,
      });
    }
    return rows.get(name);
  };

  for (const [code, name] of centreOwner) bucket(name).centers.add(code);

  for (const [list, key] of [[mina, 'minaScores'], [arafat, 'arafatScores']]) {
    for (const [, x] of latestByCenter(list)) {
      const name = nameOf(x.rec);
      if (!name || x.score == null) continue;
      bucket(name)[key].push(x.score);
    }
  }
  for (const list of [mina, arafat]) {
    for (const r of list) {
      const name = nameOf(r);
      if (!name) continue;
      bucket(name).violations += Object.values(r.answers || {}).filter(v => v === NO).length;
    }
  }
  for (const r of reports)   { const n = nameOf(r); if (n) bucket(n).reports++; }
  for (const r of logistics) { const n = nameOf(r); if (n) bucket(n).logistics++; }

  return [...rows.values()]
    .map(r => {
      const all = [...r.minaScores, ...r.arafatScores];
      const readiness = avg(all);
      return {
        ...r,
        centers: [...r.centers].sort(compareCenters),
        centerCount: r.centers.size,
        mina: avg(r.minaScores),
        arafat: avg(r.arafatScores),
        readiness,
        /* Readiness carries the score; violations and open reports pull it
           down, weighted per centre so a big caterer is not punished for
           being big. */
        rank: readiness == null ? null : Math.max(0, Math.min(10,
          readiness
          - Math.min(2, (r.violations / Math.max(1, r.centers.size)) * 0.25)
          - Math.min(1, (r.reports / Math.max(1, r.centers.size)) * 0.5))),
      };
    })
    .filter(r => r.readiness != null || r.centerCount > 0)
    .sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1));
}

/* ── The findings ─────────────────────────────────────────── */
export function buildFindings({
  minaStats, arafatStats, rounds, ops, scorecards, centers, reports, logistics,
}) {
  const out = [];
  const add = (f) => out.push(f);

  /* Movement first. It is the only figure that says whether the last round of
     inspections changed anything, which is the question a decision-maker is
     actually holding. */
  for (const [cmp, label, to] of [
    [rounds?.mina, 'منى', '/admin/readiness/mina'],
    [rounds?.arafat, 'عرفة', '/admin/readiness/arafat'],
  ]) {
    if (!cmp?.moved.length) continue;
    const dir = cmp.avgDelta > 0.15 ? 'تحسّنت' : cmp.avgDelta < -0.15 ? 'تراجعت' : 'ثبتت';
    add({
      tone: cmp.avgDelta < -0.15 ? 'alert' : cmp.avgDelta > 0.15 ? 'good' : 'info',
      title: `${label}: ${cmp.improved} مركز تحسّن و${cmp.declined} تراجع بين الجولتين`,
      body: `المتوسط ${dir} من ${cmp.avgFirst.toFixed(1)} إلى ${cmp.avgLast.toFixed(1)}` +
        (cmp.bottom[0]
          ? `. أكبر تراجع في ${cmp.bottom[0].center} بمقدار ${Math.abs(cmp.bottom[0].delta).toFixed(1)} نقطة.`
          : '.'),
      to,
    });
  }

  if (ops?.forms?.active && ops.forms.overdue > 0) {
    add({
      tone: 'alert',
      title: `${ops.forms.overdue} نموذج تجاوز موعد التسليم`,
      body: `من ${ops.forms.total} نموذج مُسنَد — نسبة الالتزام ${ops.forms.onTime}٪.`,
      to: '/admin/forms',
    });
  }

  if (ops?.coverage?.unassigned > 0) {
    add({
      tone: 'warn',
      title: `${ops.coverage.unassigned} مركز بلا متعهد مسنَد`,
      body: `من ${ops.coverage.total} مركز في الموسم — لا يظهر أداؤها في بطاقة أي متعهد.`,
      to: '/admin/centers',
    });
  }

  if (ops?.tasks?.active && ops.tasks.completions === 0) {
    add({
      tone: 'warn',
      title: `${ops.tasks.assignments} مهمة مسنَدة بلا أي إنجاز مسجّل`,
      body: `تستهدف ${ops.tasks.targeted} مركزاً ولم يصل عنها شيء بعد.`,
      to: '/admin/tasks',
    });
  }

  if (ops && !ops.phases.active) {
    add({
      tone: 'info',
      title: 'متابعة المراحل لم تبدأ بعد',
      body: 'لا توجد سجلات تجهيز أو طبخ أو توزيع — لوحة المراحل ستملأ نفسها أول ما يبدأ الميدان.',
      to: '/admin/phases',
    });
  }

  for (const [stats, label, to] of [
    [minaStats, 'منى', '/admin/readiness/mina'],
    [arafatStats, 'عرفة', '/admin/readiness/arafat'],
  ]) {
    if (!stats.evaluations) continue;

    /* A criterion that fails across most centres is a system problem, not a
       centre problem — the distinction changes who has to act. */
    const worst = stats.failures[0];
    if (worst && stats.centers > 0) {
      const share = pct(worst.fails, stats.evaluations);
      if (share >= 25) {
        add({
          tone: 'alert',
          title: `معيار واحد يسقط في ${share}٪ من تقييمات ${label}`,
          body: `«${worst.q.text}» سقط ${worst.fails} مرة. حين يسقط معيار عند هذا العدد من المراكز فالسبب غالبًا في التجهيز العام لا في مركز بعينه.`,
          to,
        });
      }
    }

    const low = stats.ranked.filter(x => x.score < 6);
    if (low.length) {
      add({
        tone: 'alert',
        title: `${low.length} مركز في ${label} دون المقبول`,
        body: `أدناها ${low[low.length - 1].center} بدرجة ${low[low.length - 1].score.toFixed(1)}. هذه المراكز تحتاج زيارة قبل غيرها.`,
        to,
      });
    }

    if (stats.average != null) {
      add({
        tone: stats.average >= 8 ? 'good' : 'info',
        title: `متوسط جاهزية ${label} ${stats.average.toFixed(1)} من ١٠`,
        body: `على ${stats.centers} مركز و${stats.evaluations} تقييم، منها ${stats.bands[0].n} ممتاز و${stats.bands[2].n} ضعيف.`,
        to,
      });
    }

    /* Two rounds of inspection exist to show movement. */
    const days = stats.byDate.filter(d => d.avg != null);
    if (days.length >= 2) {
      const first = days[0], last = days[days.length - 1];
      const delta = last.avg - first.avg;
      if (Math.abs(delta) >= 0.3) {
        add({
          tone: delta > 0 ? 'good' : 'alert',
          title: `${label}: الجاهزية ${delta > 0 ? 'ارتفعت' : 'تراجعت'} ${Math.abs(delta).toFixed(1)} نقطة`,
          body: `من ${first.avg.toFixed(1)} في ${first.date} إلى ${last.avg.toFixed(1)} في ${last.date}.`,
          to,
        });
      }
    }
  }

  /* Coverage. A centre with no inspection is not a good centre; it is an
     unknown one, and it will not appear in any average. */
  const seen = new Set([
    ...minaStats.ranked.map(x => String(x.center)),
    ...arafatStats.ranked.map(x => String(x.center)),
  ]);
  const missing = centers.filter(c => c.code && !seen.has(String(c.code)));
  if (missing.length) {
    add({
      tone: 'warn',
      title: `${missing.length} مركز بلا أي تقييم`,
      body: `${missing.slice(0, 6).map(c => c.code).join('، ')}${missing.length > 6 ? ' وغيرها' : ''} — غائبة عن كل المتوسطات أعلاه.`,
      to: '/admin/centers',
    });
  }

  /* The caterer comparison, stated rather than left in the table. */
  const ranked = scorecards.filter(s => s.rank != null);
  if (ranked.length >= 2) {
    const best = ranked[0], worst = ranked[ranked.length - 1];
    add({
      tone: 'good',
      title: `أفضل متعهد: ${best.caterer}`,
      body: `${best.rank.toFixed(1)} من ١٠ على ${best.centerCount} مركز، بـ${best.violations} مخالفة.`,
      to: '/admin/caterers',
    });
    if (worst.rank < 6) {
      add({
        tone: 'alert',
        title: `أضعف متعهد: ${worst.caterer}`,
        body: `${worst.rank.toFixed(1)} من ١٠ على ${worst.centerCount} مركز، بـ${worst.violations} مخالفة — يستحق مراجعة قبل نهاية الموسم.`,
        to: '/admin/caterers',
      });
    }
  }

  if (reports.length) {
    const open = reports.filter(r => (r.status || 'pending') !== 'resolved').length;
    add({
      tone: open ? 'warn' : 'good',
      title: `${open} بلاغ مفتوح من ${reports.length}`,
      body: open
        ? `نسبة الإغلاق ${pct(reports.length - open, reports.length)}٪.`
        : 'كل البلاغات مغلقة.',
      to: '/admin/reports',
    });
  }

  if (logistics.length) {
    const pending = logistics.filter(r => (r.status || 'pending') === 'pending').length;
    if (pending) {
      add({
        tone: 'warn',
        title: `${pending} طلب إسناد بانتظار الاعتماد`,
        body: `من إجمالي ${logistics.length} طلب.`,
        to: '/admin/logistics',
      });
    }
  }

  const order = { alert: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
