/**
 * src/pages/caterer/CatererViolations.jsx
 *
 * Violations, from the caterer's side.
 *
 * The office writes the notice; this screen is where it is read and answered.
 * A violation is not a form they were asked to produce — it is an assertion
 * about their work with a clock on it — so it gets its own section rather than
 * sitting among the documents they owe, and the row leads with what was
 * alleged and how long is left.
 *
 * The sheet itself is the same FormFill the office reviews, with the caterer's
 * pen: a statement of what they did, photographs that show it, and a signature.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db, asDownload } from '../../lib/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { daysLate } from '../../config/formSchema.js';
import FormFill from '../../components/forms/FormFill.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { toast } from '../../lib/toast.js';
import { ACTION, SEVERITY, STATE, stateOf, LATE, ATTACH, NOTE, extOf } from '../../config/tones.js';
import DataTable from '../../components/DataTable.jsx';

/* The photographs the office attached, as files rather than as a view. Reading
   them inside the sheet is not the same as having them: an answer often has to
   be written away from the screen, and by someone who was not the one to open
   the portal. */
function Files({ list, tone, formNumber }) {
  const files = (Array.isArray(list) ? list : []).filter(Boolean);
  if (!files.length) return <span className="text-muted/30 text-xs">—</span>;
  return (
    <span className="flex flex-wrap gap-1" style={{ maxWidth: 108 }}>
      {files.map((u, i) => (
        <a key={i} onClick={e => e.stopPropagation()}
          href={asDownload(u, `${tone.label} ${formNumber} - ${i + 1}${extOf(u)}`)} download
          title={`تحميل ${tone.label} ${i + 1}`}
          className="w-[26px] h-[26px] rounded-lg border flex items-center justify-center
                     text-[11px] font-black tabular-nums transition-transform hover:scale-110"
          style={{ background: tone.bg, borderColor: tone.line, color: tone.ink }}>
          {AR(i + 1)}
        </a>
      ))}
    </span>
  );
}

import { X, Info, NotePencil,
  Warning, CheckCircle, WarningCircle, Clock, Eye, Printer, ShieldCheck,
} from '@phosphor-icons/react';

const AR  = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const ms  = (v) => (v ? new Date(v).getTime() : 0);
const centerLabel = (code) => (!code ? '—' : /^مركز/.test(String(code).trim()) ? code : `مركز ${code}`);
const day = (v) => (v ? AR(new Date(v).toISOString().slice(0, 10)) : '—');

const isDone = (s) => s === 'submitted' || s === 'accepted';


/* A remark about the minute rather than on it: the caterer may disagree, or
   explain a circumstance, without that ending up printed on the office's own
   record. Written before the answer is filed, and sealed with it. */
