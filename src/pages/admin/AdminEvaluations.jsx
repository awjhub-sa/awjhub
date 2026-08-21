/**
 * src/pages/admin/AdminEvaluations.jsx
 *
 * The caterers' season, scored out of a hundred.
 *
 * The operation already runs this evaluation on a spreadsheet. What the system
 * adds is that half of it need not be typed: Mina readiness, Arafat readiness
 * and meal quality are inspections that have been happening all season, and
 * fifty of the hundred marks can be read straight out of them.
 *
 * The one thing this screen must never do is confuse "not finished" with "did
 * badly". A caterer with only the computed half entered sits at fifty out of a
 * hundred, which the grade bands would call بحاجة لتحسين — and putting that
 * beside a company's name is a false accusation. So a grade is shown only once
 * every criterion has a number; until then the card shows how much of it is
 * done, and the ranking is by what has been scored so far.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardText, PencilSimple, X, FloppyDisk, WarningCircle, CheckCircle,
  Sparkle, Calculator, Trophy, ArrowsDownUp, MagnifyingGlass, CloudCheck,
  FileArrowDown,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { Surface, Panel, Pill, EmptyState } from '../../components/ui/index.jsx';
import { db } from '../../lib/db.js';
import { PHASES, ALL_CRITERIA, GRADES } from '../../config/catererScoring.js';
import { buildScorecards, seasonSummary } from '../../lib/catererScore.js';
import { exportCsv } from '../../lib/reportQuery.js';
import { seasonLabel } from '../../lib/hijri.js';
import DataTable from '../../components/DataTable.jsx';

const AR = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const N = (v) => (v == null ? '—' : AR(Number(v) % 1 === 0 ? String(v) : v.toFixed(2)));

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;
/* The terracotta this screen uses for "said one thing, we recorded another". */
const OVERRIDE = '#B4674E';

const MISSING = 'جدول التقييمات غير موجود بعد — شغّل ملف supabase/migrations/010_caterer_evaluations.sql في لوحة Supabase.';
const explain = (e) => (e?.code === 'PGRST205' || /schema cache|caterer_evaluations/i.test(e?.message || ''))
  ? MISSING : (e?.message || 'تعذّر الحفظ');

