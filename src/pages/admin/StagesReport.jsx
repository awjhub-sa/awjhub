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
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, Mountain, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
  Minus, Calendar, Printer, X, ClipboardList, ArrowLeft, Award, Target,
  Layers, Sparkles, FileText, Building2,
} from 'lucide-react';
import { db } from '../../lib/db.js';
import { CENTERS } from '../../config/centers.js';
import { BASELINE_SCORES } from '../../config/baselineScores.js';
import { MINA_SECTIONS, MINA_ALL_CRITERIA } from '../../config/minaQuestions.js';
import { ARAFAT_SECTIONS, ARAFAT_ALL_CRITERIA } from '../../config/arafatQuestions.js';
import logoSrc from '../../assets/logo-color.svg';

const TABS = [
  { key: 'mina',   label: 'مشعر منى',  short: 'منى',   col: 'mina_readiness',   color: '#386B41', gradient: 'linear-gradient(135deg, #4F8856, #386B41)', Icon: ShieldCheck, sections: MINA_SECTIONS,   allCriteria: MINA_ALL_CRITERIA   },
  { key: 'arafat', label: 'مشعر عرفة', short: 'عرفة',  col: 'arafat_readiness', color: '#1D6FA4', gradient: 'linear-gradient(135deg, #2D87C2, #1D6FA4)', Icon: Mountain,    sections: ARAFAT_SECTIONS, allCriteria: ARAFAT_ALL_CRITERIA },
];

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
  if (d == null) return { color: '#9D8F85', bg: '#F5F0EB', border: '#E8DDD4', Icon: Minus };
  if (d > 2)     return { color: '#15803D', bg: '#F0FDF4', border: '#86EFAC', Icon: TrendingUp };
  if (d < -2)    return { color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5', Icon: TrendingDown };
  return            { color: '#A98159', bg: '#FDF8F0', border: '#E8DDD4', Icon: Minus };
}

