/**
 * src/pages/admin/LiveScreen.jsx
 *
 * The operations screen — what is wrong right now, without a click.
 *
 * Every other screen in the system answers a question you went looking for.
 * This one answers the question nobody has time to ask during the five days
 * that matter: which centre is failing, which meal is late, what just came in.
 * It is meant to be put on a wall and left there.
 *
 * Two rules follow from that, and they shape everything below:
 *
 *   It reads, it never writes. There is no form here and no confirm dialog —
 *   a screen a room can see is a screen nobody should be able to change by
 *   leaning on a keyboard.
 *
 *   Every panel is a way back. Reading that centre 65 is red is only useful if
 *   the next move is one click, so each tile carries a link into the section
 *   that owns it. The sidebar stays the single place sections live; this is a
 *   destination inside it, not a second copy of it.
 *
 * It lives outside AdminLayout so it can take the whole display, and subscribes
 * rather than polls so the wall is never stale.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Siren, CheckCircle, ArrowsOut, ArrowsIn,
} from '@phosphor-icons/react';
import { db } from '../../lib/db.js';
import { useBrand } from '../../context/BrandContext.jsx';
import { readinessStats } from '../../lib/analytics.js';
import { MINA_SECTIONS } from '../../config/minaQuestions.js';
import { ARAFAT_SECTIONS } from '../../config/arafatQuestions.js';
import { extractCenterNum } from '../../config/nationalities.js';
import {
  severityOf, reportType, timeAgo, MEAL_LABEL,
} from '../../config/fieldRecords.js';
import './live-screen.css';

const AR = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

/* Three bands, because a wall display is read at four metres and a gradient of
   ten shades is a smear at that distance. */
const BANDS = [
  { min: 9,  color: '#16A34A', label: '٩٠٪ فأعلى' },
  { min: 7,  color: '#FCD34D', label: '٧٠–٨٩٪' },
  { min: -1, color: '#DC2626', label: 'أقل من ٧٠٪' },
];
const bandFor = (score) =>
  score == null ? null : BANDS.find(b => score >= b.min) || BANDS[BANDS.length - 1];

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];
const PHASE_LABEL = ['التجهيز', 'التعبئة', 'النقل', 'التسليم'];

