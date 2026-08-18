/**
 * ReportsDeck.jsx — /admin/reports-deck
 *
 * The same selection as the report, presented instead of printed.
 *
 * A report answers "what happened"; a deck answers "what should we do about
 * it", so it is not the table with bigger type. Each section contributes the
 * few slides that carry a decision — how the centres are distributed, who is
 * top and bottom, which criterion fails most often — and the rows themselves
 * come last, paged, for anyone who asks to see them.
 *
 * Print gives one slide per page on a 16:9 sheet, so the deck leaves as a PDF
 * without a second implementation.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CaretRight, CaretLeft, Printer, X, ArrowsOut,
} from '@phosphor-icons/react';
import { db } from '../../lib/db.js';
import { useBrand } from '../../context/BrandContext.jsx';
import { formatHijri } from '../../lib/hijri.js';
import { SOURCE_BY_KEY } from '../../config/reportSources.js';
import {
  AR_NUM, buildLookups, buildTable, describeFilters,
  scoreOf, bandOf, BANDS, readReportRequest,
} from '../../lib/reportQuery.js';
import './reports-deck.css';
import { usePrintPage, closeDocumentTab } from '../../lib/printPage.js';

const ROWS_PER_SLIDE = 8;

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export default function ReportsDeck() {
  const nav = useNavigate();
  usePrintPage('297mm 167mm', '0');
  const [params] = useSearchParams();
  const { brand } = useBrand();

  const request = useMemo(() => readReportRequest(params.get('k')), [params]);

  const [rows,    setRows]    = useState(null);
  const [meta,    setMeta]    = useState({ caterers: [], centers: [], seasons: [], templates: [] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [idx,     setIdx]     = useState(0);

  useEffect(() => {
    if (request?.title) document.title = `${request.title} — عرض تقديمي`;
  }, [request]);

  useEffect(() => {
    if (!request) { setError('انتهت صلاحية الطلب — أعد فتحه من قسم التقارير.'); setLoading(false); return; }
    (async () => {
      try {
        const [ca, ce, se, tp] = await Promise.all([
          db.caterers.list({ orderBy: 'name' }),
          db.centers.list(),
          db.seasons.list(),
          db.form_templates.list(),
        ]);
        setMeta({ caterers: ca, centers: ce, seasons: se, templates: tp });
        const pairs = await Promise.all(
          request.picked.map(async (k) => [k, await db[SOURCE_BY_KEY[k].table].list()]),
        );
        setRows(Object.fromEntries(pairs));
      } catch (ex) { setError(ex.message); }
      setLoading(false);
    })();
  }, [request]);

  const lookups = useMemo(() => buildLookups(meta), [meta]);

  const sections = useMemo(() => {
    if (!rows || !request) return [];
    return request.picked.map(k => {
      const source = SOURCE_BY_KEY[k];
      return {
        source,
        ...buildTable(source, rows[k], {
          filters: request.filters, search: request.search,
          lookups, cols: request.cols, detailed: false,
        }),
      };
    });
  }, [rows, request, lookups]);

  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
  const today = new Date();

  const slides = useMemo(
    () => (sections.length ? buildSlides({ request, sections, totalRows, brand, today, seasons: meta.seasons }) : []),
    [sections, request, totalRows, brand, meta.seasons],
  );

  const go = useCallback((n) => {
    setIdx(i => Math.min(Math.max(i + n, 0), Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') setIdx(0);
      else if (e.key === 'End')  setIdx(slides.length - 1);
      else if (e.key === 'Escape') closeDocumentTab(nav, '/admin/reports-center');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, slides.length]);

  const palette = {
    '--dk-navy':     brand?.colors?.primary || '#1E3A5F',
    '--dk-gold':     brand?.colors?.accent  || '#B99A64',
    '--dk-gold-ink': brand?.colors?.accent600 || '#8C7038',
    '--dk-paper':    '#FFFFFF',
    '--dk-ink':      '#16233D',
  };

  if (loading || error || !slides.length) {
    return (
      <div className="dk" style={palette}>
        <p className="dk-empty">{error || (loading ? 'جارٍ تجهيز العرض…' : 'لا بيانات للعرض')}</p>
      </div>
    );
  }

  return (
    <div className="dk" style={palette}>
      <div className="dk-stage">
        {/* On screen only the current slide is mounted; print shows them all. */}
        {slides.map((s, i) => (
          <Slide key={i} data={s} brand={brand} hidden={i !== idx} />
        ))}
      </div>

      <div className="dk-bar-ui">
        <button className="dk-btn" onClick={() => closeDocumentTab(nav, '/admin/reports-center')}><X size={13} /> إغلاق</button>
        <button className="dk-btn" onClick={() => document.documentElement.requestFullscreen?.()}>
          <ArrowsOut size={13} /> ملء الشاشة
        </button>
        <button className="dk-btn dk-btn-main" onClick={() => window.print()}>
          <Printer size={14} weight="bold" /> احفظ العرض PDF
        </button>

        <span className="dk-count">{AR_NUM(idx + 1)} / {AR_NUM(slides.length)}</span>

        <button className="dk-btn" onClick={() => go(-1)} disabled={idx === 0} aria-label="السابق">
          <CaretRight size={14} weight="bold" />
        </button>
        <div className="dk-dots">
          {slides.map((_, i) => (
            <button key={i} className={`dk-dot${i === idx ? ' is-on' : ''}`}
              onClick={() => setIdx(i)} aria-label={`شريحة ${i + 1}`} />
          ))}
        </div>
        <button className="dk-btn" onClick={() => go(1)} disabled={idx === slides.length - 1} aria-label="التالي">
          <CaretLeft size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

