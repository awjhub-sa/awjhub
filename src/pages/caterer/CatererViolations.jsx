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
import { Surface, IconTile, Pill } from '../../components/ui/index.jsx';
import DataTable from '../../components/DataTable.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/* A verb's colour, and the surface derived from it — the same one wherever the
   verb appears. */
const actionStyle = (name) => ({
  background: tint(ACTION[name].ink, 10),
  borderColor: tint(ACTION[name].ink, 24),
  color: ACTION[name].ink,
});

/* The photographs the office attached, as files rather than as a view. Reading
   them inside the sheet is not the same as having them: an answer often has to
   be written away from the screen, and by someone who was not the one to open
   the portal. */
function Files({ list, tone, formNumber }) {
  const files = (Array.isArray(list) ? list : []).filter(Boolean);
  if (!files.length) return <span className="text-muted/40 text-[12.5px]">—</span>;
  return (
    <span className="flex flex-wrap gap-1" style={{ maxWidth: 108 }}>
      {files.map((u, i) => (
        <a key={i} onClick={e => e.stopPropagation()}
          href={asDownload(u, `${tone.label} ${formNumber} - ${i + 1}${extOf(u)}`)} download
          title={`تحميل ${tone.label} ${i + 1}`}
          className="w-[26px] h-[26px] rounded-[9px] border flex items-center justify-center
                     text-[11px] font-bold tabular-nums transition-colors hover:brightness-[0.97]"
          style={{ background: tint(tone.bar, 10), borderColor: tint(tone.bar, 26), color: tone.ink }}>
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
    <div className="fixed inset-0 z-[70] bg-[rgb(var(--c-ink)/0.45)] flex items-center justify-center p-4"
      onClick={onClose} dir="rtl">
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-[16px] border border-line w-full max-w-lg overflow-hidden
                   shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)]">
        <header className="px-5 py-3.5 border-b flex items-center gap-3"
          style={{ background: tint(NOTE.bar, 12), borderColor: tint(NOTE.bar, 28) }}>
          <IconTile Icon={NotePencil} color={NOTE.bar} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-bold leading-tight" style={{ color: NOTE.ink }}>ملاحظة على المحضر</h3>
            <p className="text-[11.5px] font-medium text-muted mt-1" dir="ltr">{row.formNumber}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center
                       text-muted hover:text-ink transition-colors shrink-0">
            <X size={14} weight="bold" />
          </button>
        </header>

        <div className="p-5 space-y-2.5">
          <textarea rows={6} autoFocus value={text} onChange={e => setText(e.target.value)}
            placeholder="اكتب ملاحظتك — اعتراض، توضيح ظرف، أو أي شيء تودّ أن تصل به الإدارة…"
            className="w-full rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] text-ink leading-relaxed
                       resize-y focus:outline-none focus:border-primary/50 transition-colors" />
          <p className="text-[11.5px] font-medium text-muted flex items-center gap-1.5">
            <Info size={12} weight="bold" className="shrink-0" />
            تصل الإدارة مع ردّك، ولا تُطبع على المحضر.
          </p>
          {err && <p className="text-[11.5px] font-bold" style={{ color: '#DC2626' }}>{err}</p>}
        </div>

        <footer className="px-5 py-4 border-t border-line flex items-center justify-end gap-2.5">
          <button onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-[12px] font-bold border border-line text-muted
                       hover:bg-[rgb(var(--c-bg))] transition-colors">
            إلغاء
          </button>
          <button onClick={save} disabled={busy}
            className="px-5 py-2 rounded-[10px] text-[12px] font-bold text-white bg-primary border border-primary
                       hover:opacity-90 disabled:opacity-50 transition-opacity">
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
          <div className="w-7 h-7 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
        </div>
      ) : violations.length === 0 ? (
        <Surface>
          <div className="py-14 px-5 text-center">
            <ShieldCheck size={26} weight="duotone" className="mx-auto" style={{ color: '#15803D' }} />
            <p className="text-[13px] font-semibold text-ink mt-3">لا مخالفات على منشأتك</p>
            <p className="text-[11.5px] font-medium text-muted mt-1">سجلّك نظيف هذا الموسم</p>
          </div>
        </Surface>
      ) : (
        <Surface className="overflow-hidden">
          <DataTable>
            <table className="w-full text-[13px]">
              <thead className="text-muted text-[11px] border-b border-line bg-[rgb(var(--c-bg))]">
                <tr>
                  <th className="px-5 py-3 text-start font-bold">المخالفة</th>
                  <th className="px-5 py-3 text-start font-bold">الرقم</th>
                  <th className="px-5 py-3 text-start font-bold whitespace-nowrap">صور المخالفة</th>
                  <th className="px-5 py-3 text-start font-bold">المركز</th>
                  <th className="px-5 py-3 text-start font-bold">الخطورة</th>
                  <th className="px-5 py-3 text-start font-bold">المهلة</th>
                  <th className="px-5 py-3 text-start font-bold whitespace-nowrap">مرفقات ردّك</th>
                  <th className="px-5 py-3 text-start font-bold">ملاحظتك</th>
                  <th className="px-5 py-3 text-start font-bold">الحالة</th>
                  <th className="px-5 py-3 text-start font-bold"></th>
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
                      className="hover:bg-[rgb(var(--c-bg))] cursor-pointer transition-colors"
                      style={{ borderInlineStart: `3px solid ${
                        late ? LATE.bar : done ? STATE.accepted.bar : sev?.bar || STATE.pending.bar}` }}>
                      <td className="px-5 py-3.5 font-bold text-ink text-[13.5px]">
                        <span className="block max-w-[300px] line-clamp-2 leading-relaxed">
                          {a.data?.description || 'محضر مخالفة'}
                        </span>
                        {a.data?.shakhis && (
                          <span className="block text-[11px] font-medium text-muted mt-1" dir="ltr">
                            شاخص {a.data.shakhis}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-[12.5px] font-medium text-muted" dir="ltr">
                        {a.formNumber || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Files list={a.data?.evidence} tone={ATTACH.evidence} formNumber={a.formNumber} />
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] font-medium text-muted whitespace-nowrap">
                        {a.centerId ? centerLabel(centerById[a.centerId]?.code) : 'المنشأة'}
                      </td>
                      <td className="px-5 py-3.5">
                        {sev
                          ? <Pill color={sev.ink}>{a.data.severity}</Pill>
                          : <span className="text-muted/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {a.dueAt ? (
                          <Pill className="tabular-nums"
                            Icon={late ? WarningCircle : Clock}
                            color={late ? LATE.ink : done ? 'rgb(var(--c-muted))' : SEVERITY['متوسطة'].ink}>
                            {late ? `تأخّر ${AR(daysLate(a))} يوم` : 'مهلة حتى'} {late ? '' : day(a.dueAt)}
                          </Pill>
                        ) : <span className="text-muted/40">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <Files list={a.data?.remedy_evidence} tone={ATTACH.remedy_evidence}
                          formNumber={a.formNumber} />
                      </td>
                      <td className="px-5 py-3.5 max-w-[220px]">
                        {a.data?.notes ? (
                          <button onClick={(e) => { e.stopPropagation(); if (!done) setNoteFor(a); }}
                            className={`text-start w-full ${done ? 'cursor-default' : ''}`}>
                            <span className="block text-[12px] leading-relaxed text-ink line-clamp-2 ps-2 border-s-2"
                              style={{ borderColor: NOTE.bar }}>{a.data.notes}</span>
                            {!done && (
                              <span className="text-[10.5px] font-bold mt-1 inline-block"
                                style={{ color: NOTE.ink }}>تعديل</span>
                            )}
                          </button>
                        ) : done ? (
                          <span className="text-muted/40">—</span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setNoteFor(a); }}
                            className="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1.5 rounded-[10px]
                                       border border-dashed transition-colors hover:brightness-[0.97]"
                            style={{ background: tint(NOTE.bar, 10), borderColor: tint(NOTE.bar, 30), color: NOTE.ink }}>
                            <NotePencil size={12} weight="bold" />
                            إضافة ملاحظة
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Pill color={st.ink}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.bar }} />
                          {st.label}
                        </Pill>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenId(a.id); }}
                            style={actionStyle('view')}
                            className="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1.5 rounded-[10px]
                                       border transition-colors hover:brightness-[0.97]">
                            <Eye size={13} weight="bold" />
                            {done ? 'عرض' : 'الردّ'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(`/forms/print/${a.id}`, '_blank'); }}
                            style={actionStyle('print')}
                            className="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1.5 rounded-[10px]
                                       border transition-colors hover:brightness-[0.97]">
                            <Printer size={13} weight="bold" />
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
        </Surface>
      )}

      {noteFor && (
        <NoteDialog row={noteFor} onClose={() => setNoteFor(null)}
          onSaved={() => { setNoteFor(null); load(); }} />
      )}

      {!loading && violations.length > 0 && openCount === 0 && (
        <p className="text-center text-[11.5px] font-semibold flex items-center justify-center gap-1.5"
          style={{ color: '#15803D' }}>
          <CheckCircle size={13} weight="bold" />
          أفدتَ عن كل المخالفات المسجّلة
        </p>
      )}
    </div>
  );
}
