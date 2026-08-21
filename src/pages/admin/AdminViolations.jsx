/**
 * src/pages/admin/AdminViolations.jsx
 *
 * Violations, from the office's side.
 *
 * A violation is a form — the same assignment row, the same document engine,
 * the same portal and print route and audit trail as everything else in the
 * forms module. What it is not is a form the office *asks* for: it is one the
 * office *writes*, and the caterer answers. So it gets a section of its own
 * rather than a filter on a list of requests, and the composer here asks for
 * the substance of the notice in one pass instead of walking through a generic
 * assign wizard built for handing out blanks.
 *
 * Everything the composer collects lands in `data` exactly as the caterer's own
 * answers will, because the sheet does not care who filled which blank — only
 * `owner` does, and that is declared on the template.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { db, uploadFile, asDownload, serverTimestamp } from '../../lib/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBrand } from '../../context/BrandContext.jsx';
import {
  isOverdue, daysLate, isPrintable,
  keysOwnedBy, resolveSources, validateForm,
} from '../../config/formSchema.js';
import FormFill from '../../components/forms/FormFill.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { toast } from '../../lib/toast.js';
import { SEVERITY, STATE, stateOf, LATE, ATTACH, NOTE, extOf , actionTone } from '../../config/tones.js';
import { seasonLabel } from '../../lib/hijri.js';
import DataTable from '../../components/DataTable.jsx';
import { IconTile } from '../../components/ui/index.jsx';
import {
  NotePencil, Warning, Plus, X, Eye, Printer, Trash as Trash2,
  CircleNotch, CheckCircle, Buildings,
} from '@phosphor-icons/react';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;
const ALERT = '#DC2626';

const inputCls =
  'w-full px-3.5 py-2.5 border border-line rounded-[10px] text-[13px] font-medium text-ink outline-none focus:border-primary transition-colors placeholder-muted/40 bg-white';

const AR  = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const centerLabel = (code) => (!code ? '—' : /^مركز/.test(String(code).trim()) ? code : `مركز ${code}`);
const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '—');



const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-[11.5px] font-bold text-muted mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10.5px] text-muted mt-1">{hint}</p>}
  </div>
);



/* Each attachment reachable on its own, in the row itself. A menu was the
   wrong shape twice over — it hid the count behind a click, and the table's
   horizontal scroll clipped everything below the first entry. */
function Files({ list, tone, formNumber }) {
  const files = (Array.isArray(list) ? list : []).filter(Boolean);
  if (!files.length) return <span className="text-muted/30 text-xs">—</span>;
  return (
    <span className="flex flex-wrap gap-1" style={{ maxWidth: 108 }}>
      {files.map((u, i) => (
        <a key={i} href={asDownload(u, `${tone.label} ${formNumber} - ${i + 1}${extOf(u)}`)} download
          title={`تحميل ${tone.label} ${i + 1}`}
          className="w-[26px] h-[26px] rounded-md border flex items-center justify-center
                     text-[11px] font-bold tabular-nums transition-colors hover:brightness-95"
          style={{ background: tone.bg, borderColor: tone.line, color: tone.ink }}>
          {AR(i + 1)}
        </a>
      ))}
    </span>
  );
}