function NoteDialog({ row, onClose, onSaved }) {
  const [text, setText] = useState(row.data?.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    setBusy(true);
    try {
      await db.form_assignments.update(row.id, { data: { ...(row.data || {}), notes: text.trim() } });
      toast.ok(text.trim() ? 'حُفظت ملاحظتك' : 'حُذفت الملاحظة',
        text.trim() ? `تصل الإدارة مع ردّك على ${row.formNumber}` : null);
      onSaved();
    } catch (ex) { setErr(ex.message); toast.fail('تعذّر حفظ الملاحظة', ex.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-ink/45 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose} dir="rtl">
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl border border-line w-full max-w-lg overflow-hidden shadow-2xl">
        <header className="px-5 py-4 border-b border-line flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <NotePencil size={17} weight="bold" className="text-primary" />
          </span>
          <div className="flex-1">
            <h3 className="text-[15px] font-black text-ink leading-tight">ملاحظة على المحضر</h3>
            <p className="text-[11.5px] font-bold text-muted mt-0.5" dir="ltr">{row.formNumber}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors"><X size={18} /></button>
        </header>

        <div className="p-5 space-y-2">
          <textarea rows={6} autoFocus value={text} onChange={e => setText(e.target.value)}
            placeholder="اكتب ملاحظتك — اعتراض، توضيح ظرف، أو أي شيء تودّ أن تصل به الإدارة…"
            className="w-full rounded-xl border border-line px-3.5 py-2.5 text-[13.5px] leading-relaxed
                       resize-y focus:outline-none focus:ring-2 focus:ring-primary/25" />
          <p className="text-[11.5px] font-bold text-muted flex items-center gap-1.5">
            <Info size={13} weight="bold" />
            تصل الإدارة مع ردّك، ولا تُطبع على المحضر.
          </p>
          {err && <p className="text-[12px] font-bold text-red-600">{err}</p>}
        </div>

        <footer className="px-5 py-3.5 border-t border-line bg-bg flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] font-bold text-muted hover:text-ink transition-colors">
            إلغاء
          </button>
          <button onClick={save} disabled={busy}
            className="px-5 py-2 rounded-xl text-[13px] font-black text-white bg-primary
                       hover:brightness-110 disabled:opacity-50 transition-all">
            {busy ? 'يُحفظ…' : 'حفظ الملاحظة'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function CatererViolations() {
  const { caterer, catererId, centers } = useOutletContext();
  const { profile } = useAuth();

  const [rows, setRows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [noteFor, setNoteFor] = useState(null);

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

  /* Which of this caterer's assignments are notices rather than requests. */
  const violations = useMemo(() => rows
    .filter(a => templateById[a.templateId]?.definition?.kind === 'violation')
    .sort((a, b) =>
      (isDone(a.status) ? 1 : 0) - (isDone(b.status) ? 1 : 0) || ms(a.dueAt) - ms(b.dueAt)),
    [rows, templateById]);

  const openCount = violations.filter(a => !isDone(a.status)).length;
  const lateCount = violations.filter(a => !isDone(a.status) && a.dueAt && ms(a.dueAt) < Date.now()).length;

  const open = violations.find(a => a.id === openId);
  if (open) {
    return (
      <FormFill
        assignment={open}
        template={templateById[open.templateId]}
        caterer={caterer}
        center={centerById[open.centerId]}
        season={seasons.find(s => s.id === open.seasonId)}
        actorUid={profile?.uid}
        onClose={() => { setOpenId(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        kicker={caterer?.name || 'المتعهد'}
        Icon={Warning}
        title="المخالفات"
        stats={[
          { value: AR(violations.length), label: 'محضر' },
          { value: AR(openCount), label: 'بانتظار إفادتك', tone: openCount ? 'gold' : undefined },
          { value: AR(lateCount), label: 'تجاوز المهلة', tone: lateCount ? 'alert' : undefined },
        ]}
      />

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : violations.length === 0 ? (
        <section className="bg-white rounded-2xl border border-line py-16 flex flex-col items-center gap-2">
          <ShieldCheck size={38} weight="fill" className="text-success" />
          <p className="text-[17px] font-black text-ink">لا مخالفات على منشأتك</p>
          <p className="text-[13.5px] font-bold text-muted">سجلّك نظيف هذا الموسم</p>
        </section>
      ) : (
        <section className="bg-white rounded-2xl border border-line overflow-hidden">
          <DataTable>
            <table className="w-full text-[13.5px]">
              <thead className="text-muted text-[12px] border-b border-line bg-bg">
                <tr>
                  <th className="px-5 py-3.5 text-right font-black">المخالفة</th>
                  <th className="px-5 py-3.5 text-right font-black">الرقم</th>
                  <th className="px-5 py-3.5 text-right font-black whitespace-nowrap">صور المخالفة</th>
                  <th className="px-5 py-3.5 text-right font-black">المركز</th>
                  <th className="px-5 py-3.5 text-right font-black">الخطورة</th>
                  <th className="px-5 py-3.5 text-right font-black">المهلة</th>
                  <th className="px-5 py-3.5 text-right font-black whitespace-nowrap">مرفقات ردّك</th>
                  <th className="px-5 py-3.5 text-right font-black">ملاحظتك</th>
                  <th className="px-5 py-3.5 text-right font-black">الحالة</th>
                  <th className="px-5 py-3.5 text-right font-black"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {violations.map(a => {
                  const st = stateOf(a.status);
                  const done = isDone(a.status);
                  const late = !done && a.dueAt && ms(a.dueAt) < Date.now();
                  const sev = SEVERITY[a.data?.severity];
                  return (
                    <tr key={a.id} onClick={() => setOpenId(a.id)}
                      className="hover:bg-background/70 cursor-pointer transition-colors"
                      style={{ borderInlineStart: `3px solid ${
                        late ? LATE.bar : done ? STATE.accepted.bar : sev?.bar || STATE.pending.bar}` }}>
                      <td className="px-5 py-3.5 font-bold text-ink">
                        <span className="block max-w-[300px] line-clamp-2 leading-relaxed">
                          {a.data?.description || 'محضر مخالفة'}
                        </span>
                        {a.data?.shakhis && (
                          <span className="block text-[11.5px] font-bold text-muted mt-0.5" dir="ltr">
                            شاخص {a.data.shakhis}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-[13px] text-muted" dir="ltr">
                        {a.formNumber || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Files list={a.data?.evidence} tone={ATTACH.evidence} formNumber={a.formNumber} />
                      </td>
                      <td className="px-5 py-3.5 text-[13.5px] text-muted whitespace-nowrap">
                        {a.centerId ? centerLabel(centerById[a.centerId]?.code) : 'المنشأة'}
                      </td>
                      <td className="px-5 py-3.5">
                        {sev ? (
                          <span className="text-[11.5px] font-black px-2.5 py-1 rounded-lg whitespace-nowrap border"
                            style={{ background: sev.bg, color: sev.ink, borderColor: sev.line }}>{a.data.severity}</span>
                        ) : <span className="text-muted/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {a.dueAt ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-black tabular-nums
                                           px-2.5 py-1 rounded-lg border"
                            style={late ? { background: LATE.bg, borderColor: LATE.line, color: LATE.ink }
                              : done ? { background: '#F8FAFC', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }
                              : { background: SEVERITY['متوسطة'].bg, borderColor: SEVERITY['متوسطة'].line, color: SEVERITY['متوسطة'].ink }}>
                            {late ? <WarningCircle size={13} weight="fill" /> : <Clock size={13} weight="bold" />}
                            {late ? `تأخّر ${AR(daysLate(a))} يوم` : 'مهلة حتى'} {late ? '' : day(a.dueAt)}
                          </span>
                        ) : <span className="text-muted/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <Files list={a.data?.remedy_evidence} tone={ATTACH.remedy_evidence}
                          formNumber={a.formNumber} />
                      </td>
                      <td className="px-5 py-3.5 max-w-[220px]">
                        {a.data?.notes ? (
                          <button onClick={(e) => { e.stopPropagation(); if (!done) setNoteFor(a); }}
                            className={`text-right w-full ${done ? 'cursor-default' : ''}`}>
                            <span className="block text-[12px] leading-relaxed text-ink line-clamp-2 pr-2 border-r-2"
                              style={{ borderColor: NOTE.bar }}>{a.data.notes}</span>
                            {!done && (
                              <span className="text-[10.5px] font-black mt-0.5 inline-block"
                                style={{ color: NOTE.ink }}>تعديل</span>
                            )}
                          </button>
                        ) : done ? (
                          <span className="text-muted/40">—</span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setNoteFor(a); }}
                            className="inline-flex items-center gap-1.5 text-[12px] font-black px-2.5 py-1.5 rounded-lg
                                       border border-dashed transition-colors hover:brightness-95"
                            style={{ background: NOTE.bg, borderColor: NOTE.line, color: NOTE.ink }}>
                            <NotePencil size={13} weight="bold" />
                            إضافة ملاحظة
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-black px-2.5 py-1
                                         rounded-full whitespace-nowrap border"
                          style={{ background: st.bg, color: st.ink, borderColor: st.line }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.bar }} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenId(a.id); }}
                            style={{ background: ACTION.view.bg, color: ACTION.view.ink, borderColor: ACTION.view.line }}
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-black px-2.5 py-1.5 rounded-lg
                                       border transition-colors hover:brightness-95">
                            <Eye size={14} weight="bold" />
                            {done ? 'عرض' : 'الردّ'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(`/forms/print/${a.id}`, '_blank'); }}
                            style={{ background: ACTION.print.bg, color: ACTION.print.ink, borderColor: ACTION.print.line }}
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-black px-2.5 py-1.5 rounded-lg
                                       border transition-colors hover:brightness-95">
                            <Printer size={14} weight="bold" />
                            طباعة
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        </section>
      )}

      {noteFor && (
        <NoteDialog row={noteFor} onClose={() => setNoteFor(null)}
          onSaved={() => { setNoteFor(null); load(); }} />
      )}

      {!loading && violations.length > 0 && openCount === 0 && (
        <p className="text-center text-[12.5px] font-bold text-success flex items-center justify-center gap-1.5">
          <CheckCircle size={15} weight="fill" />
          أفدتَ عن كل المخالفات المسجّلة
        </p>
      )}
    </div>
  );
}
