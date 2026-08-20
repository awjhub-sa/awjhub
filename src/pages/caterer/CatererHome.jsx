/**
 * src/pages/caterer/CatererHome.jsx
 *
 * What needs this caterer's attention, and nothing else.
 *
 * Not a dashboard. A caterer opening the portal has one question — is there
 * anything on me right now — and a wall of season statistics answers a question
 * they did not ask while burying the one they did. So: the counts that can be
 * acted on, the findings still waiting on a reply, and the centres they hold.
 *
 * Meal phases are deliberately absent. They are the company's measurement of
 * this caterer, and a measurement the measured party watches in real time is
 * one they start managing rather than meeting.
 */

import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  House, Siren, FileText, CheckCircle, Buildings, WarningCircle, ArrowLeft, Clock,
  UsersThree, Globe,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { db } from '../../lib/db.js';
import { reportType, severityOf, timeAgo } from '../../config/fieldRecords.js';
import DataTable from '../../components/DataTable.jsx';

const AR = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const ms = (v) => (v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0));
const day = (v) => (v ? AR(new Date(ms(v)).toISOString().slice(0, 10)) : '—');

export default function CatererHome() {
  const { caterer, centers, catererId, standing } = useOutletContext();
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
    () => forms.filter(f => f.status !== 'submitted' && f.status !== 'accepted'), [forms]);
  const overdue = useMemo(
    () => dueForms.filter(f => f.dueAt && ms(f.dueAt) < Date.now()), [dueForms]);
  /* Asked for and not yet opened. A draft is one they have already touched. */
  const untouched = useMemo(() => dueForms.filter(f => f.status === 'pending'), [dueForms]);

  const clear = !loading && open.length === 0 && dueForms.length === 0;

  /* Codes are stored variously as «84» and «مركز 84»; the word is the label's
     job, not the value's. */
  const codes = useMemo(
    () => centers.map(c => String(c.code ?? '').replace(/^s*مركزs*/, '').trim()).filter(Boolean),
    [centers]);
  const codeList = codes.length === 0 ? '—'
    : codes.length <= 3 ? codes.map(AR).join(' · ')
    : `${codes.slice(0, 3).map(AR).join(' · ')} +${AR(codes.length - 3)}`;

  const active   = useMemo(() => centers.filter(c => c.active !== false).length, [centers]);
  const pilgrims = useMemo(
    () => centers.reduce((n, c) => n + (Number(c.pilgrimsCount) || 0), 0), [centers]);
  const nationalities = useMemo(
    () => [...new Set(centers.map(c => c.pilgrimsNationality).filter(Boolean))], [centers]);

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        kicker={caterer?.name || 'المتعهد'}
        Icon={House}
        title="الرئيسية"
        subtitle={clear ? 'لا شيء يحتاج انتباهك الآن' : 'ما يحتاج انتباهك اليوم'}
        stats={[
          { value: codeList, label: codes.length === 1 ? 'مركزك' : 'مراكزك' },
          { value: AR(open.length), label: 'بلاغ مفتوح', tone: open.length ? 'alert' : undefined },
          { value: AR(dueForms.length), label: 'نموذج مستحق',
            tone: overdue.length ? 'alert' : dueForms.length ? 'gold' : undefined },
        ]}
      />

      {/* The operation in four figures. Everything here is already in the
          portal's own data — it was simply never said. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat Icon={Buildings} label={codes.length === 1 ? 'مركزك' : 'مراكزك'} value={codeList}
          tone="#4E7CB0"
          note={centers.length
            ? `${AR(centers.length)} مركز${active < centers.length ? ` · ${AR(active)} نشط` : ''}`
            : '—'} />
        <Stat Icon={UsersThree} label="حجاج مراكزك" value={AR(pilgrims)}
          tone="#5E9070" note={centers.length ? `بمعدّل ${AR(Math.round(pilgrims / centers.length))} للمركز` : '—'} />
        <Stat Icon={Globe} label="الجنسيات" value={AR(nationalities.length)}
          tone="#B99A64" note={nationalities.slice(0, 2).join('، ') || '—'} />
        <Stat Icon={Clock} label="أقرب موعد"
          value={standing?.nextDue ? day(standing.nextDue) : '—'}
          tone={standing?.overdue ? '#DC2626' : '#7C6BB0'}
          note={standing?.overdue ? `${AR(standing.overdue)} تجاوز موعده` : 'لا متأخرات'} />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : clear ? (
        <section className="bg-white rounded-2xl border border-line py-16 flex flex-col items-center gap-2">
          <CheckCircle size={38} weight="fill" className="text-success" />
          <p className="text-[17px] font-black text-ink">لا شيء يحتاج انتباهك</p>
          <p className="text-[13.5px] font-bold text-muted">لا بلاغات مفتوحة ولا نماذج مستحقة</p>
        </section>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* ── findings waiting on a reply ── */}
          <Panel
            Icon={Siren} title="بلاغات بانتظار ردّك"
            count={unanswered.length}
            onAll={() => nav('/caterer/reports')}
            empty={open.length === 0 ? 'لا بلاغات مفتوحة' : 'رددتَ على كل البلاغات المفتوحة'}
          >
            {unanswered.slice(0, 6).map(r => {
              const sev = severityOf(r);
              return (
                <button key={r.id} onClick={() => nav('/caterer/reports')}
                  className="w-full text-right px-5 py-3.5 border-b border-line/60 last:border-0
                             hover:bg-background transition-colors flex items-center gap-3"
                  style={{ borderInlineStart: `3px solid ${sev?.bar || '#4E7CB0'}` }}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-bold text-ink truncate">
                      {reportType(r).label}
                    </span>
                    <span className="block text-[12px] font-bold text-muted mt-0.5">
                      {r.center ? `مركز ${AR(String(r.center).replace(/\D/g, '') || r.center)}` : '—'}
                      {' · '}{timeAgo(r.timestamp)}
                    </span>
                  </span>
                  {sev && (
                    <span className="text-[11.5px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: sev.bg, color: sev.text }}>{sev.label}</span>
                  )}
                </button>
              );
            })}
          </Panel>

          {/* ── forms still owed ── */}
          <Panel
            Icon={FileText} title="نماذج مستحقة"
            count={dueForms.length}
            tone={overdue.length ? '#DC2626' : untouched.length ? '#B99A64' : undefined}
            onAll={() => nav('/caterer/forms')}
            empty="لا نماذج مستحقة"
          >
            {dueForms.slice(0, 6).map(f => {
              const late = f.dueAt && ms(f.dueAt) < Date.now();
              /* Not opened yet: the office is waiting and the caterer may not
                 know. It is tinted rather than merely edged, because an edge is
                 read only by someone already looking at the row. */
              const fresh = f.status === 'pending';
              return (
                <button key={f.id} onClick={() => nav('/caterer/forms')}
                  className="w-full text-right px-5 py-3.5 border-b border-line/60 last:border-0
                             transition-colors flex items-center gap-3 hover:brightness-[0.98]"
                  style={{
                    borderInlineStart: `3px solid ${late ? '#DC2626' : fresh ? '#B99A64' : '#94A3B8'}`,
                    background: late ? 'color-mix(in srgb, #DC2626 6%, #fff)'
                      : fresh ? 'color-mix(in srgb, #B99A64 10%, #fff)' : '#fff',
                  }}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-bold text-ink truncate">
                      {f.formNumber || 'نموذج'}
                    </span>
                    {/* The same chip the forms table carries, so the deadline
                        reads identically wherever the caterer meets it. */}
                    <span className="inline-flex items-center gap-1.5 mt-1 text-[11.5px] font-black tabular-nums px-2 py-0.5 rounded-lg border"
                      style={{
                        background: late ? 'color-mix(in srgb, #DC2626 10%, #fff)' : 'color-mix(in srgb, #B99A64 14%, #fff)',
                        borderColor: late ? '#FCA5A5' : '#E0CFA8',
                        color: late ? '#B91C1C' : '#8A6D2F',
                      }}>
                      {late ? <WarningCircle size={12} weight="fill" /> : <Clock size={12} weight="bold" />}
                      {late ? 'تأخّر عن' : 'موعد أقصاه'} {day(f.dueAt)}
                    </span>
                  </span>
                  {late && <WarningCircle size={17} weight="fill" className="text-error flex-shrink-0" />}
                </button>
              );
            })}
          </Panel>
        </div>
      )}

      {/* ── the centres they hold ── */}
      <section className="bg-white rounded-2xl border border-line overflow-hidden">
        <header className="px-5 py-4 border-b border-line flex items-center gap-2">
          <Buildings size={17} weight="bold" className="text-primary" />
          <p className="text-[15px] font-black text-ink">مراكزك</p>
          <span className="text-[12.5px] font-black tabular-nums text-muted mr-auto">
            {AR(centers.length)}
          </span>
        </header>
        {centers.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] font-bold text-muted">لا مراكز مسنَدة</p>
        ) : (
          <DataTable>
            <table className="w-full text-sm">
              <thead className="text-muted text-[12.5px] bg-background border-b border-line">
                <tr>
                  <th className="px-5 py-3.5 text-right font-black">المركز</th>
                  <th className="px-5 py-3.5 text-right font-black">المنشأة</th>
                  <th className="px-5 py-3.5 text-right font-black">الجنسية</th>
                  <th className="px-5 py-3.5 text-right font-black">الحجاج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {centers.map(c => (
                  <tr key={c.id} className="hover:bg-background/60">
                    <td className="px-5 py-3.5 font-bold text-ink text-[14px]">{c.code}</td>
                    <td className="px-5 py-3.5 text-[13.5px] text-muted">{c.facilityName || '—'}</td>
                    <td className="px-5 py-3.5 text-[13.5px] text-muted">{c.pilgrimsNationality || '—'}</td>
                    <td className="px-5 py-3.5 text-[13.5px] tabular-nums text-muted">
                      {c.pilgrimsCount != null ? AR(c.pilgrimsCount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        )}
      </section>
    </div>
  );
}

/* A figure, what it counts, and one line of context under it. The colour is
   the tile's own — four grey cards say nothing that one grey card would not. */
function Stat({ Icon, label, value, note, tone }) {
  return (
    <div className="bg-white rounded-2xl border border-line p-4 relative overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: tone }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold text-muted">{label}</p>
          <p
            className={`font-black tabular-nums leading-none mt-1.5 truncate ${
              String(value).length > 9 ? 'text-[17px]' : 'text-[24px]'
            }`}
            style={{ color: tone }}
            title={String(value)}
          >
            {value}
          </p>
          {note && <p className="text-[11px] font-bold text-muted/80 mt-1.5 truncate">{note}</p>}
        </div>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${tone} 12%, #fff)` }}>
          <Icon size={19} weight="duotone" style={{ color: tone }} />
        </span>
      </div>
    </div>
  );
}

function Panel({ Icon, title, count, tone, onAll, empty, children }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="bg-white rounded-2xl border border-line overflow-hidden flex flex-col">
      <header className="px-5 py-4 border-b border-line flex items-center gap-2">
        <Icon size={17} weight="bold" style={tone ? { color: tone } : undefined}
          className={tone ? undefined : 'text-primary'} />
        <p className="text-[15px] font-black text-ink">{title}</p>
        {count > 0 && (
          <span className={`text-[12.5px] font-black tabular-nums px-2 py-0.5 rounded-full ${
            tone ? '' : 'bg-primary/10 text-primary'}`}
            style={tone
              ? { background: `color-mix(in srgb, ${tone} 14%, #fff)`, color: tone }
              : undefined}>
            {AR(count)}
          </span>
        )}
        <button onClick={onAll}
          className="mr-auto text-[12.5px] font-black text-primary flex items-center gap-1 hover:underline">
          الكل <ArrowLeft size={13} weight="bold" />
        </button>
      </header>
      {has ? <div>{children}</div> : (
        <p className="py-10 text-center text-[13.5px] font-bold text-muted flex-1 flex items-center justify-center">
          {empty}
        </p>
      )}
    </section>
  );
}
