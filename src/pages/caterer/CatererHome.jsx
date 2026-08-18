/**
 * src/pages/caterer/CatererHome.jsx
 *
 * What needs this caterer's attention, and nothing else.
 *
 * Not a dashboard. A caterer opening the portal has one question — is there
 * anything on me right now — and a wall of season statistics answers a question
 * they did not ask while burying the one they did. So: two counts that can be
 * acted on, the findings still open, and the forms still due.
 *
 * Meal phases are deliberately absent. They are the company's measurement of
 * this caterer, and a measurement the measured party can watch in real time is
 * one they start managing rather than meeting.
 */

import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Siren, FileText, CheckCircle, Buildings, WarningCircle, ArrowLeft,
} from '@phosphor-icons/react';
import { db } from '../../lib/db.js';
import { reportType, severityOf, timeAgo } from '../../config/fieldRecords.js';

const AR = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

export default function CatererHome() {
  const { caterer, centers, catererId } = useOutletContext();
  const nav = useNavigate();
  const [reports, setReports] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [rp, fm] = await Promise.all([
        db.reports.list({ columns: [
          'id', 'reportNumber', 'center', 'caterer', 'reportType', 'severity',
          'status', 'timestamp', 'catererResponse',
        ] }),
        db.form_assignments.list({ filter: { catererId }, columns: [
          'id', 'formNumber', 'templateId', 'status', 'dueAt', 'submittedAt',
        ] }),
      ]);
      if (!alive) return;
      const name = String(caterer?.name ?? '').trim();
      setReports(rp.filter(r => String(r.caterer ?? '').trim() === name));
      setForms(fm);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [caterer, catererId]);

  const open = useMemo(() => reports.filter(r => r.status !== 'resolved'), [reports]);
  const unanswered = useMemo(() => open.filter(r => !r.catererResponse), [open]);
  const dueForms = useMemo(
    () => forms.filter(f => f.status !== 'submitted' && f.status !== 'accepted'),
    [forms],
  );

  const ms = (v) => (v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0));
  const overdue = dueForms.filter(f => f.dueAt && ms(f.dueAt) < Date.now());

  if (loading) {
    return <div className="py-20 flex justify-center">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>;
  }

  const clear = open.length === 0 && dueForms.length === 0;

  return (
    <div className="space-y-3">
      {clear ? (
        <section className="bg-white rounded-2xl border border-line py-12 flex flex-col items-center gap-2">
          <CheckCircle size={32} weight="fill" className="text-success" />
          <p className="text-[14px] font-black text-ink">لا شيء يحتاج انتباهك</p>
          <p className="text-[11.5px] font-bold text-muted">لا بلاغات مفتوحة ولا نماذج مستحقة</p>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Tile n={open.length} label="بلاغ مفتوح"
            sub={unanswered.length ? `${AR(unanswered.length)} بلا ردّ` : 'كلها مردود عليها'}
            tone={open.length ? '#DC2626' : '#16A34A'} Icon={Siren}
            onClick={() => nav('/caterer/reports')} />
          <Tile n={dueForms.length} label="نموذج مستحق"
            sub={overdue.length ? `${AR(overdue.length)} متأخر` : 'ضمن الموعد'}
            tone={overdue.length ? '#DC2626' : dueForms.length ? '#B99A64' : '#16A34A'} Icon={FileText}
            onClick={() => nav('/caterer/forms')} />
        </div>
      )}

      {unanswered.length > 0 && (
        <section className="bg-white rounded-2xl border border-line overflow-hidden">
          <header className="px-4 py-2.5 border-b border-line flex items-center gap-2">
            <WarningCircle size={14} weight="bold" style={{ color: '#B4674E' }} />
            <p className="text-[12.5px] font-black text-ink">بانتظار ردّك</p>
            <button onClick={() => nav('/caterer/reports')}
              className="mr-auto text-[11px] font-black text-primary flex items-center gap-1">
              الكل <ArrowLeft size={11} weight="bold" />
            </button>
          </header>
          {unanswered.slice(0, 5).map(r => {
            const sev = severityOf(r);
            return (
              <button key={r.id} onClick={() => nav('/caterer/reports')}
                className="w-full text-right px-4 py-2.5 border-b border-line/60 last:border-0 hover:bg-background"
                style={{ borderInlineStart: `3px solid ${sev?.bar || '#4E7CB0'}` }}>
                <p className="text-[12px] font-bold text-ink">
                  {r.center ? `مركز ${AR(String(r.center).replace(/\D/g, '') || r.center)}` : '—'} — {reportType(r).label}
                </p>
                <p className="text-[10px] font-bold text-muted mt-0.5">{timeAgo(r.timestamp)}</p>
              </button>
            );
          })}
        </section>
      )}

      <section className="bg-white rounded-2xl border border-line p-4">
        <p className="text-[12.5px] font-black text-ink flex items-center gap-1.5 mb-2">
          <Buildings size={14} weight="bold" className="text-primary" />
          مراكزك ({AR(centers.length)})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {centers.length === 0
            ? <p className="text-[11.5px] font-bold text-muted">لا مراكز مسنَدة</p>
            : centers.map(c => (
              <span key={c.id}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-line bg-background text-ink">
                {c.code}
                {c.pilgrimsNationality && (
                  <span className="text-muted font-bold mr-1.5">· {c.pilgrimsNationality}</span>
                )}
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}

function Tile({ n, label, sub, tone, Icon, onClick }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl border border-line p-4 text-right hover:border-primary/40 transition-colors">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
        style={{ background: `color-mix(in srgb, ${tone} 14%, #fff)` }}>
        <Icon size={16} weight="bold" style={{ color: tone }} />
      </span>
      <span className="block text-[26px] font-black tabular-nums leading-none" style={{ color: tone }}>
        {AR(n)}
      </span>
      <span className="block text-[11.5px] font-bold text-ink mt-1">{label}</span>
      <span className="block text-[10px] font-bold text-muted mt-0.5">{sub}</span>
    </button>
  );
}
