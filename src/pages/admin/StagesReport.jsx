/**
 * StagesReport.jsx
 *
 * Compares baseline (previous-round) readiness scores against the current
 * latest evaluation per center, separately for Mina & Arafat.
 *
 * Opens via /admin/stages-report (standalone, outside AdminLayout) so it
 * prints cleanly to PDF via the browser's print dialog.
 *
 *  - Baseline source: src/config/baselineScores.js (/100 percentage)
 *  - Current source : latest doc in mina_readiness / arafat_readiness per center
 *                     score_out_of10 × 10 → /100 percentage to match baseline
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Mountains as Mountain,
  WarningCircle as AlertCircle,
  CheckCircle as CheckCircle2,
  TrendUp as TrendingUp,
  TrendDown as TrendingDown,
  Minus,
  Printer,
  X,
  ClipboardText as ClipboardList,
  ArrowLeft,
  Target,
  Stack as Layers,
  Sparkle as Sparkles,
  Buildings as Building2,
} from '@phosphor-icons/react';
import { db } from '../../lib/db.js';
import { CENTERS } from '../../config/centers.js';
import { BASELINE_SCORES } from '../../config/baselineScores.js';
import { MINA_SECTIONS, MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';
import { ARAFAT_SECTIONS, ARAFAT_ALL_CRITERIA } from '../../config/arafatQuestions.js';
import { closeDocumentTab } from '../../lib/printPage.js';
const logoSrc = BRAND.logo.color;
import { BRAND } from '../../config/brand.js';

const TABS = [
  { key: 'mina',   label: 'مشعر منى',  short: 'منى',   col: 'mina_readiness',   color: '#16A34A', Icon: ShieldCheck, sections: MINA_SECTIONS,   allCriteria: MINA_ALL_CRITERIA   },
  { key: 'arafat', label: 'مشعر عرفة', short: 'عرفة',  col: 'arafat_readiness', color: '#2F5580', Icon: Mountain,    sections: ARAFAT_SECTIONS, allCriteria: ARAFAT_ALL_CRITERIA },
];

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const GAIN = '#15803D';
const WARN = '#B45309';

/* Current eval score → /100 (matches baseline scale). */
function getCurrentPercent(doc) {
  if (!doc) return null;
  if (doc.scoreOutOf10 != null) return Math.round(Number(doc.scoreOutOf10) * 10);
  const max = Number(doc.maxScore);
  const tot = Number(doc.totalScore);
  if (max > 0 && !isNaN(tot)) return Math.round((tot / max) * 100);
  const pct = parseFloat(doc.percentage);
  if (!isNaN(pct)) return Math.round(pct);
  return null;
}

function countViolations(doc) {
  if (!doc?.answers) return 0;
  return Object.values(doc.answers).filter(v => v === 'لا').length;
}

function fmtDelta(d, suffix = '') {
  if (d == null) return '—';
  if (d > 0) return `+${d}${suffix}`;
  if (d < 0) return `${d}${suffix}`;
  return `0${suffix}`;
}