export default function AdminEvaluations() {
  const [caterers, setCaterers] = useState([]);
  const [mina, setMina]     = useState([]);
  const [arafat, setArafat] = useState([]);
  const [meals, setMeals]   = useState([]);
  const [centers, setCenters] = useState([]);
  const [saved, setSaved]   = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [tableMissing, setMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('total');     // 'total' | 'name' | 'progress'
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const unsub = db.seasons.subscribe(list => {
      setSeasons(list);
      setSeasonId(prev => prev ?? (list.find(s => s.isActive)?.id ?? list[0]?.id ?? null));
    });
    return unsub;
  }, []);

  useEffect(() => {
    let alive = true;
    db.caterer_evaluations.probe().then(r => { if (alive) setMissing(!r.ok); });
    return () => { alive = false; };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const [ca, mi, ar, me, ce, sv] = await Promise.all([
      db.caterers.list({ orderBy: 'name' }),
      db.mina_readiness.list(), db.arafat_readiness.list(),
      db.meal_evaluations.list(), db.centers.list(),
      db.caterer_evaluations.list(seasonId ? { filter: { seasonId } } : {}),
    ]);
    setCaterers(ca); setMina(mi); setArafat(ar); setMeals(me); setCenters(ce); setSaved(sv);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { reload(); }, [reload]);

  const cards = useMemo(
    () => buildScorecards({ caterers, mina, arafat, meals, saved, centers }),
    [caterers, mina, arafat, meals, saved, centers],
  );
  const summary = useMemo(() => seasonSummary(cards), [cards]);

  const shown = useMemo(() => {
    const q = search.trim();
    const base = q ? cards.filter(c => c.name.includes(q)) : cards;
    const out = [...base];
    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    else if (sort === 'progress') out.sort((a, b) => b.filled - a.filled || b.total - a.total);
    return out;
  }, [cards, search, sort]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const save = async (card, values, notes) => {
    const body = { seasonId, catererId: card.id, notes, updatedAt: new Date() };
    for (const c of ALL_CRITERIA) {
      const v = values[c.key];
      body[c.key] = (v === '' || v == null) ? null : Math.min(Number(v), c.max);
    }
    try {
      if (card.savedId) await db.caterer_evaluations.update(card.savedId, body);
      else await db.caterer_evaluations.insert(body);
    } catch (e) { throw new Error(explain(e)); }
    await reload();
    flash('حُفظ التقييم');
  };

  const season = seasons.find(s => s.id === seasonId) || null;

  /* Exported from the cards on screen, not from the table: half of every mark
     is computed and never stored, so a table-driven export would silently
     disagree with the page it was launched from. */
  const exportSeason = () => {
    const columns = [
      'المتعهد', 'المراكز',
      ...ALL_CRITERIA.map(c => c.label + ' (' + c.max + ')'),
      'قبل الموسم (35)', 'أثناء الموسم (50)', 'بعد الموسم (15)',
      'النتيجة (100)', 'التقدير', 'البنود المكتملة', 'ملاحظات',
    ];
    const rows = cards.map(c => [
      c.name, c.centres,
      ...ALL_CRITERIA.map(cr => (c.scores[cr.key] ?? '')),
      ...c.phases.map(p => p.total ?? ''),
      c.total,
      /* A grade only means something on a finished card, so the sheet says
         "incomplete" in words rather than printing a verdict on a half row. */
      c.complete ? c.grade.label : 'غير مكتمل',
      c.filled + '/' + ALL_CRITERIA.length,
      c.notes || '',
    ]);
    exportCsv({ columns, rows, fileName: 'تقييم-المتعهدين-' + (season ? seasonLabel(season) : 'الموسم') + '.csv' });
  };

  return (
    <div className="space-y-4 pb-6" dir="rtl">
      <PageHeader
        kicker="أداء المتعهدين"
        Icon={ClipboardText}
        title="التقييمات"
        subtitle={season ? `تقييم أداء المتعهدين — موسم ${seasonLabel(season)}` : 'تقييم أداء المتعهدين عبر الموسم'}
        heroActions={cards.length > 0 && (
          <button onClick={exportSeason}
            className="h-9 px-4 rounded-xl bg-white hover:bg-[rgb(var(--c-bg))] border border-line
                       text-ink text-[12px] font-bold flex items-center gap-1.5 transition-colors">
            <FileArrowDown size={14} weight="bold" />
            تقرير نهاية الموسم
          </button>
        )}
        stats={[
          { value: AR(cards.length), label: 'متعهد' },
          { value: `${AR(summary.complete)}/${AR(cards.length)}`, label: 'تقييم مكتمل',
            tone: summary.complete === cards.length && cards.length ? 'gold' : undefined },
          ...(summary.complete > 0
            ? [{ value: N(summary.average), label: 'متوسط الدرجة', tone: 'gold' }]
            : []),
        ]}
      />

      {tableMissing && (
        <Banner tone="warn" title="الحفظ غير مفعّل بعد">
          {MISSING} حتى ذلك الحين تُعرض الدرجات المحسوبة من التفتيش، ولن تُحفظ أي إضافة.
        </Banner>
      )}

      {seasons.length > 1 && (
        <Surface className="p-3">
          <p className="text-[10px] font-bold text-muted/70 tracking-widest mb-2 px-1">الموسم</p>
          <div className="flex gap-2 flex-wrap">
            {seasons.map(s => (
              <button key={s.id} onClick={() => setSeasonId(s.id)}
                className={`px-3.5 py-1.5 rounded-[10px] border text-[12px] font-bold transition-colors ${
                  s.id === seasonId
                    ? 'bg-primary text-white border-transparent'
                    : 'bg-white border-line text-ink hover:border-primary/40'
                }`}>
                {seasonLabel(s)}{s.isActive && <span className="ms-1.5 text-[10px] opacity-70">نشط</span>}
              </button>
            ))}
          </div>
        </Surface>
      )}

      {/* ── how the hundred is split, and how much of it the system filled ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {PHASES.map(p => {
          const auto = p.criteria.filter(c => c.derive).reduce((n, c) => n + c.max, 0);
          const ph = summary.byPhase.find(x => x.key === p.key);
          return (
            <div key={p.key}
              className="rounded-[14px] border p-4 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
              style={{ background: tint(p.color, 12), borderColor: tint(p.color, 28) }}>
              <div className="flex items-baseline gap-2">
                <p className="text-[13px] font-bold" style={{ color: p.color }}>{p.label}</p>
                <span className="text-[11px] font-semibold tabular-nums text-muted">من {AR(p.weight)}</span>
                {summary.complete > 0 && ph?.average != null && (
                  <span className="ms-auto text-[12px] font-extrabold tabular-nums" style={{ color: p.color }}>
                    متوسط {N(ph.average)}
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-1.5">
                {p.criteria.map(c => (
                  <li key={c.key} className="flex items-center gap-2 text-[11.5px]">
                    {c.derive
                      ? <Calculator size={11} weight="bold" className="text-success flex-shrink-0" />
                      : <span className="w-[11px] h-[11px] rounded-sm border flex-shrink-0"
                          style={{ borderColor: tint(p.color, 28) }} />}
                    <span className={c.derive ? 'font-semibold text-ink' : 'text-ink/75'}>{c.label}</span>
                    <span className="ms-auto tabular-nums font-bold text-muted">{AR(c.max)}</span>
                  </li>
                ))}
              </ul>
              {auto > 0 && (
                <p className="mt-3 pt-2.5 border-t text-[10.5px] font-semibold text-success flex items-center gap-1.5"
                  style={{ borderColor: tint(p.color, 28) }}>
                  <Calculator size={11} weight="bold" />
                  {AR(auto)} درجة يحسبها النظام من التفتيش
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* ── grade distribution, once anything is complete ── */}
      {summary.complete > 0 && (
        <Panel
          Icon={Trophy}
          color="rgb(var(--c-accent-600))"
          title="توزيع التقديرات"
          right={
            <p className="text-[11px] font-semibold text-muted whitespace-nowrap">
              أعلى {N(summary.best)} · أقل {N(summary.worst)}
              {summary.above80 != null && <> · {AR(summary.above80)}٪ فوق ٨٠</>}
            </p>
          }
        >
          <div className="p-4 sm:p-5">
            <div className="flex gap-1 h-7 rounded-[10px] overflow-hidden border border-line">
              {GRADES.map(g => {
                const n = cards.filter(c => c.complete && c.grade?.label === g.label).length;
                if (!n) return null;
                return (
                  <div key={g.label} className="flex items-center justify-center text-white text-[10.5px] font-bold tabular-nums"
                    style={{ background: g.color, flexGrow: n }} title={`${g.label}: ${n}`}>
                    {AR(n)}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
              {GRADES.map(g => (
                <span key={g.label} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
                  <i className="w-2.5 h-2.5 rounded-sm block" style={{ background: g.color }} />
                  {g.label}
                  <b className="text-ink tabular-nums font-bold">{AR(cards.filter(c => c.complete && c.grade?.label === g.label).length)}</b>
                </span>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* ── the roll ── */}
      <Surface className="overflow-hidden">
        <div className="p-3 border-b border-line flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlass size={13} weight="bold" className="absolute start-3 top-1/2 -translate-y-1/2 text-muted/60" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم المتعهد"
              className="w-full h-9 ps-8 pe-3 rounded-[10px] border border-line bg-[rgb(var(--c-bg))] text-[12px] text-ink
                         focus:outline-none focus:border-primary/50 focus:bg-white" />
          </div>
          <div className="flex gap-1">
            {[['total', 'الدرجة'], ['progress', 'الاكتمال'], ['name', 'الاسم']].map(([k, l]) => (
              <button key={k} onClick={() => setSort(k)}
                className={`h-9 px-3 rounded-[10px] border text-[11px] font-bold flex items-center gap-1 transition-colors ${
                  sort === k ? 'bg-primary text-white border-transparent' : 'bg-white border-line text-muted hover:text-ink'
                }`}>
                <ArrowsDownUp size={11} weight="bold" />{l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <DataTable>
            <table className="w-full text-sm">
              <thead className="text-muted text-[11px] bg-[rgb(var(--c-bg))] border-b border-line">
                <tr>
                  <th className="px-3 py-2.5 text-start font-bold w-8">#</th>
                  <th className="px-3 py-2.5 text-start font-bold">المتعهد</th>
                  <th className="px-3 py-2.5 text-start font-bold">مراكز</th>
                  {PHASES.map(p => (
                    <th key={p.key} className="px-3 py-2.5 text-start font-bold whitespace-nowrap">
                      {p.label} <span className="opacity-60">/{AR(p.weight)}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-start font-bold">النتيجة</th>
                  <th className="px-3 py-2.5 text-start font-bold">التقدير</th>
                  <th className="px-3 py-2.5 text-start font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((c, i) => (
                  <tr key={c.id} className="hover:bg-[rgb(var(--c-bg))] transition-colors">
                    <td className="px-3 py-2.5 tabular-nums text-muted text-[11px]">{AR(i + 1)}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-ink text-[12.5px]">{c.name}</span>
                      <span className="block text-[10.5px] font-medium text-muted mt-1 flex items-center gap-1.5">
                        <Calculator size={10} weight="bold" className="text-success" />
                        {AR(c.evidence.mina + c.evidence.arafat)} تفتيش · {AR(c.evidence.meals)} تقييم وجبة
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted text-[11.5px]">{AR(c.centres)}</td>
                    {c.phases.map(p => (
                      <td key={p.key} className="px-3 py-2.5 tabular-nums text-[12px]">
                        <span className={p.filled === p.of ? 'font-bold text-ink' : 'text-muted'}>
                          {N(p.total)}
                        </span>
                        {p.filled < p.of && (
                          <span className="text-[10px] text-muted/70 ms-1">({AR(p.filled)}/{AR(p.of)})</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <span className="text-[15px] font-extrabold tabular-nums"
                        style={{ color: c.complete ? c.grade?.color : 'rgb(var(--c-muted))' }}>
                        {N(c.total)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {/* Only a finished card earns a grade. */}
                      {c.complete ? (
                        <Pill color={c.grade.color}>{c.grade.label}</Pill>
                      ) : (
                        <span className="text-[10.5px] font-medium text-muted whitespace-nowrap">
                          {AR(c.filled)} من {AR(ALL_CRITERIA.length)} بند
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setEditing(c)}
                        className="w-8 h-8 rounded-[10px] border border-line flex items-center justify-center
                                   text-muted hover:text-ink hover:bg-[rgb(var(--c-bg))] transition-colors">
                        <PencilSimple size={13} weight="bold" />
                      </button>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={9}><EmptyState Icon={MagnifyingGlass} title="لا متعهدون مطابقون" /></td></tr>
                )}
              </tbody>
            </table>
          </DataTable>
        )}
      </Surface>

      {editing && (
        <EvaluationEditor
          card={editing}
          onClose={() => setEditing(null)}
          onSave={(v, n) => save(editing, v, n)}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2
                        px-4 py-2.5 rounded-[11px] bg-ink text-white text-[12px] font-bold">
          <CloudCheck size={15} weight="bold" className="text-success" />{toast}
        </div>
      )}
    </div>
  );
}

const Banner = ({ title, children }) => (
  <div className="rounded-[14px] border p-4 flex gap-3"
    style={{ background: tint(OVERRIDE, 12), borderColor: tint(OVERRIDE, 28) }}>
    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
      style={{ background: tint(OVERRIDE, 9), borderColor: tint(OVERRIDE, 22) }}>
      <WarningCircle size={15} weight="duotone" style={{ color: OVERRIDE }} />
    </span>
    <div className="min-w-0">
      <p className="text-[12.5px] font-bold" style={{ color: OVERRIDE }}>{title}</p>
      <p className="text-[11.5px] font-medium text-ink/75 leading-relaxed mt-1">{children}</p>
    </div>
  </div>
);

/* One caterer's card. Computed values are shown in place with their origin
   named, so overriding one is a deliberate act rather than an accident of
   typing into an empty box. */
function EvaluationEditor({ card, onClose, onSave }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(ALL_CRITERIA.map(c => [
      c.key,
      card.sources[c.key] === 'auto' ? '' : (card.scores[c.key] ?? ''),
    ])));
  const [notes, setNotes] = useState(card.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const effective = (c) => {
    const v = values[c.key];
    if (v !== '' && v != null) return Math.min(Number(v), c.max);
    return card.derived[c.key];
  };

  const total = ALL_CRITERIA.reduce((n, c) => n + (effective(c) ?? 0), 0);
  const filled = ALL_CRITERIA.filter(c => effective(c) != null).length;
  const complete = filled === ALL_CRITERIA.length;
  const grade = GRADES.find(g => total >= g.min);

  const submit = async () => {
    setBusy(true); setErr('');
    try { await onSave(values, notes); onClose(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" dir="rtl">
      <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="إغلاق" />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] bg-[rgb(var(--c-bg))] rounded-t-[18px] sm:rounded-[18px]
                      overflow-hidden flex flex-col shadow-[0_24px_60px_-20px_rgb(var(--c-ink)/0.45)]">
        <header className="px-5 py-4 bg-white border-b border-line flex items-center gap-3 flex-shrink-0">
          <span className="w-11 h-11 rounded-[11px] flex items-center justify-center text-[15px] font-extrabold tabular-nums flex-shrink-0 border"
            style={complete
              ? { background: tint(grade.color, 12), borderColor: tint(grade.color, 28), color: grade.color }
              : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}>
            {N(Math.round(total * 100) / 100)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-bold text-ink truncate">{card.name}</p>
            <p className="text-[11px] font-medium text-muted mt-1">
              {complete
                ? <span className="font-bold" style={{ color: grade.color }}>{grade.label}</span>
                : <>{AR(filled)} من {AR(ALL_CRITERIA.length)} بند</>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center flex-shrink-0 text-muted hover:text-ink transition-colors">
            <X size={15} weight="bold" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {PHASES.map(p => (
            <section key={p.key} className="bg-white rounded-[14px] border border-line overflow-hidden
                                            shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
              <div className="px-4 py-3 border-b flex items-center gap-2"
                style={{ background: tint(p.color, 12), borderColor: tint(p.color, 28) }}>
                <span className="text-[12px] font-bold" style={{ color: p.color }}>{p.label}</span>
                <span className="ms-auto text-[11.5px] font-bold tabular-nums" style={{ color: p.color }}>
                  {N(Math.round(p.criteria.reduce((n, c) => n + (effective(c) ?? 0), 0) * 100) / 100)} / {AR(p.weight)}
                </span>
              </div>
              <div className="p-3 space-y-2">
                {p.criteria.map(c => {
                  const auto = card.derived[c.key];
                  const overridden = values[c.key] !== '' && values[c.key] != null;
                  return (
                    <div key={c.key} className="flex items-center gap-2.5">
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12px] font-bold text-ink flex items-center gap-1.5">
                          {c.derive && <Calculator size={10} weight="bold" className="text-success flex-shrink-0" />}
                          {c.label}
                        </span>
                        {auto != null && (
                          <span className="block text-[10.5px] font-semibold mt-1"
                            style={{ color: overridden ? OVERRIDE : 'rgb(var(--c-success))' }}>
                            {overridden
                              ? `محسوب ${N(auto)} — عُدّل يدوياً`
                              : `محسوب من التفتيش: ${N(auto)}`}
                          </span>
                        )}
                        {!auto && c.note && (
                          <span className="block text-[10.5px] font-medium text-muted/70 mt-1">{c.note}</span>
                        )}
                      </span>
                      <input
                        type="number" min={0} max={c.max} step="0.25"
                        value={values[c.key]}
                        onChange={e => setValues(v => ({ ...v, [c.key]: e.target.value }))}
                        placeholder={auto != null ? N(auto) : '—'}
                        className="w-20 h-9 px-2 rounded-[10px] border border-line bg-[rgb(var(--c-bg))] text-[12.5px] font-bold
                                   tabular-nums text-center text-ink focus:outline-none focus:border-primary/50 focus:bg-white"
                      />
                      <span className="text-[11px] font-semibold text-muted tabular-nums w-8">/{AR(c.max)}</span>
                      {overridden && (
                        <button onClick={() => setValues(v => ({ ...v, [c.key]: '' }))}
                          title="إرجاع للقيمة المحسوبة"
                          className="w-7 h-7 rounded-[10px] border border-line flex items-center justify-center text-muted hover:text-ink transition-colors">
                          <X size={11} weight="bold" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="bg-white rounded-[14px] border border-line p-4 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
            <label className="block">
              <span className="text-[10px] font-bold text-muted/70 tracking-widest block mb-2">ملاحظات</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="ما يستحق أن يُقرأ مع الدرجة عند قرار التجديد"
                className="w-full px-3 py-2 rounded-[10px] border border-line bg-[rgb(var(--c-bg))] text-[12px] text-ink leading-relaxed
                           focus:outline-none focus:border-primary/50 focus:bg-white resize-none" />
            </label>
          </section>
        </div>

        <footer className="px-5 py-3 bg-white border-t border-line flex items-center gap-2 flex-shrink-0">
          {err && <p className="text-[11.5px] font-semibold text-error flex-1">{err}</p>}
          {!err && complete && (
            <p className="text-[11.5px] font-bold flex items-center gap-1.5" style={{ color: grade.color }}>
              <CheckCircle size={13} weight="fill" />اكتمل {grade.label}
            </p>
          )}
          <div className="ms-auto flex items-center gap-2">
            <button onClick={onClose} disabled={busy}
              className="h-9 px-4 rounded-[10px] border border-line bg-white text-[12px] font-bold text-muted
                         hover:text-ink transition-colors disabled:opacity-40">
              إلغاء
            </button>
            <button onClick={submit} disabled={busy}
              className="h-9 px-5 rounded-[10px] bg-primary hover:bg-primary-700 text-white text-[12px] font-bold
                         flex items-center gap-1.5 transition-colors disabled:opacity-50">
              <FloppyDisk size={14} weight="bold" />{busy ? 'جارٍ الحفظ…' : 'حفظ التقييم'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
