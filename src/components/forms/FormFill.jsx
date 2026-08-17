/**
 * src/components/forms/FormFill.jsx
 *
 * Opens one assignment and fills it. The same FormDocument that drew the blanks
 * in the builder now draws real inputs in their place — there is no second
 * layout to keep in step.
 *
 * The caterer portal will mount this component unchanged; only the surrounding
 * chrome differs. Admins get the review actions, caterers do not.
 */

import { useEffect, useMemo, useState } from 'react';
import FormDocument from './FormDocument.jsx';
import { db, uploadFile, serverTimestamp } from '../../lib/db.js';
import {
  resolveSources, validateForm, STATUS_META, isOverdue, daysLate, keysOwnedBy,
} from '../../config/formSchema.js';
import {
  X, FloppyDisk as Save, PaperPlaneTilt, CheckCircle, ArrowUUpLeft,
  Warning, Clock, CircleNotch, Sparkle,
} from '@phosphor-icons/react';

export default function FormFill({
  assignment,
  template,
  caterer,
  center,
  season,
  actorUid,
  /* Which role has the pen. Admins open the same sheet to review, so they see
     the caterer's view rather than gaining edit rights over the signature. */
  as = 'caterer',
  canReview = false,
  onClose,
}) {
  const definition = template?.definition || { blocks: [], fields: {} };

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [busy,   setBusy]   = useState(null);   // 'draft' | 'submit' | 'accept' | 'return' | key being uploaded
  const [notice, setNotice] = useState(null);

  /* Autofilled values are recomputed from the live records on every open rather
     than frozen at assignment time: if a caterer's CR number is corrected in
     the registry, the form should show the correction, not the old value. */
  const auto = useMemo(
    () => resolveSources(definition.fields, { caterer, center, season }),
    [definition.fields, caterer, center, season],
  );

  useEffect(() => {
    setValues({ ...auto, ...(assignment?.data || {}) });
  }, [assignment?.id, auto]);

  const readOnly = ['submitted', 'accepted'].includes(assignment?.status);
  const meta     = STATUS_META[assignment?.status] || STATUS_META.pending;
  const late     = isOverdue(assignment) && assignment?.status !== 'accepted';

  /* Fields the caterer owns that nonetheless arrived with a value proposed
     from the registry — these are the ones worth pointing at. */
  const prefilled = useMemo(
    () => keysOwnedBy(definition, as).filter(k => auto[k] !== undefined && auto[k] !== ''),
    [definition, as, auto],
  );

  const change = async (key, value, opts = {}) => {
    if (!opts.file) {
      setValues(p => ({ ...p, [key]: value }));
      setErrors(p => (p[key] ? { ...p, [key]: undefined } : p));
      return;
    }
    /* Images go to storage immediately: holding a File in state until submit
       means a failed upload surfaces at the worst moment, after the caterer
       thinks they are done. */
    setBusy(key);
    try {
      const ext = (value.name.split('.').pop() || 'png').toLowerCase();
      const url = await uploadFile('forms', `${assignment.id}/${key}.${ext}`, value);
      setValues(p => ({ ...p, [key]: url }));
    } catch (ex) {
      setNotice(`تعذّر رفع الملف: ${ex.message}`);
    }
    setBusy(null);
  };

  const log = (event, note) =>
    db.form_events.insert({ assignmentId: assignment.id, event, actorUid: actorUid ?? null, note: note ?? null })
      .catch(() => { /* the audit trail must never block the caterer */ });

  const saveDraft = async () => {
    setBusy('draft');
    try {
      await db.form_assignments.update(assignment.id, { data: values, status: 'draft' });
      log('saved');
      setNotice('حُفظت المسودة.');
    } catch (ex) { setNotice(ex.message); }
    setBusy(null);
  };

  const submit = async () => {
    /* Scoped to what the caterer owns. Blanks the admin left are the admin's to
       chase; blocking the caterer on them would strand a form nobody can move.
       Authoring errors (__token_) are likewise not theirs to fix. */
    const found = validateForm(definition, values, { owner: 'caterer' });
    const forUser = Object.fromEntries(Object.entries(found).filter(([k]) => !k.startsWith('__token_')));
    if (Object.keys(forUser).length) {
      setErrors(forUser);
      setNotice(`أكمل ${Object.keys(forUser).length} حقلاً مطلوباً قبل التسليم.`);
      return;
    }
    if (template?.requiresSignature && !values.signature) {
      setNotice('التوقيع مطلوب قبل التسليم.');
      return;
    }

    setBusy('submit');
    try {
      await db.form_assignments.update(assignment.id, {
        data: values,
        status: 'submitted',
        submittedAt: serverTimestamp(),
      });
      log('submitted');
      setNotice('تم التسليم.');
    } catch (ex) { setNotice(ex.message); }
    setBusy(null);
  };

  const review = async (status) => {
    const note = status === 'returned' ? prompt('سبب الإعادة للتعديل:') : null;
    if (status === 'returned' && !note) return;
    setBusy(status);
    try {
      await db.form_assignments.update(assignment.id, {
        status,
        reviewedBy: actorUid ?? null,
        reviewedAt: serverTimestamp(),
        reviewNote: note,
      });
      log(status === 'accepted' ? 'accepted' : 'returned', note);
      setNotice(status === 'accepted' ? 'قُبل النموذج.' : 'أُعيد للتعديل.');
    } catch (ex) { setNotice(ex.message); }
    setBusy(null);
  };

  const Btn = ({ onClick, disabled, tone, Icon, children }) => (
    <button
      onClick={onClick}
      disabled={!!busy || disabled}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-50 ${
        tone === 'primary' ? 'text-white hover:opacity-90'
        : tone === 'success' ? 'text-white hover:opacity-90'
        : 'border border-line text-muted hover:text-ink hover:bg-background'
      }`}
      style={
        tone === 'primary' ? { background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }
        : tone === 'success' ? { background: 'linear-gradient(135deg,#16A34A,#15803D)' }
        : undefined
      }
    >
      {busy && Icon ? <CircleNotch size={15} className="animate-spin" /> : Icon && <Icon size={15} />}
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas" dir="rtl">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 bg-white border-b border-line px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted hover:text-ink transition-colors flex-shrink-0">
            <X size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink truncate">{template?.title}</h1>
            <p className="text-[10px] text-muted truncate">
              {assignment?.formNumber} · {caterer?.name || '—'}{center?.code ? ` · ${center.code}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full text-white whitespace-nowrap"
            style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}DD)` }}>
            {meta.label}
          </span>
          {assignment?.dueAt && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap ${late ? 'text-red-600' : 'text-muted'}`}>
              <Clock size={12} />
              {late ? `متأخر ${daysLate(assignment)} يوم` : new Date(assignment.dueAt).toISOString().slice(0, 10)}
            </span>
          )}

          {!readOnly && (
            <>
              <Btn onClick={saveDraft} Icon={busy === 'draft' ? CircleNotch : Save}>حفظ كمسودة</Btn>
              <Btn onClick={submit} tone="primary" Icon={busy === 'submit' ? CircleNotch : PaperPlaneTilt}>تسليم</Btn>
            </>
          )}
          {canReview && assignment?.status === 'submitted' && (
            <>
              <Btn onClick={() => review('returned')} Icon={ArrowUUpLeft}>إعادة للتعديل</Btn>
              <Btn onClick={() => review('accepted')} tone="success" Icon={CheckCircle}>قبول</Btn>
            </>
          )}
        </div>
      </div>

      {/* Without this, a caterer opening a form whose blanks are already filled
          assumes it is finished and never checks whether the proposed values
          are still current. */}
      {!readOnly && prefilled.length > 0 && (
        <div className="mx-4 mt-3 bg-accent/8 border border-accent/25 rounded-xl px-3 py-2.5 text-xs text-ink flex items-start gap-2">
          <Sparkle size={14} className="text-accent-600 mt-0.5 flex-shrink-0" />
          <span className="leading-relaxed">
            عُبّئت {prefilled.length === 1 ? 'خانة' : `${prefilled.length} خانات`} من بياناتك المسجّلة لدينا
            ({prefilled.map(k => definition.fields[k]?.label || k).join('، ')}).
            <b> راجعها وعدّلها إن تغيّرت</b>، ثم وقّع واختم.
          </span>
        </div>
      )}

      {notice && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2.5 text-sm font-medium flex items-start gap-2">
          <Warning size={15} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-amber-600 hover:text-amber-900"><X size={14} /></button>
        </div>
      )}

      {assignment?.reviewNote && assignment.status === 'returned' && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm">
          <b>سبب الإعادة:</b> {assignment.reviewNote}
        </div>
      )}

      <div className="p-4 sm:p-6 flex justify-center">
        <FormDocument
          definition={definition}
          mode={readOnly ? 'view' : 'fill'}
          as={as}
          values={values}
          errors={errors}
          onChange={change}
          title={template?.title}
          formNumber={assignment?.formNumber}
          meta={[caterer?.name, center?.code, season?.name].filter(Boolean).join(' · ')}
        />
      </div>
    </div>
  );
}