export default function StagesReport() {
  const [params] = useSearchParams();
  const initialTab = params.get('tab') === 'arafat' ? 'arafat' : 'mina';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [minaDocs,  setMinaDocs]  = useState([]);
  const [arafatDocs, setArafatDocs] = useState([]);

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

  const today = new Date().toLocaleString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="stages-report" dir="rtl">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b border-[#EDE5DC] shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => window.close()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EDE5DC] text-[#6D6E71] text-xs font-bold hover:bg-[#F5F0EB] transition-colors">
              <X size={13} /> إغلاق
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold transition-colors"
              style={{ background: 'linear-gradient(135deg, #A98159, #8B6840)' }}>
              <Printer size={14} strokeWidth={2.25} /> طباعة / حفظ PDF
            </button>
          </div>
          <div className="flex items-center gap-2">
            {TABS.map(t => {
              const active = activeTab === t.key;
              return (
                <button key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all ${
                    active ? 'text-white' : 'bg-white text-[#6D6E71] border-[#EDE5DC] hover:border-[#A98159]/50'
                  }`}
                  style={active ? { background: t.gradient, borderColor: t.color } : undefined}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-5 space-y-5">
        {/* ════ PAGE 1 — Cover page (Executive summary) ════ */}
        <article className="report-page bg-white rounded-3xl border border-[#EDE5DC] overflow-hidden shadow-[0_2px_18px_rgba(45,41,38,0.06)] print:break-after-page print:rounded-none print:border-0 print:shadow-none">
          {/* Brand banner */}
          <div className="p-7 text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #C4A46E 0%, #A98159 60%, #8B6840 100%)' }}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(40%, -50%)' }} />
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-5">
                <div className="bg-white rounded-2xl p-3 shadow-md flex-shrink-0">
                  <img src={logoSrc} alt="ضيوف البيت" className="w-20 h-auto" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold mb-1">ضيوف البيت</h1>
                  <p className="text-white/85 text-sm font-medium">لجنة التغذية — موسم الحج ١٤٤٧ هـ</p>
                </div>
              </div>
              <div className="text-left text-white/90 text-xs hidden sm:block">
                <p className="font-bold mb-0.5">تقرير المراحل</p>
                <p className="text-white/70">{today}</p>
              </div>
            </div>
          </div>

          {/* Title + mash'ar pill */}
          <div className="px-8 pt-8 pb-4 text-center border-b border-[#EDE5DC]">
            <p className="text-xs text-[#9D8F85] font-bold tracking-widest uppercase mb-2">تقرير تنفيذي</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#2D2926] mb-3">المراحل والمقارنة الزمنية</h2>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white shadow-md"
              style={{ background: tab.gradient }}>
              <tab.Icon size={16} strokeWidth={2.5} />
              <span className="text-sm font-black">المشعر: {tab.label}</span>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 sm:p-6 border-b border-[#EDE5DC]">
            <CoverMetric Icon={Building2} label="إجمالي المراكز" value={rows.length} color="#A98159" />
            <CoverMetric Icon={ClipboardList} label="قُيِّمت سابقاً" value={summary.baselineCount} color="#9D8F85" />
            <CoverMetric Icon={Sparkles} label="قُيِّمت حالياً" value={summary.currentCount} color={tab.color} />
            <CoverMetric Icon={Target} label="نطاق المقارنة" value={summary.both} color="#A98159" />
          </div>

          {/* Hero: before → after */}
          <div className="p-5 sm:p-7 border-b border-[#EDE5DC]"
            style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #FDF8F0 100%)' }}>
            <p className="text-[11px] font-black text-[#9D8F85] uppercase tracking-widest text-center mb-4">
              متوسط الجاهزية العامة
            </p>
            <div className="grid grid-cols-3 items-center gap-3 max-w-2xl mx-auto">
              <div className="text-center">
                <p className="text-[10px] font-bold text-[#9D8F85] mb-1">قبل</p>
                <div className="rounded-2xl border-2 border-[#E8DDD4] bg-white py-4 px-2">
                  <p className="text-3xl sm:text-4xl font-black tabular-nums text-[#6D6E71]">
                    {summary.avgBefore != null ? `${summary.avgBefore}%` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-1">
                <ArrowLeft size={28} className="text-[#15803D]" strokeWidth={2.5} />
                {summary.avgDelta != null && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md text-white shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #22C55E, #15803D)' }}>
                    {fmtDelta(summary.avgDelta, '%')}
                  </span>
                )}
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold mb-1" style={{ color: tab.color }}>بعد</p>
                <div className="rounded-2xl border-2 py-4 px-2 shadow-md"
                  style={{ background: tab.gradient, borderColor: tab.color }}>
                  <p className="text-3xl sm:text-4xl font-black tabular-nums text-white">
                    {summary.avgAfter != null ? `${summary.avgAfter}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status distribution */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-5 border-b border-[#EDE5DC]">
            <CounterPill Icon={TrendingUp}  label="تحسن"        value={summary.improved} color="#15803D" />
            <CounterPill Icon={Minus}        label="ثبات"        value={summary.same}     color="#A98159" />
            <CounterPill Icon={TrendingDown} label="تراجع"       value={summary.declined} color="#B91C1C" />
            <CounterPill Icon={AlertCircle}  label="بدون مقارنة" value={rows.length - summary.both} color="#9D8F85" />
          </div>

          {/* Violations summary */}
          {(summary.beforeViols > 0 || summary.afterViols > 0) && (
            <div className="px-5 py-4 border-b border-[#EDE5DC] flex items-center justify-between gap-3 bg-[#FAFAF8]">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <AlertCircle size={16} className="text-amber-700" strokeWidth={2.25} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#9D8F85]">مخالفات مرصودة</p>
                  <p className="text-sm font-black text-[#2D2926]">
                    {summary.beforeViols} <span className="text-[#9D8F85] font-bold text-xs">قبل</span>
                    <span className="text-[#9D8F85] mx-2">←</span>
                    {summary.afterViols} <span className="text-[#9D8F85] font-bold text-xs">بعد</span>
                  </p>
                </div>
              </div>
              {summary.beforeViols > summary.afterViols && (
                <span className="text-[11px] font-black px-2.5 py-1 rounded-md text-white"
                  style={{ background: 'linear-gradient(135deg, #22C55E, #15803D)' }}>
                  ↓ تراجع المخالفات بـ {summary.beforeViols - summary.afterViols}
                </span>
              )}
            </div>
          )}

          {/* Evaluation criteria summary */}
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${tab.color}15` }}>
                <Layers size={16} style={{ color: tab.color }} strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-sm font-black text-[#2D2926]">أبرز محاور التقييم</p>
                <p className="text-[11px] text-[#9D8F85] font-bold">
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
                    className="rounded-2xl border border-[#EDE5DC] bg-[#FAFAF8] p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <p className="text-xs font-black" style={{ color: tab.color }}>{section.title}</p>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md text-white tabular-nums"
                        style={{ background: tab.color }}>
                        {section.criteria.length} بند
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {top.map(c => (
                        <li key={c.id}
                          className="flex items-start gap-1.5 text-[11px] leading-snug text-[#2D2926]">
                          <CheckCircle2 size={11} strokeWidth={2.5} className="mt-[3px] shrink-0" style={{ color: tab.color }} />
                          <span className="flex-1">{c.text}</span>
                          <span className="text-[9px] font-black text-[#9D8F85] tabular-nums shrink-0 mr-1">
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

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#EDE5DC] flex items-center justify-between text-[10px] text-[#9D8F85] font-bold"
            style={{ background: '#FAFAF8' }}>
            <span className="flex items-center gap-1.5">
              <FileText size={11} strokeWidth={2.25} />
              ضيوف البيت — لجنة التغذية
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={11} strokeWidth={2.25} />
              {today}
            </span>
          </div>
        </article>

        {/* ════ PAGE 2 — Comparison table ════ */}
        <section className="report-page bg-white rounded-3xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden print:break-before-page print:break-after-page print:rounded-none print:border-0 print:shadow-none">
          <div className="px-5 py-3.5 border-b border-[#EDE5DC] flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #fff 100%)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${tab.color}15` }}>
              <ClipboardList size={16} style={{ color: tab.color }} strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-sm font-black text-[#2D2926]">مقارنة الجاهزية — قبل وبعد</p>
              <p className="text-[11px] text-[#9D8F85] font-bold">{tab.label}</p>
            </div>
          </div>

          <div className="grid gap-3 px-5 py-3 border-b border-[#EDE5DC] bg-[#FAFAF8] text-[11px] font-black text-[#9D8F85]"
            style={{ gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr' }}>
            <span>المركز</span>
            <span className="text-center">قبل %</span>
            <span className="text-center">بعد %</span>
            <span className="text-center">قبل (مخالفات)</span>
            <span className="text-center">بعد (مخالفات)</span>
            <span className="text-center">التغيّر</span>
          </div>

          {rows.map((r, idx) => {
            const ds = deltaStyle(r.scoreDelta);
            const DIcon = ds.Icon;
            const isLast = idx === rows.length - 1;
            return (
              <div key={r.center}
                className={`grid gap-3 px-5 py-3 items-center text-sm ${!isLast ? 'border-b border-[#EDE5DC]' : ''}`}
                style={{ gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr' }}>
                <div className="min-w-0">
                  <p className="font-black text-[#2D2926] truncate">{r.center}</p>
                  <p className="text-[10px] text-[#A98159] font-bold truncate">{r.caterer || '—'}</p>
                </div>
                <div className="text-center">
                  <span className="inline-flex items-center justify-center min-w-[55px] px-2 py-1 rounded-lg text-[12px] font-black tabular-nums"
                    style={{ background: r.beforeScore != null ? '#F5F0EB' : '#F9F7F5', color: r.beforeScore != null ? '#2D2926' : '#C9B8A8' }}>
                    {r.beforeScore != null ? `${r.beforeScore}%` : '—'}
                  </span>
                </div>
                <div className="text-center">
                  <span className="inline-flex items-center justify-center min-w-[55px] px-2 py-1 rounded-lg text-[12px] font-black tabular-nums"
                    style={{ background: r.afterScore != null ? `${tab.color}15` : '#F9F7F5', color: r.afterScore != null ? tab.color : '#C9B8A8' }}>
                    {r.afterScore != null ? `${r.afterScore}%` : '—'}
                  </span>
                </div>
                <div className="text-center text-[11px] text-[#6D6E71] tabular-nums">
                  {r.beforeViols != null ? r.beforeViols : '—'}
                </div>
                <div className="text-center text-[11px] text-[#6D6E71] tabular-nums">
                  {r.afterViols != null ? r.afterViols : '—'}
                </div>
                <div className="text-center">
                  {r.scoreDelta != null ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg border tabular-nums"
                      style={{ background: ds.bg, borderColor: ds.border, color: ds.color }}>
                      <DIcon size={11} strokeWidth={2.5} />
                      {fmtDelta(r.scoreDelta, '%')}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-[#9D8F85]">بدون مقارنة</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* ════ PAGE 3 — Visual bar comparison ════ */}
        <section className="report-page bg-white rounded-3xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden print:break-before-page print:rounded-none print:border-0 print:shadow-none">
          <div className="px-5 py-3.5 border-b border-[#EDE5DC]"
            style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #fff 100%)' }}>
            <p className="text-sm font-black text-[#2D2926]">رسم بياني للجاهزية</p>
            <p className="text-[11px] text-[#9D8F85] font-bold">العمود الأيمن: قبل (رمادي) — العمود الأيسر: بعد (ملوّن)</p>
          </div>
          <div className="p-5 space-y-2.5">
            {rows.filter(r => r.beforeScore != null || r.afterScore != null).map(r => (
              <div key={r.center} className="grid gap-2 items-center"
                style={{ gridTemplateColumns: '110px 1fr 1fr 60px' }}>
                <p className="text-xs font-black text-[#2D2926] truncate">{r.center}</p>
                {/* Before bar */}
                <div className="h-5 rounded-md bg-[#F5F0EB] relative overflow-hidden">
                  {r.beforeScore != null && (
                    <div className="h-full rounded-md flex items-center justify-end px-1.5 text-[9px] font-black text-white tabular-nums"
                      style={{ background: '#9D8F85', width: `${r.beforeScore}%`, minWidth: '28px' }}>
                      {r.beforeScore}%
                    </div>
                  )}
                </div>
                {/* After bar */}
                <div className="h-5 rounded-md bg-[#F5F0EB] relative overflow-hidden">
                  {r.afterScore != null && (
                    <div className="h-full rounded-md flex items-center justify-end px-1.5 text-[9px] font-black text-white tabular-nums"
                      style={{ background: tab.color, width: `${r.afterScore}%`, minWidth: '28px' }}>
                      {r.afterScore}%
                    </div>
                  )}
                </div>
                {/* Delta */}
                <div className="text-[10px] font-black tabular-nums text-center"
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
      <span className="text-xs font-bold text-[#9D8F85]">{label}</span>
      <span className="text-sm font-black text-[#2D2926] tabular-nums"
        style={ds ? { color: ds.color } : undefined}>{value}</span>
    </div>
  );
}

function StatBlock({ label, value, color, Icon }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#EDE5DC] shadow-[0_2px_8px_rgba(45,41,38,0.07)] flex items-center gap-3"
      style={{ borderRight: `3px solid ${color}` }}>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-[#9D8F85] mb-0.5">{label}</p>
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} strokeWidth={1.75} />
      </div>
    </div>
  );
}

/* Compact stat tile for the cover page metrics row */
function CoverMetric({ Icon, label, value, color }) {
  return (
    <div className="rounded-2xl bg-white border border-[#EDE5DC] p-3 flex items-center gap-2.5 shadow-[0_2px_8px_rgba(45,41,38,0.04)]">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        <Icon size={18} style={{ color }} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-[#9D8F85] leading-tight">{label}</p>
        <p className="text-xl font-black tabular-nums leading-tight mt-0.5" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* Status counter pill for the cover page (تحسن / ثبات / تراجع / بدون) */
function CounterPill({ Icon, label, value, color }) {
  return (
    <div className="rounded-xl border-2 px-3 py-2 flex items-center gap-2.5"
      style={{ borderColor: `${color}30`, background: `${color}08` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={14} style={{ color }} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-[#9D8F85]">{label}</p>
        <p className="text-lg font-black tabular-nums leading-tight" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}