export default function LiveScreen() {
  const nav = useNavigate();
  const { brand } = useBrand();

  const [reports,   setReports]   = useState([]);
  const [logistics, setLogistics] = useState([]);
  const [centers,   setCenters]   = useState([]);
  const [mina,      setMina]      = useState([]);
  const [arafat,    setArafat]    = useState([]);
  const [phases,    setPhases]    = useState([]);
  const [users,     setUsers]     = useState([]);

  const [site, setSite] = useState('mina');
  const [meal, setMeal] = useState('lunch');
  const [now,  setNow]  = useState(() => new Date());
  const [full, setFull] = useState(false);

  /* Subscribed, not polled: the point of the screen is that it is never a
     minute behind the room it is standing in. */
  useEffect(() => {
    const subs = [
      db.reports.subscribe(setReports),
      db.logistics_requests.subscribe(setLogistics),
      db.centers.subscribe(setCenters),
      db.mina_readiness.subscribe(setMina),
      db.arafat_readiness.subscribe(setArafat),
      db.meal_phases.subscribe(setPhases),
      db.users.subscribe(setUsers),
    ];
    return () => subs.forEach(u => u?.());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && full) setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const toggleFull = async () => {
    try {
      if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); setFull(true); }
      else { await document.exitFullscreen(); setFull(false); }
    } catch { setFull(f => !f); }
  };

  /* ── the numbers ── */
  const open      = useMemo(() => reports.filter(r => r.status !== 'resolved'), [reports]);
  const critical  = useMemo(() => open.filter(r => r.severity === 'critical' || r.severity === 'high'), [open]);
  const openLogi  = useMemo(() => logistics.filter(r => r.status === 'pending'), [logistics]);
  const observers = useMemo(() => users.filter(u => u.role === 'observer').length, [users]);

  const stats = useMemo(
    () => readinessStats(site === 'mina' ? mina : arafat,
                         site === 'mina' ? MINA_SECTIONS : ARAFAT_SECTIONS),
    [site, mina, arafat],
  );

  /* Every centre in the season, carrying its latest score — the ones never
     inspected included, drawn hollow. A missing centre is information. */
  const grid = useMemo(() => {
    const byCenter = new Map(stats.ranked.map(r => [String(r.center), r.score]));
    return centers
      .map(c => ({
        id: c.id,
        code: c.code,
        num: extractCenterNum(c.code) ?? 0,
        score: byCenter.get(String(c.code)) ?? byCenter.get(String(extractCenterNum(c.code))) ?? null,
      }))
      .sort((a, b) => a.num - b.num);
  }, [centers, stats]);

  const scored = grid.filter(g => g.score != null);
  const worst  = [...scored].sort((a, b) => a.score - b.score).slice(0, 8);

  /* ── the meal, phase by phase ── */
  const mealPhases = useMemo(() => {
    const rows = phases.filter(p => (p.mealId ?? p.mealType) === meal);
    const total = centers.length || 1;
    return PHASE_LABEL.map((label, i) => {
      const key = `phase${i + 1}`;
      const done = rows.filter(r => r[key]).length;
      const times = rows.map(r => r[key]).filter(Boolean)
        .map(v => (v?.toMillis?.() ?? new Date(v).getTime())).filter(n => !isNaN(n));
      return {
        label, done, total,
        pct: Math.round((done / total) * 100),
        last: times.length ? new Date(Math.max(...times)) : null,
      };
    });
  }, [phases, meal, centers]);

  /* "Late" and "not recorded yet" look identical in the data and mean opposite
     things. A meal only a handful of centres have touched has not started; one
     most centres have moved through has stragglers. Calling the first case late
     would put "66 مركز متأخر" on the wall on a quiet morning and teach the room
     to ignore the panel. */
  const started = mealPhases[0].done >= Math.max(3, Math.ceil(mealPhases[0].total * 0.2));
  const running = started ? mealPhases.findIndex(p => p.done > 0 && p.done < p.total) : -1;
  const lateOn  = running >= 0 ? mealPhases[running] : null;

  const LATE_SHOWN = 12;
  const lateAll = useMemo(() => {
    if (running < 0) return [];
    const key = `phase${running + 1}`;
    const done = new Set(phases.filter(p => (p.mealId ?? p.mealType) === meal && p[key]).map(p => String(p.center)));
    return grid.filter(g => !done.has(String(g.code)) && !done.has(String(g.num)));
  }, [running, phases, meal, grid]);
  const lateCenters = lateAll.slice(0, LATE_SHOWN);

  const clock = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className={`ls ${full ? 'ls-full' : ''}`} dir="rtl">

      {/* ── bar ── */}
      <header className="ls-bar">
        <button className="ls-back" onClick={() => nav('/admin/dashboard')}>
          <ArrowLeft size={15} weight="bold" />
          <span>مساحة العمل</span>
        </button>
        {brand?.logo?.fullOnDark && <img className="ls-logo" src={brand.logo.fullOnDark} alt="" />}
        <span className="ls-title">غرفة العمليات</span>

        <span className="ls-right">
          <span className="ls-chip ls-live"><i />مباشر</span>
          <span className="ls-chip ls-clock">{AR(clock)}</span>
          <button className="ls-icon" onClick={toggleFull} title={full ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}>
            {full ? <ArrowsIn size={15} weight="bold" /> : <ArrowsOut size={15} weight="bold" />}
          </button>
        </span>
      </header>

      {/* ── the strip ──
          Six numbers, and each one is a link: reading that four are critical is
          only half a move. */}
      <div className="ls-strip">
        <Stat v={centers.length} l="مركز" onClick={() => nav('/admin/centers')} />
        <Stat v={open.length} l="بلاغ مفتوح" tone={open.length ? 'bad' : 'ok'} onClick={() => nav('/admin/reports')} />
        <Stat v={critical.length} l="حرج أو عالي" tone={critical.length ? 'warn' : 'ok'} onClick={() => nav('/admin/reports')} />
        <Stat v={stats.average != null ? `${Math.round(stats.average * 10)}٪` : '—'}
              l={`جاهزية ${site === 'mina' ? 'منى' : 'عرفات'}`} tone="gold"
              onClick={() => nav(site === 'mina' ? '/admin/readiness/mina' : '/admin/readiness/arafat')} />
        <Stat v={openLogi.length} l="طلب إسناد" tone={openLogi.length ? 'warn' : 'ok'} onClick={() => nav('/admin/logistics')} />
        <Stat v={observers} l="مراقب" onClick={() => nav('/admin/observers')} />
      </div>

      {/* ── panels ── */}
      <div className="ls-grid">

        {/* 1 — what just came in */}
        <section className="ls-panel">
          <header className="ls-ph">
            <span>البلاغات الواردة</span>
            <button className="ls-more" onClick={() => nav('/admin/reports')}>الكل</button>
          </header>
          <div className="ls-feed">
            {open.length === 0 ? (
              <div className="ls-clear">
                <CheckCircle size={26} weight="fill" />
                <b>لا بلاغات مفتوحة</b>
                <span>كل ما ورد أُغلق</span>
              </div>
            ) : open.slice(0, 7).map(r => {
              const sev = severityOf(r);
              return (
                <button key={r.id} className="ls-item" onClick={() => nav('/admin/reports')}
                  style={{ borderInlineStartColor: sev?.bar || '#4E7CB0' }}>
                  <span className="ls-item-t">
                    {r.center ? `مركز ${AR(extractCenterNum(r.center) ?? r.center)}` : 'بلا مركز'} — {reportType(r).label}
                  </span>
                  <span className="ls-item-s">
                    {r.observer || '—'} · {AR(timeAgo(r.timestamp))}
                    {sev && <b style={{ color: sev.text }}> · {sev.label}</b>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2 — every centre at once */}
        <section className="ls-panel">
          <header className="ls-ph">
            <span>خريطة الجاهزية · {AR(centers.length)} مركز</span>
            <span className="ls-seg">
              {['mina', 'arafat'].map(k => (
                <button key={k} className={site === k ? 'on' : ''} onClick={() => setSite(k)}>
                  {k === 'mina' ? 'منى' : 'عرفات'}
                </button>
              ))}
            </span>
          </header>

          {scored.length === 0 ? (
            <div className="ls-clear ls-muted">
              <b>لا تقييمات بعد</b>
              <span>لم يُرفع أي تقييم جاهزية لهذا المشعر</span>
            </div>
          ) : (
            <>
              <div className="ls-heat">
                {grid.map(g => {
                  const b = bandFor(g.score);
                  return (
                    <button key={g.id} className={`ls-cell ${b ? '' : 'ls-none'}`}
                      style={b ? { background: b.color } : undefined}
                      title={`${g.code}${g.score != null ? ` — ${Math.round(g.score * 10)}٪` : ' — لم يُقيَّم'}`}
                      onClick={() => nav(site === 'mina' ? '/admin/readiness/mina' : '/admin/readiness/arafat')} />
                  );
                })}
              </div>
              <div className="ls-legend">
                {BANDS.map(b => (
                  <span key={b.label}><i style={{ background: b.color }} />{b.label}</span>
                ))}
                <span><i className="ls-none" />لم يُقيَّم {AR(grid.length - scored.length)}</span>
              </div>
              {worst.length > 0 && (
                <div className="ls-worst">
                  <span className="ls-worst-l">الأدنى</span>
                  {worst.map(w => (
                    <button key={w.id} onClick={() => nav(site === 'mina' ? '/admin/readiness/mina' : '/admin/readiness/arafat')}
                      style={{ color: bandFor(w.score).color, borderColor: bandFor(w.score).color }}>
                      {AR(w.num)} <b>{AR(Math.round(w.score * 10))}٪</b>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* 3 — where the meal has got to */}
        <section className="ls-panel">
          <header className="ls-ph">
            <span>مراحل {MEAL_LABEL[meal]}</span>
            <span className="ls-seg">
              {MEAL_ORDER.map(k => (
                <button key={k} className={meal === k ? 'on' : ''} onClick={() => setMeal(k)}>
                  {MEAL_LABEL[k]}
                </button>
              ))}
            </span>
          </header>

          <div className="ls-phases">
            {mealPhases.map((p) => {
              const state = p.done >= p.total ? 'done'
                : (started && p.done > 0) ? 'run'
                : p.done > 0 ? 'part' : 'idle';
              return (
                <button key={p.label} className={`ls-phase ls-${state}`} onClick={() => nav('/admin/phases')}>
                  <span className="ls-mark">
                    {state === 'done' ? '✓' : state === 'run' ? '◍' : state === 'part' ? '·' : '—'}
                  </span>
                  <span className="ls-phase-b">
                    <span className="ls-phase-t">{p.label}</span>
                    <span className="ls-phase-s">{AR(p.done)} / {AR(p.total)} مركز</span>
                    <span className="ls-track"><i style={{ width: `${p.pct}%` }} /></span>
                  </span>
                  <span className="ls-phase-r">
                    {state === 'run' ? 'جارٍ'
                      : p.last ? AR(p.last.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false }))
                      : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          {lateOn && lateCenters.length > 0 && (
            <div className="ls-late">
              <span className="ls-late-t">
                <Siren size={13} weight="fill" />
                {AR(lateAll.length)} مركز متأخر عن {lateOn.label}
              </span>
              <span className="ls-late-n">
                {lateCenters.map(c => AR(c.num)).join(' · ')}
                {lateAll.length > LATE_SHOWN && ` … +${AR(lateAll.length - LATE_SHOWN)}`}
              </span>
            </div>
          )}
          {!started && (
            <div className="ls-late ls-late-idle">
              <span className="ls-late-t">لم تبدأ مراحل {MEAL_LABEL[meal]} بعد</span>
              <span className="ls-late-s">
                {AR(mealPhases[0].done)} من {AR(mealPhases[0].total)} مركز سجّل التجهيز
              </span>
            </div>
          )}
          {started && !lateOn && (
            <div className="ls-late ls-late-ok">
              <span className="ls-late-t"><CheckCircle size={13} weight="fill" />لا مرحلة متعثّرة الآن</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ v, l, tone, onClick }) {
  return (
    <button className={`ls-stat ${tone ? `ls-${tone}` : ''}`} onClick={onClick}>
      <span className="ls-stat-v">{AR(v)}</span>
      <span className="ls-stat-l">{l}</span>
    </button>
  );
}