export default function AdminViolations() {
  const { profile } = useAuth();
  const { brand } = useBrand();

  const [templates,   setTemplates]   = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [caterers,    setCaterers]    = useState([]);
  const [centers,     setCenters]     = useState([]);
  const [officials,   setOfficials]   = useState([]);
  const [seasons,     setSeasons]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [notice,      setNotice]      = useState(null);

  const [byCaterer, setByCaterer] = useState('');
  const [byStatus,  setByStatus]  = useState('');

  const [compose,  setCompose]  = useState(null);   // the notice being written
  const [saving,   setSaving]   = useState(false);
  const [uploading, setUploading] = useState(null);
  const [openId,   setOpenId]   = useState(null);

  useEffect(() => {
    const u = [
      db.form_templates.subscribe(rows => { setTemplates(rows); setLoading(false); }),
      db.form_assignments.subscribe(setAssignments, { orderBy: 'assignedAt', ascending: false }),
      db.caterers.subscribe(setCaterers, { orderBy: 'name', ascending: true }),
      db.centers.subscribe(setCenters),
      db.center_officials.subscribe(setOfficials),
      db.seasons.subscribe(setSeasons),
    ];
    return () => u.forEach(f => f());
  }, []);

  const activeSeason = seasons.find(s => s.isActive) || seasons[0] || null;
  const catererById  = useMemo(() => Object.fromEntries(caterers.map(c => [c.id, c])), [caterers]);
  const centerById   = useMemo(() => Object.fromEntries(centers.map(c => [c.id, c])), [centers]);
  const headByCenter = useMemo(
    () => Object.fromEntries(officials.filter(o => o.isPrimary).map(o => [o.centerId, o])), [officials]);
  const withHead = (c) => (c ? { ...c, headName: headByCenter[c.id]?.name, headPhone: headByCenter[c.id]?.phone } : c);

  const company = useMemo(() => ({
    name: brand.companyFullAr, short: brand.companyName,
    licenseNumber: brand.facility?.licenseNumber,
    facilityName:  brand.facility?.facilityName,
    murabba:       brand.facility?.murabba,
  }), [brand]);

  /* The template is found by what it is, not by a key typed twice. */
  const template = useMemo(
    () => templates.find(t => t.definition?.kind === 'violation' && t.active), [templates]);

  const rows = useMemo(() => {
    if (!template || !activeSeason) return [];
    return assignments.filter(a => a.templateId === template.id && a.seasonId === activeSeason.id);
  }, [assignments, template, activeSeason]);

  const visible = useMemo(() => rows.filter(a =>
    (!byCaterer || a.catererId === byCaterer) && (!byStatus || a.status === byStatus)
  ), [rows, byCaterer, byStatus]);

  const stats = useMemo(() => ({
    total:   rows.length,
    waiting: rows.filter(a => ['pending', 'draft', 'returned'].includes(a.status)).length,
    answered: rows.filter(a => a.status === 'submitted').length,
    closed:  rows.filter(a => a.status === 'accepted').length,
    late:    rows.filter(a => isOverdue(a) && a.status !== 'accepted').length,
  }), [rows]);

  /* ── composing ──────────────────────────────── */
  const adminKeys = useMemo(
    () => (template ? keysOwnedBy(template.definition, 'admin') : []), [template]);

  const openCompose = () => {
    const due = new Date();
    due.setDate(due.getDate() + 3);   // a violation is remedied in days, not weeks
    setCompose({
      catererId: '', centerId: '',
      dueAt: due.toISOString().slice(0, 10),
      values: { observed_on: new Date().toISOString().slice(0, 10) },
    });
    setNotice(null);
  };

  const setValue = (key, v) =>
    setCompose(p => ({ ...p, values: { ...p.values, [key]: v } }));

  const upload = async (key, file, many) => {
    setUploading(key);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const url = await uploadFile('forms',
        `violations/draft-${Date.now()}-${Math.floor(performance.now() % 1000)}.${ext}`, file);
      setCompose(p => ({
        ...p,
        values: many
          ? { ...p.values, [key]: [...(p.values[key] || []), url] }
          : { ...p.values, [key]: url },
      }));
    } catch (e) {
      setNotice(`تعذّر رفع الملف: ${e.message}`);
      toast.fail('تعذّر رفع الصورة', e.message);
    }
    setUploading(null);
  };

  const ownCenters = useMemo(() => {
    if (!compose?.catererId || !activeSeason) return [];
    return centers.filter(c => c.seasonId === activeSeason.id && c.catererId === compose.catererId);
  }, [centers, compose?.catererId, activeSeason]);

  const issue = async () => {
    if (!activeSeason) return setNotice('لا يوجد موسم نشط');
    if (!compose.catererId) return setNotice('اختر المتعهد');

    /* Only what the office owes. The caterer's blanks are theirs to fill, and
       blocking on them here would make a notice impossible to send. */
    const errs = validateForm(template.definition, compose.values, { owner: 'admin' });
    const forUser = Object.entries(errs).filter(([k]) => !k.startsWith('__token_'));
    if (forUser.length) return setNotice(forUser[0][1]);

    setSaving(true);
    try {
      const system = resolveSources(template.definition.fields, {
        caterer: catererById[compose.catererId],
        center:  compose.centerId ? withHead(centerById[compose.centerId]) : null,
        season:  activeSeason,
        company,
        assignment: { dueAt: compose.dueAt ? `${compose.dueAt}T23:59:59` : null },
      });

      const created = await db.form_assignments.insert({
        seasonId:   activeSeason.id,
        templateId: template.id,
        catererId:  compose.catererId,
        centerId:   compose.centerId || null,
        dueAt:      compose.dueAt ? new Date(`${compose.dueAt}T23:59:59`) : null,
        assignedBy: profile?.uid ?? null,
        status:     'pending',
        data: { ...system, ...compose.values },
      });
      await db.form_events.insert({
        assignmentId: created.id, event: 'assigned', actorUid: profile?.uid ?? null,
      }).catch(() => {});
      setCompose(null);
      setNotice(`حُرِّر محضر المخالفة لـ ${catererById[compose.catererId]?.name}.`);
      toast.ok(`صدر محضر مخالفة إلى ${catererById[compose.catererId]?.name}`,
        compose.dueAt ? `مهلة المعالجة حتى ${compose.dueAt}` : null);
    } catch (e) {
      setNotice(e.message || 'تعذّر تحرير المحضر');
      toast.fail('تعذّر تحرير المحضر', e.message);
    }
    setSaving(false);
  };

  const remove = async (a) => {
    const who = catererById[a.catererId]?.name || 'المتعهد';
    const answered = ['submitted', 'accepted'].includes(a.status);
    const warn = answered
      ? `سيُحذف المحضر وإفادة ${who} ومرفقاتها. لا يمكن التراجع.`
      : `سيُحذف المحضر من ${who}، ولن يظهر في بوابته.`;
    if (!window.confirm(`${warn}\n\nمتأكد؟`)) return;
    try {
      await db.form_assignments.delete(a.id);
      setNotice('حُذف المحضر.');
      toast.warn(`حُذف محضر ${a.formNumber}`, `لم يعد يظهر في بوابة ${who}`);
    } catch (e) { setNotice(e.message); toast.fail('تعذّر الحذف', e.message); }
  };

  /* Photographs of the breach and of its remedy, ready to hand over. */
  const catererOptions = useMemo(() => {
    const ids = [...new Set(rows.map(a => a.catererId).filter(Boolean))];
    return ids.map(id => ({ id, name: catererById[id]?.name || '—',
                            n: rows.filter(a => a.catererId === id).length }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [rows, catererById]);

  /* ── the sheet, opened for review ───────────── */
  const open = assignments.find(a => a.id === openId);
  if (open) {
    return (
      <FormFill
        assignment={open}
        template={template}
        caterer={catererById[open.catererId]}
        center={centerById[open.centerId]}
        season={seasons.find(s => s.id === open.seasonId)}
        actorUid={profile?.uid}
        as="admin"
        canReview
        onClose={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="إدارة المتعهدين"
        Icon={Warning}
        title="المخالفات"
        stats={[
          { value: AR(stats.total), label: 'محضر' },
          { value: AR(stats.waiting), label: 'بانتظار الردّ', tone: stats.waiting ? 'gold' : undefined },
          { value: AR(stats.late), label: 'تجاوز المهلة', tone: stats.late ? 'alert' : undefined },
          { value: AR(stats.closed), label: 'مُغلق' },
        ]}
        heroActions={
          <button onClick={openCompose} disabled={!template}
            className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-primary border border-primary
                       text-white text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
            <Plus size={15} weight="bold" />
            محضر مخالفة جديد
          </button>
        }
      />

      {notice && (
        <div className="rounded-[10px] border px-4 py-3 flex items-center gap-2"
          style={{ background: tint('rgb(var(--c-primary))', 12), borderColor: tint('rgb(var(--c-primary))', 28) }}>
          <p className="text-[13px] font-bold text-ink flex-1">{notice}</p>
          <button onClick={() => setNotice(null)} className="text-muted hover:text-ink"><X size={15} /></button>
        </div>
      )}

      {!template && !loading && (
        <div className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] p-10 text-center">
          <p className="text-[14px] font-bold text-ink">قالب «محضر مخالفة» غير موجود</p>
          <p className="text-[12.5px] text-muted mt-1.5">شغّل ترحيل النماذج القياسية ليظهر القسم.</p>
        </div>
      )}

      {/* ── the register ── */}
      {template && (
        <section className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] overflow-hidden">
          <div className="p-4 border-b border-line space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[15px] font-bold text-ink">
                {activeSeason ? `مخالفات ${seasonLabel(activeSeason)}` : 'المخالفات'}
              </h2>
              <span className="text-[12px] font-bold text-muted tabular-nums">
                {visible.length === rows.length ? AR(rows.length) : `${AR(visible.length)} من ${AR(rows.length)}`}
              </span>
              {(byCaterer || byStatus) && (
                <button onClick={() => { setByCaterer(''); setByStatus(''); }}
                  className="ms-auto text-[12px] font-bold text-primary hover:underline">عرض الكل</button>
              )}
            </div>
            <div className="nsab-filters flex items-center gap-2 flex-wrap">
              <select value={byCaterer} onChange={e => setByCaterer(e.target.value)}
                className={`${inputCls} w-auto min-w-[220px]`}>
                <option value="">كل المتعهدين</option>
                {catererOptions.map(c => <option key={c.id} value={c.id}>{c.name} ({c.n})</option>)}
              </select>
              <select value={byStatus} onChange={e => setByStatus(e.target.value)}
                className={`${inputCls} w-auto min-w-[150px]`}>
                <option value="">كل الحالات</option>
                {Object.entries(STATE).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <DataTable>
            <table className="w-full text-sm">
              <thead className="text-muted text-[11px] border-b border-line bg-[rgb(var(--c-bg))]">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">الرقم</th>
                  <th className="px-4 py-3 text-start font-bold">المتعهد</th>
                  <th className="px-4 py-3 text-start font-bold">المخالفة</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">صور المخالفة</th>
                  <th className="px-4 py-3 text-start font-bold">الخطورة</th>
                  <th className="px-4 py-3 text-start font-bold">المهلة</th>
                  <th className="px-4 py-3 text-start font-bold">ردّ المتعهد</th>
                  <th className="px-4 py-3 text-start font-bold whitespace-nowrap">مرفقات الردّ</th>
                  <th className="px-4 py-3 text-start font-bold">الحالة</th>
                  <th className="px-4 py-3 text-start font-bold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.length === 0 && (
                  <tr><td colSpan={10} className="p-10 text-center text-muted text-sm">
                    {rows.length === 0 ? 'لا مخالفات مسجّلة' : 'لا مخالفات تطابق هذه التصفية'}
                  </td></tr>
                )}
                {visible.map(a => {
                  const meta = stateOf(a.status);
                  const late = isOverdue(a) && a.status !== 'accepted';
                  const sev  = SEVERITY[a.data?.severity];
                  return (
                  <Fragment key={a.id}>
                    <tr className="hover:bg-[rgb(var(--c-bg))] transition-colors"
                      style={sev ? { borderInlineStart: `3px solid ${sev.bar}` } : undefined}>
                      <td className="px-4 py-3 text-xs text-muted" dir="ltr">{a.formNumber}</td>
                      <td className="px-4 py-3 text-xs text-ink font-medium max-w-[200px]">
                        {catererById[a.catererId]?.name || '—'}
                        {a.centerId && (
                          <span className="block text-[11px] text-muted font-normal mt-0.5">
                            {centerLabel(centerById[a.centerId]?.code)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink max-w-[260px]">
                        <span className="line-clamp-2 leading-relaxed">{a.data?.description || '—'}</span>
                        {a.data?.shakhis && (
                          <span className="block text-[11px] text-muted font-normal mt-0.5" dir="ltr">
                            شاخص {a.data.shakhis}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Files list={a.data?.evidence} tone={ATTACH.evidence} formNumber={a.formNumber} />
                      </td>
                      <td className="px-4 py-3">
                        {sev ? (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap border"
                            style={{ background: sev.bg, color: sev.ink, borderColor: sev.line }}>
                            {a.data.severity}
                          </span>
                        ) : <span className="text-muted/40 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-block px-2 py-1 rounded-md border font-bold tabular-nums" dir="ltr"
                          style={late
                            ? { background: LATE.bg, color: LATE.ink, borderColor: LATE.line }
                            : { background: 'rgb(var(--c-bg))', color: 'rgb(var(--c-muted))', borderColor: 'rgb(var(--c-line))' }}>
                          {day(a.dueAt)}
                        </span>
                        {late && (
                          <span className="block text-[10px] font-bold mt-1" style={{ color: LATE.ink }}>
                            متأخر {AR(daysLate(a))} يوم
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {a.submittedAt ? (
                          <div className="max-w-[240px]">
                            <span className="inline-flex items-center gap-1 font-bold text-[#16A34A]" dir="ltr">
                              <CheckCircle size={12} weight="fill" />{day(a.submittedAt)}
                            </span>
                            {a.data?.caterer_statement && (
                              <span className="block text-[11px] text-muted leading-relaxed mt-1 line-clamp-2">
                                {a.data.caterer_statement}
                              </span>
                            )}
                          </div>
                        ) : <span className="text-muted/40">لم يردّ</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Files list={a.data?.remedy_evidence} tone={ATTACH.remedy_evidence} formNumber={a.formNumber} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1
                                         rounded-md whitespace-nowrap border"
                          style={{ background: meta.bg, color: meta.ink, borderColor: meta.line }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.bar }} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Action onClick={() => setOpenId(a.id)} Icon={Eye} tone="view">
                            {a.status === 'submitted' ? 'مراجعة' : 'فتح'}
                          </Action>
                          {isPrintable(a.status) && (
                            <Action onClick={() => window.open(`/forms/print/${a.id}`, '_blank')} Icon={Printer} tone="print">
                              طباعة
                            </Action>
                          )}
                          <Action onClick={() => remove(a)} Icon={Trash2} tone="danger">حذف</Action>
                        </div>
                      </td>
                    </tr>
                    {a.data?.notes && (
                      /* The caterer's aside about the minute. Under the row it
                         belongs to, not folded into a cell — a remark someone
                         chose to write is worth a line of its own. */
                      <tr key={`${a.id}-note`} style={{ background: NOTE.bg }}>
                        <td colSpan={10} className="px-4 pb-3 pt-0">
                          <div className="flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5"
                            style={{ background: '#fff', borderColor: NOTE.line }}>
                            <NotePencil size={14} weight="bold" className="mt-0.5 shrink-0" style={{ color: NOTE.ink }} />
                            <div className="min-w-0">
                              <span className="block text-[10.5px] font-bold mb-0.5" style={{ color: NOTE.ink }}>
                                ملاحظة المتعهد على المحضر
                              </span>
                              <p className="text-[12.5px] leading-relaxed text-ink whitespace-pre-wrap">
                                {a.data.notes}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        </section>
      )}

      {/* ── the composer ── */}
      {compose && template && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: 'rgb(var(--c-ink) / 0.45)' }}>
          <div className="bg-white rounded-[18px] border border-line shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)] w-full max-w-2xl my-6">
            <div className="px-6 py-4 border-b flex items-center gap-3"
              style={{ background: tint(ALERT, 10), borderColor: tint(ALERT, 26) }}>
              <IconTile Icon={Warning} color={ALERT} size="md" />
              <div className="flex-1">
                <h2 className="font-bold text-ink text-[15px]">محضر مخالفة جديد</h2>
                <p className="text-[11.5px] font-bold text-muted">
                  ما تكتبه هنا هو نصّ المحضر الذي يصل المتعهد
                </p>
              </div>
              <button onClick={() => setCompose(null)}
                className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors">
                <X size={15} className="text-muted" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="المتعهد" required>
                  <select value={compose.catererId}
                    onChange={e => setCompose(p => ({ ...p, catererId: e.target.value, centerId: '' }))}
                    className={inputCls}>
                    <option value="">اختر المتعهد</option>
                    {caterers.filter(c => c.status !== 'archived')
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>

                <Field label="المركز" hint="اتركه فارغاً إن كانت المخالفة على المنشأة لا على مركز بعينه">
                  <select value={compose.centerId}
                    onChange={e => setCompose(p => ({ ...p, centerId: e.target.value }))}
                    className={inputCls} disabled={!compose.catererId}>
                    <option value="">بلا مركز محدّد</option>
                    {ownCenters.map(c => <option key={c.id} value={c.id}>{centerLabel(c.code)}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="مهلة المعالجة" required
                hint="تظهر في المحضر وفي بوابة المتعهد، ومنها يُحتسب التأخير">
                <input type="date" value={compose.dueAt} dir="ltr"
                  onChange={e => setCompose(p => ({ ...p, dueAt: e.target.value }))}
                  className={inputCls} />
              </Field>

              {/* The body of the notice, grouped the way the sheet groups it. */}
              {Object.entries(
                adminKeys.reduce((acc, k) => {
                  const g = template.definition.fields[k]?.group || '';
                  (acc[g] ||= []).push(k);
                  return acc;
                }, {}),
              ).map(([group, keys]) => (
                <div key={group} className="space-y-3">
                  {group && (
                    <p className="text-[11px] font-bold text-primary rounded-md border px-3 py-2"
                      style={{
                        background: tint('rgb(var(--c-primary))', 10),
                        borderColor: tint('rgb(var(--c-primary))', 24),
                      }}>
                      {group}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {keys.map(key => {
                      const def = template.definition.fields[key] || {};
                      const wide = ['textarea', 'files'].includes(def.type);
                      return (
                        <div key={key} className={wide ? 'sm:col-span-2' : undefined}>
                          <Field label={def.label || key} required={def.required}>
                            {def.type === 'textarea' ? (
                              <textarea rows={4} value={compose.values[key] ?? ''}
                                onChange={e => setValue(key, e.target.value)}
                                placeholder="اكتب هنا…"
                                className={`${inputCls} resize-y leading-relaxed`} />
                            ) : def.type === 'select' ? (
                              <select value={compose.values[key] ?? ''}
                                onChange={e => setValue(key, e.target.value)} className={inputCls}>
                                <option value="">اختر</option>
                                {(def.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : def.type === 'files' ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {(compose.values[key] || []).map((u, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 pe-1 ps-2 py-1
                                                           rounded-[10px] border border-line bg-white">
                                    <img src={u} alt="" className="h-9 w-9 object-cover rounded" />
                                    <button type="button" aria-label="إزالة"
                                      onClick={() => setValue(key, (compose.values[key] || []).filter((_, j) => j !== i))}
                                      className="w-4 h-4 rounded text-muted hover:text-red-600 leading-none">×</button>
                                  </span>
                                ))}
                                <label className={`${inputCls} w-auto cursor-pointer text-muted flex items-center text-[12.5px]`}>
                                  <input type="file" accept={def.accept || 'image/*'} multiple className="hidden"
                                    onChange={e => {
                                      [...(e.target.files || [])].forEach(f => upload(key, f, true));
                                      e.target.value = '';
                                    }} />
                                  {uploading === key ? 'جارٍ الرفع…' : '+ إضافة صورة'}
                                </label>
                              </div>
                            ) : def.type === 'file' ? (
                              <div className="flex items-center gap-3">
                                {compose.values[key] && (
                                  <img src={compose.values[key]} alt=""
                                    className="h-10 w-auto object-contain rounded-lg border border-line" />
                                )}
                                <label className={`${inputCls} cursor-pointer text-muted flex items-center`}>
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={e => e.target.files?.[0] && upload(key, e.target.files[0], false)} />
                                  {uploading === key ? 'جارٍ الرفع…'
                                    : compose.values[key] ? 'استبدال الصورة' : 'إرفاق صورة'}
                                </label>
                              </div>
                            ) : (
                              <input
                                type={def.type === 'date' ? 'date' : 'text'}
                                value={compose.values[key] ?? ''}
                                onChange={e => setValue(key, e.target.value)}
                                className={inputCls}
                                dir={def.type === 'date' ? 'ltr' : undefined} />
                            )}
                          </Field>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-line flex items-center gap-2">
              <button onClick={issue} disabled={saving}
                className="flex-1 h-11 rounded-[10px] bg-primary border border-primary text-white text-[13px] font-bold
                           flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? <CircleNotch size={17} weight="bold" className="animate-spin" />
                        : <><Warning size={16} weight="bold" /> تحرير المحضر وإرساله</>}
              </button>
              <button onClick={() => setCompose(null)}
                className="h-11 px-5 rounded-[10px] border border-line bg-white text-[13px] font-bold text-muted hover:bg-[rgb(var(--c-bg))] transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Action({ onClick, Icon, tone, children }) {
  const t = actionTone(tone);
  return (
    <button onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.background = t.ink; e.currentTarget.style.color = '#fff';
                           e.currentTarget.style.borderColor = t.ink; }}
      onMouseLeave={e => { e.currentTarget.style.background = t.bg; e.currentTarget.style.color = t.ink;
                           e.currentTarget.style.borderColor = t.line; }}
      style={{ background: t.bg, color: t.ink, borderColor: t.line }}
      className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md border transition-colors">
      <Icon size={11} weight="bold" /> {children}
    </button>
  );
}