/* ── Slide shell ─────────────────────────────────────────── */
function Slide({ data, brand, hidden }) {
  return (
    <section className={`dk-slide${data.dark ? ' is-dark' : ''}`}
      style={hidden ? { display: 'none' } : undefined}>
      {data.head && (
        <header className="dk-head">
          <h2 className="dk-h">{data.head}</h2>
          {data.chip && <span className="dk-chip">{data.chip}</span>}
        </header>
      )}

      <div className="dk-body">{data.body}</div>

      <footer className="dk-foot">
        <span>{brand?.companyFullAr}</span>
        {data.note && <span>{data.note}</span>}
      </footer>
    </section>
  );
}

/* ── The deck ────────────────────────────────────────────── */
function buildSlides({ request, sections, totalRows, brand, today, seasons }) {
  const out = [];
  const stamp = `${formatHijri(today)} · ${today.toISOString().slice(0, 10)}`;
  const subtitle = describeFilters({
    filters: request.filters, detailed: false, seasons, totalRows,
  });

  /* 1 — the cover */
  out.push({
    dark: true,
    note: stamp,
    body: (
      <>
        {brand?.logo?.fullOnDark && <img className="dk-logo" src={brand.logo.fullOnDark} alt="" />}
        <p className="dk-kicker" style={{ marginTop: '4cqw' }}>عرض تقديمي</p>
        <h1 className="dk-title" style={{ marginTop: '1.6cqw' }}>{request.title}</h1>
        <span className="dk-rule" />
        <p className="dk-sub" style={{ marginTop: '2.6cqw' }}>{subtitle}</p>
      </>
    ),
  });

  /* 2 — the shape of the selection */
  out.push({
    head: 'ما يشمله العرض',
    chip: `${AR_NUM(totalRows)} سجل`,
    note: stamp,
    body: (
      <>
        <div className="dk-tiles" style={{ marginBottom: '4cqw' }}>
          <Tile label="عدد الأقسام" value={AR_NUM(sections.length)} />
          <Tile label="إجمالي السجلات" value={AR_NUM(totalRows)} color="var(--dk-gold-ink)" />
          <Tile label="تاريخ الإصدار" value={today.toISOString().slice(0, 10)} small />
        </div>
        <Bars
          items={sections.map(s => ({
            label: s.source.label,
            value: s.rows.length,
            color: 'var(--dk-navy)',
          }))}
          max={Math.max(1, ...sections.map(s => s.rows.length))}
        />
      </>
    ),
  });

  for (const s of sections) {
    const readiness = !!s.source.criteriaSections;

    /* A divider, so a section starts on its own beat. */
    out.push({
      dark: true,
      note: stamp,
      body: (
        <>
          <p className="dk-kicker">قسم</p>
          <h2 className="dk-title" style={{ marginTop: '1.4cqw' }}>{s.source.label}</h2>
          <span className="dk-rule" />
          <p className="dk-sub" style={{ marginTop: '2.4cqw' }}>
            {AR_NUM(s.rows.length)} سجل · {s.source.group}
          </p>
        </>
      ),
    });

    if (readiness && s.records.length) out.push(...readinessSlides(s, stamp));

    /* The rows, paged. Last, because a table is evidence, not an argument. */
    if (s.rows.length) {
      const pages = chunk(s.rows, ROWS_PER_SLIDE);
      pages.forEach((page, i) => {
        out.push({
          head: s.source.label,
          chip: pages.length > 1 ? `${AR_NUM(i + 1)} من ${AR_NUM(pages.length)}` : `${AR_NUM(s.rows.length)} سجل`,
          note: stamp,
          body: (
            <table className="dk-table">
              <thead>
                <tr>{s.columns.map((c, j) => <th key={j}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {page.map((r, j) => (
                  <tr key={j}>{r.map((cell, k) => <td key={k} title={cell}>{cell || '—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          ),
        });
      });
    }
  }

  /* Closing */
  out.push({
    dark: true,
    note: stamp,
    body: (
      <div style={{ textAlign: 'center' }}>
        {brand?.logo?.fullOnDark && <img className="dk-logo" src={brand.logo.fullOnDark} alt="" />}
        <p className="dk-kicker" style={{ marginTop: '4cqw' }}>انتهى العرض</p>
        <h2 className="dk-title" style={{ marginTop: '1.4cqw', fontSize: '4.4cqw' }}>شكراً لكم</h2>
      </div>
    ),
  });

  return out;
}

/* ── What a readiness section has to say ─────────────────── */
function readinessSlides(s, stamp) {
  const out = [];
  const scored = s.records
    .map(r => ({ rec: r, score: scoreOf(r) }))
    .filter(x => x.score != null);

  if (!scored.length) return out;

  const avg = scored.reduce((a, x) => a + x.score, 0) / scored.length;
  const byBand = BANDS.map(b => ({
    band: b,
    n: scored.filter(x => bandOf(x.score).label === b.label).length,
  }));

  /* Distribution — the one slide a manager actually needs. */
  out.push({
    head: `${s.source.label} — التوزيع`,
    chip: `متوسط ${AR_NUM(avg.toFixed(1))} من ١٠`,
    note: stamp,
    body: (
      <>
        <div className="dk-tiles" style={{ marginBottom: '4.5cqw' }}>
          <Tile label="عدد المراكز" value={AR_NUM(scored.length)} />
          <Tile label="متوسط الجاهزية" value={AR_NUM(avg.toFixed(1))} color={bandOf(avg).color} />
          {byBand.map(b => (
            <Tile key={b.band.label} label={b.band.label} value={AR_NUM(b.n)} color={b.band.color} />
          ))}
        </div>
        <Bars
          items={byBand.map(b => ({ label: b.band.label, value: b.n, color: b.band.color }))}
          max={Math.max(1, ...byBand.map(b => b.n))}
        />
      </>
    ),
  });

  /* Top and bottom, side by side — the comparison people ask for out loud. */
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 5);
  const low = sorted.slice(-5).reverse();
  out.push({
    head: `${s.source.label} — الأعلى والأدنى`,
    chip: `${AR_NUM(scored.length)} مركز`,
    note: stamp,
    body: (
      <div className="dk-cols">
        <Rank title="الأعلى جاهزية" list={top} tone="#15803D" />
        <Rank title="الأدنى جاهزية" list={low} tone="#B91C1C" />
      </div>
    ),
  });

  /* Where it fails. Counting "لا" per criterion turns sixty inspections into
     the five things worth fixing this week. */
  const all = s.source.criteriaSections.flatMap(sec => sec.criteria);
  const fails = all
    .map(q => ({
      q,
      n: s.records.filter(r => {
        const a = (r.answers || {})[q.id] ?? (r.answers || {})[String(q.id)];
        return a === 'لا';
      }).length,
    }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);

  if (fails.length) {
    out.push({
      head: `${s.source.label} — أكثر المخالفات تكراراً`,
      chip: `${AR_NUM(fails.length)} معيار`,
      note: stamp,
      body: (
        <Bars
          items={fails.map(f => ({
            label: `${AR_NUM(f.q.id)} · ${f.q.text}`,
            value: f.n,
            color: '#B91C1C',
            wide: true,
          }))}
          max={Math.max(...fails.map(f => f.n))}
        />
      ),
    });
  }

  return out;
}

/* ── Pieces ──────────────────────────────────────────────── */
function Tile({ label, value, color, small }) {
  return (
    <div className="dk-tile" style={color ? { '--dk-tile': color } : undefined}>
      <span>{label}</span>
      <strong style={small ? { fontSize: '2.6cqw', marginTop: '1.4cqw' } : undefined}>{value}</strong>
    </div>
  );
}

function Bars({ items, max }) {
  return (
    <div className="dk-bars">
      {items.map((it, i) => (
        <div className="dk-bar" key={i}
          style={it.wide ? { gridTemplateColumns: '42cqw 1fr 7cqw' } : undefined}>
          <span className="dk-bar-label" title={it.label}>{it.label}</span>
          <span className="dk-bar-track">
            <span className="dk-bar-fill"
              style={{
                width: `${Math.max(3, (it.value / max) * 100)}%`,
                background: `linear-gradient(90deg, ${it.color}, color-mix(in srgb, ${it.color} 62%, #fff))`,
              }} />
          </span>
          <span className="dk-bar-val">{AR_NUM(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Rank({ title, list, tone }) {
  return (
    <div className="dk-rank">
      <p className="dk-rank-h" style={{ color: tone }}>{title}</p>
      {list.map((x, i) => (
        <div className="dk-rank-row" key={i}>
          <span className="dk-medal" style={{ background: tone }}>{AR_NUM(i + 1)}</span>
          <b>{x.rec.center || '—'}</b>
          <i style={{ color: bandOf(x.score).color }}>{AR_NUM(x.score.toFixed(1))}</i>
        </div>
      ))}
    </div>
  );
}
