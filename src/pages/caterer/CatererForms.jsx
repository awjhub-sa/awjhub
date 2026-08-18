/**
 * src/pages/caterer/CatererForms.jsx
 *
 * The forms this caterer owes, and the ones already filed.
 *
 * `form_assignments` has carried a `caterer_id` and a due date since the forms
 * feature was built — the rows were always theirs, there was simply no door
 * they could come in through. This is that door.
 *
 * The sheet itself is FormFill, unchanged: it was written with an `as` prop
 * whose default is 'caterer', so the caterer's view of a form is the one it
 * already knew how to draw. Reusing it means an admin reviewing a submission
 * and the caterer who filed it are looking at the same document, which is the
 * only way the two can ever agree about what was submitted.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, CheckCircle, Clock, WarningCircle } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { db } from '../../lib/db.js';
import { STATUS_META } from '../../config/formSchema.js';
import FormFill from '../../components/forms/FormFill.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const AR = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const ms = (v) => (v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0));
const day = (v) => (v ? new Date(ms(v)).toISOString().slice(0, 10) : null);

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

  const sorted = useMemo(() => {
    const rank = (r) => (r.status === 'submitted' || r.status === 'accepted' ? 1 : 0);
    return [...rows].sort((a, b) => rank(a) - rank(b) || ms(a.dueAt) - ms(b.dueAt));
  }, [rows]);

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

  if (loading) {
    return <div className="py-20 flex justify-center">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>;
  }

  if (!sorted.length) {
    return (
      <div className="bg-white rounded-2xl border border-line py-14 flex flex-col items-center gap-2">
        <FileText size={28} weight="bold" className="text-muted/40" />
        <p className="text-[13px] font-black text-ink">لا نماذج مسنَدة إليك</p>
        <p className="text-[11px] font-bold text-muted">ستظهر هنا فور إسنادها من الإدارة</p>
      </div>
    );
  }

  const dueCount = sorted.filter(a => a.status !== 'submitted' && a.status !== 'accepted').length;
  const lateCount = sorted.filter(a =>
    a.status !== 'submitted' && a.status !== 'accepted' && a.dueAt && ms(a.dueAt) < Date.now()).length;

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        kicker={caterer?.name || 'المتعهد'}
        Icon={FileText}
        title="النماذج"
        subtitle="النماذج المسنَدة إليك ومواعيد استحقاقها"
        stats={[
          { value: AR(sorted.length), label: 'نموذج' },
          { value: AR(dueCount), label: 'مستحق', tone: dueCount ? 'gold' : undefined },
          ...(lateCount ? [{ value: AR(lateCount), label: 'متأخر', tone: 'alert' }] : []),
        ]}
      />

      <div className="space-y-2.5">
      {sorted.map(a => {
        const t = templateById[a.templateId];
        const st = STATUS_META[a.status] || STATUS_META.pending;
        const done = a.status === 'submitted' || a.status === 'accepted';
        const late = !done && a.dueAt && ms(a.dueAt) < Date.now();
        return (
          <button key={a.id} onClick={() => setOpenId(a.id)}
            className="w-full text-right bg-white rounded-2xl border border-line p-4 flex items-start gap-3
                       hover:border-primary/40 transition-colors">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: done
                ? 'color-mix(in srgb, #16A34A 12%, #fff)'
                : late ? 'color-mix(in srgb, #DC2626 12%, #fff)'
                : 'color-mix(in srgb, #B99A64 14%, #fff)' }}>
              {done ? <CheckCircle size={17} weight="fill" className="text-success" />
                : late ? <WarningCircle size={17} weight="fill" className="text-error" />
                : <FileText size={17} weight="bold" style={{ color: '#8C7038' }} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <b className="text-[13px] text-ink">{t?.name || 'نموذج'}</b>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: `color-mix(in srgb, ${st.color} 14%, #fff)`, color: st.color }}>
                  {st.label}
                </span>
              </span>
              <span className="block text-[11px] font-bold text-muted mt-1">
                {a.formNumber && <>{a.formNumber} · </>}
                {centerById[a.centerId]?.code || 'كل المراكز'}
                {a.dueAt && (
                  <> · <span className={late ? 'text-error' : ''}>
                    {late ? 'تأخّر عن ' : 'يستحق '}{AR(day(a.dueAt))}
                  </span></>
                )}
              </span>
              {a.submittedAt && (
                <span className="block text-[10px] font-bold text-success mt-1 flex items-center gap-1">
                  <Clock size={10} weight="bold" />أُرسل {AR(day(a.submittedAt))}
                </span>
              )}
              {a.reviewNote && (
                <span className="block text-[10.5px] text-ink/80 mt-1.5 leading-relaxed
                                 border-r-2 border-line pr-2">
                  ملاحظة المراجعة: {a.reviewNote}
                </span>
              )}
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