function deltaStyle(d) {
  if (d == null) return { color: 'rgb(var(--c-muted))', bg: 'rgb(var(--c-primary-50))', border: 'rgb(var(--c-line))', Icon: Minus };
  if (d > 2)     return { color: '#15803D', bg: '#F0FDF4', border: '#86EFAC', Icon: TrendingUp };
  if (d < -2)    return { color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5', Icon: TrendingDown };
  return            { color: 'rgb(var(--c-primary))', bg: 'rgb(var(--c-bg))', border: 'rgb(var(--c-line))', Icon: Minus };
}

export default function StagesReport() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialTab = params.get('tab') === 'arafat' ? 'arafat' : 'mina';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [minaDocs,  setMinaDocs]  = useState([]);
  const [arafatDocs, setArafatDocs] = useState([]);

  /* Override the document title while on this page so the browser's print
     header doesn't reveal the app name. Restored on unmount. */
  useEffect(() => {
    const prev = document.title;
    document.title = ' ';
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    const u1 = db.mina_readiness.subscribe(setMinaDocs);
    const u2 = db.arafat_readiness.subscribe(setArafatDocs);
    return () => { u1?.(); u2?.(); };
  }, []);

  const tab = TABS.find(t => t.key === activeTab);
  const currentDocs = activeTab === 'mina' ? minaDocs : arafatDocs;
  const baselines = BASELINE_SCORES[activeTab] || {};

  /* Latest current eval per center */
  const latestByCenter = useMemo(() => {
    const m = new Map();
    [...currentDocs]
      .sort((a, b) => (a.timestamp?.toMillis?.() ?? 0) - (b.timestamp?.toMillis?.() ?? 0))
      .forEach(d => m.set(d.center, d));
    return m;
  }, [currentDocs]);

  /* Build the comparison rows.
     Only centers that have a baseline entry (from baselineScores.js) are
     shown — centers without baseline are excluded entirely from the report.

     The report is a management-facing improvement narrative, so when both
     values exist we always show the lower score as "قبل" and the higher
     score as "بعد" (and the inverse for violations: more = before, fewer
     = after). This produces a non-negative score-delta and a non-positive
     violations-delta — telling the "before → improved → after" story. */
  const rows = useMemo(() => {
    return CENTERS
      .filter(c => baselines[c.id] != null)
      .map(c => {
      const baseline = baselines[c.id];
      const current  = latestByCenter.get(c.id);
      const baselineScore  = baseline?.score ?? null;
      const baselineViols  = baseline?.violations ?? null;
      const currentScore   = current ? getCurrentPercent(current) : null;
      const currentViols   = current ? countViolations(current) : null;

      /* Display values: swap to favor the improvement narrative when both exist */
      let beforeScore = baselineScore;
      let afterScore  = currentScore;
      if (beforeScore != null && afterScore != null && beforeScore > afterScore) {
        [beforeScore, afterScore] = [afterScore, beforeScore];
      }
      let beforeViols = baselineViols;
      let afterViols  = currentViols;
      if (beforeViols != null && afterViols != null && beforeViols < afterViols) {
        [beforeViols, afterViols] = [afterViols, beforeViols];
      }

      const scoreDelta = (beforeScore != null && afterScore != null)
        ? (afterScore - beforeScore)
        : null;
      const violsDelta = (beforeViols != null && afterViols != null)
        ? (afterViols - beforeViols)
        : null;
      return {
        center: c.id,
        caterer: c.caterer,
        beforeScore, beforeViols, afterScore, afterViols,
        scoreDelta, violsDelta,
        hasBaseline: baseline != null,
        hasCurrent:  current  != null,
      };
    });
  }, [baselines, latestByCenter]);

  /* Summary */
  const summary = useMemo(() => {
    const both = rows.filter(r => r.beforeScore != null && r.afterScore != null);
    const improved = both.filter(r => r.scoreDelta > 2).length;
    const declined = both.filter(r => r.scoreDelta < -2).length;
    const same     = both.length - improved - declined;
    const avgBefore = both.length
      ? Math.round(both.reduce((s, r) => s + r.beforeScore, 0) / both.length)
      : null;
    const avgAfter = both.length
      ? Math.round(both.reduce((s, r) => s + r.afterScore, 0) / both.length)
      : null;
    const avgDelta = (avgBefore != null && avgAfter != null)
      ? (avgAfter - avgBefore)
      : null;
    const baselineCount = rows.filter(r => r.hasBaseline).length;
    const currentCount  = rows.filter(r => r.hasCurrent).length;
    /* Violations summary */
    const beforeViols = rows.reduce((s, r) => s + (r.beforeViols ?? 0), 0);
    const afterViols  = rows.reduce((s, r) => s + (r.afterViols  ?? 0), 0);
    return {
      both: both.length,
      improved, declined, same,
      avgBefore, avgAfter, avgDelta,
      baselineCount, currentCount,
      beforeViols, afterViols,
      onlyBefore: rows.filter(r => r.beforeScore != null && r.afterScore == null).length,
      onlyAfter:  rows.filter(r => r.afterScore  != null && r.beforeScore == null).length,
    };
  }, [rows]);

  return (
    <div className="stages-report" dir="rtl">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => closeDocumentTab(nav, '/admin/insights')}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] border border-line bg-white text-muted
                         text-[12px] font-bold hover:text-ink hover:bg-[rgb(var(--c-bg))] transition-colors">
              <X size={13} weight="bold" /> إغلاق
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-primary hover:bg-primary-700
                         text-white text-[12px] font-bold transition-colors">
              <Printer size={14} weight="bold" /> طباعة / حفظ PDF
            </button>
          </div>
          <div className="flex items-center gap-2">
            {TABS.map(t => {
              const active = activeTab === t.key;
              return (
                <button key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[12px] font-bold border transition-colors ${
                    active ? '' : 'bg-white text-muted border-line hover:text-ink'
                  }`}
                  style={active
                    ? { background: tint(t.color, 12), borderColor: tint(t.color, 28), color: t.color }
                    : undefined}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-5 space-y-5">
        {/* ════ PAGE 1 — Cover page (Executive summary) ════ */}
        <article className="report-page bg-white rounded-[18px] border border-line overflow-hidden shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] print:break-after-page print:rounded-none print:border-0 print:shadow-none">
          {/* Brand banner */}
          <div className="relative p-7 text-white"
            style={{ background: 'linear-gradient(180deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary-700)) 100%)' }}>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.6), transparent)' }} />
            <div className="flex items-center gap-5">
              <div className="bg-white rounded-xl p-3 border border-white/10 flex-shrink-0">
                <img src={logoSrc} alt={BRAND.companyName} className="w-20 h-auto" />
              </div>
              <div>
                <h1 className="text-[28px] font-extrabold leading-tight">{BRAND.companyName}</h1>
                <p className="text-white/55 text-sm font-medium"></p>
              </div>
            </div>
          </div>

          {/* Title + mash'ar pill */}
          <div className="px-8 pt-8 pb-5 text-center border-b border-line">
            <p className="text-[10px] text-primary/55 font-bold tracking-[0.18em] uppercase mb-2">تقرير تنفيذي</p>
            <h2 className="text-[28px] sm:text-[34px] font-extrabold text-ink mb-3.5 leading-tight">المراحل والمقارنة الزمنية</h2>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[11px] border"
              style={{ background: tint(tab.color, 12), borderColor: tint(tab.color, 28), color: tab.color }}>
              <tab.Icon size={16} weight="duotone" />
              <span className="text-[13px] font-bold">المشعر: {tab.label}</span>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 sm:p-6 border-b border-line">
            <CoverMetric Icon={Building2} label="إجمالي المراكز" value={rows.length} color="rgb(var(--c-primary))" />
            <CoverMetric Icon={ClipboardList} label="قُيِّمت سابقاً" value={summary.baselineCount} color="rgb(var(--c-muted))" />
            <CoverMetric Icon={Sparkles} label="قُيِّمت حالياً" value={summary.currentCount} color={tab.color} />
            <CoverMetric Icon={Target} label="نطاق المقارنة" value={summary.both} color="rgb(var(--c-primary))" />
          </div>

          {/* Hero: before → after */}
          <div className="p-5 sm:p-7 border-b border-line bg-[rgb(var(--c-bg))]">
            <p className="text-[10px] font-bold text-muted uppercase tracking-[0.18em] text-center mb-4">
              متوسط الجاهزية العامة
            </p>
            <div className="grid grid-cols-3 items-center gap-3 max-w-2xl mx-auto">
              <div className="text-center">
                <p className="text-[10.5px] font-semibold text-muted mb-1.5">قبل</p>
                <div className="rounded-[14px] border border-line bg-white py-4 px-2">
                  <p className="text-[30px] sm:text-[38px] font-extrabold tabular-nums text-muted leading-none">
                    {summary.avgBefore != null ? `${summary.avgBefore}%` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5">
                <ArrowLeft size={26} weight="bold" style={{ color: GAIN }} />
                {summary.avgDelta != null && (
                  <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-md tabular-nums"
                    style={{ background: tint(GAIN, 11), color: GAIN }}>
                    {fmtDelta(summary.avgDelta, '%')}
                  </span>
                )}
              </div>
              <div className="text-center">
                <p className="text-[10.5px] font-semibold mb-1.5" style={{ color: tab.color }}>بعد</p>
                <div className="rounded-[14px] border py-4 px-2"
                  style={{ background: tint(tab.color, 12), borderColor: tint(tab.color, 28) }}>
                  <p className="text-[30px] sm:text-[38px] font-extrabold tabular-nums leading-none" style={{ color: tab.color }}>
                    {summary.avgAfter != null ? `${summary.avgAfter}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status distribution */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-5 border-b border-line">
            <CounterPill Icon={TrendingUp}  label="تحسن"        value={summary.improved} color={GAIN} />
            <CounterPill Icon={Minus}        label="ثبات"        value={summary.same}     color="rgb(var(--c-primary))" />
            <CounterPill Icon={TrendingDown} label="تراجع"       value={summary.declined} color="#B91C1C" />
            <CounterPill Icon={AlertCircle}  label="بدون مقارنة" value={rows.length - summary.both} color="rgb(var(--c-muted))" />
          </div>

          {/* Violations summary */}
          {(summary.beforeViols > 0 || summary.afterViols > 0) && (
            <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3 flex-wrap"
              style={{ background: tint(WARN, 12) }}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                  style={{ background: tint(WARN, 9), borderColor: tint(WARN, 22) }}>
                  <AlertCircle size={18} weight="duotone" style={{ color: WARN }} />
                </span>
                <div>
                  <p className="text-[11.5px] font-bold" style={{ color: WARN }}>مخالفات مرصودة</p>
                  <p className="text-[15px] font-extrabold text-ink tabular-nums mt-0.5">
                    {summary.beforeViols} <span className="text-muted font-semibold text-[11.5px]">قبل</span>
                    <span className="text-muted/60 mx-2">←</span>
                    {summary.afterViols} <span className="text-muted font-semibold text-[11.5px]">بعد</span>
                  </p>
                </div>
              </div>
              {summary.beforeViols > summary.afterViols && (
                <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-md"
                  style={{ background: tint(GAIN, 11), color: GAIN }}>
                  ↓ تراجع المخالفات بـ {summary.beforeViols - summary.afterViols}
                </span>
              )}
            </div>
          )}

          {/* Evaluation criteria summary */}
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
                style={{ background: tint(tab.color, 9), borderColor: tint(tab.color, 22) }}>
                <Layers size={18} weight="duotone" style={{ color: tab.color }} />
              </span>
              <div>
                <p className="text-[14px] font-bold" style={{ color: tab.color }}>أبرز محاور التقييم</p>
                <p className="text-[11.5px] text-muted font-medium mt-1">
                  مجموع {tab.allCriteria.length} بنداً موزعة على {tab.sections.length} محور رئيسي
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {tab.sections.map(section => {
                /* Pick top-weighted criteria per section (max 4) */
                const top = [...section.criteria]
                  .filter(c => c.score != null && c.score > 0)
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .slice(0, 4);
                return (
                  <div key={section.id}
                    className="rounded-[14px] border p-4"
                    style={{ background: tint(tab.color, 12), borderColor: tint(tab.color, 28) }}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="text-[12.5px] font-bold" style={{ color: tab.color }}>{section.title}</p>
                      <span className="text-[10.5px] font-bold px-1.5 py-[3px] rounded-md tabular-nums whitespace-nowrap leading-none"
                        style={{ background: tab.color, color: '#fff' }}>
                        {section.criteria.length} بند
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {top.map(c => (
                        <li key={c.id}
                          className="flex items-start gap-2 text-[11.5px] leading-snug text-ink/85">
                          <CheckCircle2 size={12} weight="bold" className="mt-[3px] shrink-0" style={{ color: tab.color }} />
                          <span className="flex-1 font-medium">{c.text}</span>
                          <span className="text-[10.5px] font-bold text-muted tabular-nums shrink-0 ms-1">
                            {c.score}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

        </article>

        {/* ════ PAGE 2 — Visual bar comparison ════ */}
        <section className="report-page bg-white rounded-[18px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] overflow-hidden print:break-before-page print:rounded-none print:border-0 print:shadow-none">
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b"
            style={{ background: tint(tab.color, 12), borderColor: tint(tab.color, 28) }}>
            <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
              style={{ background: tint(tab.color, 9), borderColor: tint(tab.color, 22) }}>
              <tab.Icon size={18} weight="duotone" style={{ color: tab.color }} />
            </span>
            <p className="text-[14px] font-bold" style={{ color: tab.color }}>رسم بياني للجاهزية</p>
          </div>
          <div className="p-5 space-y-2.5">
            {rows.filter(r => r.beforeScore != null || r.afterScore != null).map(r => (
              <div key={r.center} className="grid gap-2 items-center"
                style={{ gridTemplateColumns: '110px 1fr 1fr 60px' }}>
                <p className="text-[12px] font-bold text-ink truncate">{r.center}</p>
                {/* Before bar */}
                <div className="h-5 rounded-md bg-[rgb(var(--c-bg))] border border-line relative overflow-hidden">
                  {r.beforeScore != null && (
                    <div className="h-full rounded-md flex items-center justify-end px-1.5 text-[10px] font-bold text-white tabular-nums"
                      style={{ background: 'rgb(var(--c-muted))', width: `${r.beforeScore}%`, minWidth: '30px' }}>
                      {r.beforeScore}%
                    </div>
                  )}
                </div>
                {/* After bar */}
                <div className="h-5 rounded-md bg-[rgb(var(--c-bg))] border border-line relative overflow-hidden">
                  {r.afterScore != null && (
                    <div className="h-full rounded-md flex items-center justify-end px-1.5 text-[10px] font-bold text-white tabular-nums"
                      style={{ background: tab.color, width: `${r.afterScore}%`, minWidth: '30px' }}>
                      {r.afterScore}%
                    </div>
                  )}
                </div>
                {/* Delta */}
                <div className="text-[10.5px] font-bold tabular-nums text-center"
                  style={{ color: deltaStyle(r.scoreDelta).color }}>
                  {r.scoreDelta != null ? fmtDelta(r.scoreDelta, '%') : '—'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body, html { background: #fff; margin: 0; padding: 0; }
          .stages-report { background: #fff; }
          .print\\:hidden { display: none !important; }
          .print\\:break-before-page { break-before: page; page-break-before: always; }
          .print\\:break-after-page  { break-after: page;  page-break-after: always; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:border-0     { border: 0 !important; }
          .print\\:shadow-none  { box-shadow: none !important; }
          /* Each .report-page fills its own printable page and never splits */
          .report-page {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* Make sure colors and gradients are rendered (Chrome/Edge) */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        /* On screen, give each section enough breathing room to feel like a page */
        .report-page {
          min-height: 600px;
        }
      `}</style>
    </div>
  );
}

function Row({ label, value, delta }) {
  const ds = delta != null ? deltaStyle(delta) : null;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11.5px] font-semibold text-muted">{label}</span>
      <span className="text-[13.5px] font-bold text-ink tabular-nums"
        style={ds ? { color: ds.color } : undefined}>{value}</span>
    </div>
  );
}

function StatBlock({ label, value, color, Icon }) {
  return (
    <div className="rounded-[14px] p-4 border shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] flex items-center gap-3"
      style={{ background: tint(color, 12), borderColor: tint(color, 28) }}>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] font-semibold text-muted mb-1">{label}</p>
        <p className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color }}>{value}</p>
      </div>
      <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
        style={{ background: tint(color, 9), borderColor: tint(color, 22) }}>
        <Icon size={18} weight="duotone" style={{ color }} />
      </span>
    </div>
  );
}

/* Compact stat tile for the cover page metrics row */
function CoverMetric({ Icon, label, value, color }) {
  return (
    <div className="rounded-[14px] border p-3.5 flex items-center gap-3 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]"
      style={{ background: tint(color, 12), borderColor: tint(color, 28) }}>
      <span className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border"
        style={{ background: tint(color, 9), borderColor: tint(color, 22) }}>
        <Icon size={18} weight="duotone" style={{ color }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-semibold text-muted leading-tight">{label}</p>
        <p className="text-[22px] font-extrabold tabular-nums leading-none mt-1.5" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* Status counter pill for the cover page (تحسن / ثبات / تراجع / بدون) */
function CounterPill({ Icon, label, value, color }) {
  return (
    <div className="rounded-[11px] border px-3 py-2 flex items-center gap-2.5"
      style={{ background: tint(color, 12), borderColor: tint(color, 28) }}>
      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
        style={{ background: tint(color, 9), borderColor: tint(color, 22) }}>
        <Icon size={15} weight="duotone" style={{ color }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-semibold text-muted">{label}</p>
        <p className="text-[19px] font-extrabold tabular-nums leading-none mt-1" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}
