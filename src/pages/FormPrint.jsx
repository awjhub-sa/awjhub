/**
 * src/pages/FormPrint.jsx
 *
 * One accepted form, dressed for paper.
 *
 * Opens in its own tab, like the report document does, so the browser's print
 * dialogue gets a page with nothing else on it — no sidebar to strip out, no
 * drawer to escape. The toolbar is the only thing on screen that is not the
 * document, and `@media print` removes it.
 *
 * Only accepted forms print. A draft on company letterhead, stamped and filed,
 * is a document asserting something that was never agreed — and once it is on
 * paper nothing on it says which it was.
 *
 * The ownership check is not decoration: the route carries an id, and a caterer
 * who edits that id must not be handed another company's filing. It is enforced
 * here because the row-level policies cannot yet tell one caterer from another.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, X, WarningCircle } from '@phosphor-icons/react';
import { db } from '../lib/db.js';
import { useAuth } from '../context/AuthContext.jsx';
import FormDocument from '../components/forms/FormDocument.jsx';
import { useBrand } from '../context/BrandContext.jsx';
import { resolveSources, isPrintable } from '../config/formSchema.js';
import './form-print.css';
import { usePrintPage, closeDocumentTab } from '../lib/printPage.js';

export default function FormPrint() {
  const { id } = useParams();
  const nav = useNavigate();
  const { profile, role } = useAuth();
  const { brand } = useBrand();
  /* 10mm, not 14: the ministry minute is a full-page table and the four extra
     millimetres a side were the difference between one sheet and two. */
  usePrintPage('A4 portrait', '10mm');

  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const assignment = await db.form_assignments.get(id);
        if (!assignment) throw new Error('النموذج غير موجود');

        /* A caterer may print their own filings and no one else's. */
        if (role === 'caterer' && assignment.catererId !== profile?.catererId) {
          throw new Error('هذا النموذج لا يخصّ منشأتك');
        }
        if (!isPrintable(assignment.status)) {
          throw new Error('الطباعة متاحة بعد تسليم النموذج');
        }

        const [template, caterer, centerRow, seasons, officials] = await Promise.all([
          db.form_templates.get(assignment.templateId),
          assignment.catererId ? db.caterers.get(assignment.catererId) : null,
          assignment.centerId ? db.centers.get(assignment.centerId) : null,
          db.seasons.list(),
          assignment.centerId
            ? db.center_officials.list({ filter: { centerId: assignment.centerId, isPrimary: true } })
            : [],
        ]);
        /* The head is a row of its own, and the minute asks for it by name. */
        const head = officials[0];
        const center = centerRow
          ? { ...centerRow, headName: head?.name, headPhone: head?.phone }
          : centerRow;

        if (!alive) return;
        setState({
          loading: false, error: null,
          data: {
            assignment, template, caterer, center,
            season: seasons.find(s => s.id === assignment.seasonId) || null,
          },
        });
      } catch (e) {
        if (alive) setState({ loading: false, error: e.message, data: null });
      }
    })();
    return () => { alive = false; };
  }, [id, role, profile]);

  const { loading, error, data } = state;

  useEffect(() => {
    if (data?.template?.title) document.title = data.template.title;
  }, [data]);

  if (loading) {
    return (
      <div className="fp-shell" dir="rtl">
        <div className="w-9 h-9 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fp-shell" dir="rtl">
        <div className="bg-white rounded-2xl border border-line p-7 max-w-sm text-center">
          <WarningCircle size={26} weight="fill" className="text-error mx-auto" />
          <p className="text-[15px] font-black text-ink mt-2">{error}</p>
          <button onClick={() => nav(-1)}
            className="mt-4 h-9 px-5 rounded-xl border border-line text-[13px] font-bold text-muted hover:text-ink">
            رجوع
          </button>
        </div>
      </div>
    );
  }

  const { assignment, template, caterer, center, season } = data;

  /* What was signed wins; what was never asked is derived.
   *
   * This screen used to print `assignment.data` alone, which is right for
   * anything a person typed — a signed document must show what they signed.
   * But a blank the system answers was never in `data` unless the form was
   * filled after that blank existed, so a template that gained a field printed
   * a hole in the middle of an official minute. Resolving underneath fills
   * only what the saved data does not already carry.
   *
   * The clock is left out of that, the season year included. A minute signed
   * in one season and reprinted in the next must not renumber itself, and a
   * date it never carried must not appear on it — a wrong date on a signed
   * document is worse than a blank one, and a blank at least shows that
   * something is missing. */
  const dated = new Set(['today', 'weekday', 'hijri_year']);
  const derivable = Object.fromEntries(
    Object.entries(template?.definition?.fields || {}).filter(([, d]) => !dated.has(d?.source)),
  );

  const printedValues = {
    ...resolveSources(derivable, {
      caterer, center, season,
      company: {
        name: brand.companyFullAr,
        short: brand.companyName,
        licenseNumber: brand.facility?.licenseNumber,
        facilityName:  brand.facility?.facilityName,
        murabba:       brand.facility?.murabba,
      },
    }),
    ...(assignment.data || {}),
  };

  return (
    <div className="fp-page" dir="rtl">
      <div className="fp-bar">
        <button className="fp-btn fp-primary" onClick={() => window.print()}>
          <Printer size={16} weight="bold" />
          طباعة
        </button>
        <button className="fp-btn" onClick={() => closeDocumentTab(nav, role === 'caterer' ? '/caterer/forms' : '/admin/forms')}>
          <X size={15} weight="bold" />
          إغلاق
        </button>
        <span className="fp-hint">
          للحصول على PDF اختر «حفظ بصيغة PDF» من وجهة الطباعة
        </span>
      </div>

      <div className="fp-sheet">
        <FormDocument
          definition={template?.definition || { blocks: [], fields: {} }}
          mode="print"
          title={template?.title}
          formNumber={assignment.formNumber}
          values={printedValues}
          meta={[caterer?.name, center?.code, season?.name].filter(Boolean).join(' · ')}
        />
      </div>
    </div>
  );
}
