/**
 * src/pages/caterer/CatererForms.jsx
 *
 * The forms this caterer owes, and the ones already filed.
 *
 * `form_assignments` has carried a `caterer_id` and a due date since the forms
 * feature was built — the rows were always theirs, there was simply no door
 * they could come in through. This is that door.
 *
 * A table, because what a caterer does here is scan for what is late: due dates
 * in a column can be compared down the page, where the same dates on a stack of
 * cards must be held in the head one card at a time. Overdue rows carry a red
 * edge so the eye finds them before it reads anything.
 *
 * The sheet itself is FormFill, unchanged: it was written with an `as` prop
 * whose default is 'caterer', so the caterer's view of a form is the one it
 * already knew how to draw. Reusing it means an admin reviewing a submission
 * and the caterer who filed it look at the same document, which is the only way
 * the two can ever agree about what was submitted.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, CheckCircle, WarningCircle, Printer, Eye, Clock } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { db } from '../../lib/db.js';
import { STATUS_META, isPrintable } from '../../config/formSchema.js';
import { LATE, CALM, FORM_STATE, formToneOf } from '../../config/tones.js';
import FormFill from '../../components/forms/FormFill.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const AR = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const ms = (v) => (v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0));
const day = (v) => (v ? AR(new Date(ms(v)).toISOString().slice(0, 10)) : '—');
const isDone = (s) => s === 'submitted' || s === 'accepted';

export default function CatererForms() {
  const { caterer, catererId, centers } = useOutletContext();
  const { profile } = useAuth();

  const [rows, setRows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!catererId) return;
    setLoading(true);
    const [as, tp, se] = await Promise.all([
      db.form_assignments.list({ filter: { catererId } }),
      db.form_templates.list(),
      db.seasons.list(),
    ]);
    setRows(as); setTemplates(tp); setSeasons(se); setLoading(false);
  }, [catererId]);

  useEffect(() => { load(); }, [load]);

  const templateById = useMemo(
    () => Object.fromEntries(templates.map(t => [t.id, t])), [templates]);
  const centerById = useMemo(
    () => Object.fromEntries(centers.map(c => [c.id, c])), [centers]);

  /* Unfinished first, then by how soon it is due — the order in which they
     will be dealt with. */
  const sorted = useMemo(() => [...rows].sort(
    (a, b) => (isDone(a.status) ? 1 : 0) - (isDone(b.status) ? 1 : 0) || ms(a.dueAt) - ms(b.dueAt),
  ), [rows]);

  const due = sorted.filter(a => !isDone(a.status)).length;
  const late = sorted.filter(a => !isDone(a.status) && a.dueAt && ms(a.dueAt) < Date.now()).length;

  const open = sorted.find(a => a.id === openId);
  if (open) {
    return (
      <FormFill
        assignment={open}
        template={templateById[open.templateId]}
        caterer={caterer}
        center={centerById[open.centerId]}
        season={seasons.find(s => s.id === open.seasonId)}
        actorUid={profile?.uid}
        /* No review rights: the caterer files, the office reviews. */
        onClose={() => { setOpenId(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        kicker={caterer?.name || 'المتعهد'}
        Icon={FileText}
        title="النماذج"
        stats={[
          { value: AR(sorted.length), label: 'نموذج' },
          { value: AR(due), label: 'مستحق', tone: due ? 'gold' : undefined },
          ...(late ? [{ value: AR(late), label: 'متأخر', tone: 'alert' }] : []),
        ]}
      />

      <section className="bg-white rounded-2xl border border-line overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <FileText size={34} weight="bold" className="text-muted/40" />
            <p className="text-[15px] font-black text-ink">لا نماذج مسنَدة إليك</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted text-[12.5px] bg-background border-b border-line">
                <tr>
                  <th className="px-5 py-3.5 text-right font-black">النموذج</th>
                  <th className="px-5 py-3.5 text-right font-black">الرقم</th>
                  <th className="px-5 py-3.5 text-right font-black">المركز</th>
                  <th className="px-5 py-3.5 text-right font-black">الاستحقاق</th>
                  <th className="px-5 py-3.5 text-right font-black">الحالة</th>
                  <th className="px-5 py-3.5 text-right font-black">أُرسل</th>
                  <th className="px-5 py-3.5 text-right font-black"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sorted.map(a => {
                  const t = templateById[a.templateId];
                  const st = STATUS_META[a.status] || STATUS_META.pending;
                  const done = isDone(a.status);
                  const overdue = !done && a.dueAt && ms(a.dueAt) < Date.now();
                  const tone = overdue ? LATE : formToneOf(a.status);
                  return (
                    <tr key={a.id} onClick={() => setOpenId(a.id)}
                      className="hover:bg-background/70 cursor-pointer transition-colors"
                      style={{ borderInlineStart: `3px solid ${tone.bar}` }}>
                      <td className="px-5 py-3.5 font-bold text-ink text-[14px]">
                        {t?.title || 'نموذج'}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-[13px] text-muted">
                        {a.formNumber || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[13.5px] text-muted whitespace-nowrap">
                        {centerById[a.centerId]?.code || 'كل المراكز'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {a.dueAt ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-[12px] font-black tabular-nums
                                       px-2.5 py-1 rounded-lg border"
                            /* Three states, three readings: gone, settled,
                               and simply booked. */
                            style={overdue ? { background: LATE.bg, borderColor: LATE.line, color: LATE.ink }
                              : done ? { background: CALM.bg, borderColor: CALM.line, color: CALM.ink }
                              : { background: FORM_STATE.pending.bg, borderColor: FORM_STATE.pending.line,
                                  color: FORM_STATE.pending.ink }}
                          >
                            {overdue
                              ? <WarningCircle size={13} weight="fill" />
                              : <Clock size={13} weight="bold" />}
                            {overdue ? 'تأخّر عن' : 'موعد أقصاه'} {day(a.dueAt)}
                          </span>
                        ) : (
                          <span className="text-[13px] text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-black px-2.5 py-1
                                         rounded-full whitespace-nowrap border"
                          style={{ background: tone.bg, color: tone.ink, borderColor: tone.line }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.bar }} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-muted whitespace-nowrap tabular-nums">
                        {a.submittedAt
                          ? <span className="font-black inline-flex items-center gap-1"
                              style={{ color: FORM_STATE.accepted.ink }}>
                              <CheckCircle size={13} weight="fill" />{day(a.submittedAt)}
                            </span>
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {/* The same two the office has, and the same sheet:
                            printing opens the identical route, so a filing and
                            its copy cannot differ. Deleting is not offered —
                            the assignment is the office's record of what it
                            asked for. */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenId(a.id); }}
                            title="فتح النموذج"
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold px-2.5 py-1.5 rounded-lg
                                       border border-primary/25 text-primary hover:bg-primary/5 transition-colors">
                            <Eye size={14} weight="bold" />
                            فتح
                          </button>
                          {isPrintable(a.status) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(`/forms/print/${a.id}`, '_blank'); }}
                              title="طباعة النموذج"
                              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold px-2.5 py-1.5 rounded-lg
                                         border border-line text-muted hover:border-primary/40 hover:text-primary transition-colors">
                              <Printer size={14} weight="bold" />
                              طباعة
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Review notes belong under the table, not squeezed into a cell — they
          are sentences, and a column would either clip them or ruin the row. */}
      {sorted.some(a => a.reviewNote) && (
        <section className="bg-white rounded-2xl border border-line overflow-hidden">
          <header className="px-5 py-4 border-b border-line">
            <p className="text-[15px] font-black text-ink">ملاحظات المراجعة</p>
          </header>
          {sorted.filter(a => a.reviewNote).map(a => (
            <button key={a.id} onClick={() => setOpenId(a.id)}
              className="w-full text-right px-5 py-4 border-b border-line/60 last:border-0 hover:bg-background">
              <p className="text-[13.5px] font-bold text-ink">
                {templateById[a.templateId]?.title || 'نموذج'}
                {a.formNumber && <span className="text-muted font-bold mr-2">{a.formNumber}</span>}
              </p>
              <p className="text-[13px] text-ink/80 leading-relaxed mt-1 border-r-2 border-line pr-2.5">
                {a.reviewNote}
              </p>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
