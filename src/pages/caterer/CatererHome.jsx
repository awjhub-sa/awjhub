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
  House, Siren, FileText, CheckCircle, Buildings, WarningCircle, Clock,
  UsersThree, Globe,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { Surface, Pill, PanelHeader, EmptyState } from '../../components/ui/index.jsx';
import { db } from '../../lib/db.js';
import { reportType, severityOf, timeAgo } from '../../config/fieldRecords.js';
import DataTable from '../../components/DataTable.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

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
        {/* The only figure of the four that names a deadline, and deadlines
            belong to forms — so this one goes to the forms register. */}
        <Stat Icon={Clock} label="أقرب موعد"
          value={standing?.nextDue ? day(standing.nextDue) : '—'}
          tone={standing?.overdue ? '#DC2626' : '#7C6BB0'}
          note={standing?.overdue ? `${AR(standing.overdue)} تجاوز موعده` : 'لا متأخرات'}
          onClick={() => nav('/caterer/forms')} />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-7 h-7 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
        </div>
      ) : clear ? (
        <Surface>
          <div className="py-14 px-5 text-center">
            <CheckCircle size={26} weight="duotone" className="mx-auto" style={{ color: '#15803D' }} />
            <p className="text-[13px] font-semibold text-ink mt-3">لا شيء يحتاج انتباهك</p>
            <p className="text-[11.5px] font-medium text-muted mt-1">لا بلاغات مفتوحة ولا نماذج مستحقة</p>
          </div>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* ── findings waiting on a reply ── */}
          <Panel
            Icon={Siren} title="بلاغات بانتظار ردّك"
            count={unanswered.length}
            tone="#DC2626"
            onAll={() => nav('/caterer/reports')}
            empty={open.length === 0 ? 'لا بلاغات مفتوحة' : 'رددتَ على كل البلاغات المفتوحة'}
          >
            {unanswered.slice(0, 6).map(r => {
              const sev = severityOf(r);
              return (
                <button key={r.id} type="button" onClick={() => nav('/caterer/reports')}
                  className="w-full text-start ps-5 pe-4 py-3.5 border-b border-line last:border-0
                             cursor-pointer transition-colors flex items-center gap-3
                             hover:bg-[rgb(var(--c-bg))] active:bg-[rgb(var(--c-line)/0.5)]"
                  style={{ borderInlineStart: `3px solid ${sev?.bar || '#4E7CB0'}` }}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-bold text-ink truncate">
                      {reportType(r).label}
                    </span>
                    <span className="block text-[11.5px] font-medium text-muted mt-1">
                      {r.center ? `مركز ${AR(String(r.center).replace(/\D/g, '') || r.center)}` : '—'}
                      {' · '}{timeAgo(r.timestamp)}
                    </span>
                  </span>
                  {sev && <Pill color={sev.text}>{sev.label}</Pill>}
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
                <button key={f.id} type="button" onClick={() => nav('/caterer/forms')}
                  className="w-full text-start ps-5 pe-4 py-3.5 border-b border-line last:border-0
                             cursor-pointer transition-all duration-200 flex items-center gap-3
                             hover:brightness-[0.98] active:brightness-[0.95]"
                  style={{
                    borderInlineStart: `3px solid ${late ? '#DC2626' : fresh ? '#B99A64' : '#94A3B8'}`,
                    background: late ? tint('#DC2626', 6) : fresh ? tint('#B99A64', 10) : '#fff',
                  }}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-bold text-ink truncate">
                      {f.formNumber || 'نموذج'}
                    </span>
                    {/* The same chip the forms table carries, so the deadline
                        reads identically wherever the caterer meets it. */}
                    <span className="mt-1.5 block">
                      <Pill color={late ? '#B91C1C' : '#8A6D2F'}
                        Icon={late ? WarningCircle : Clock} className="tabular-nums">
                        {late ? 'تأخّر عن' : 'موعد أقصاه'} {day(f.dueAt)}
                      </Pill>
                    </span>
                  </span>
                  {late && <WarningCircle size={15} weight="duotone" className="shrink-0" style={{ color: '#DC2626' }} />}
                </button>
              );
            })}
          </Panel>
        </div>
      )}

      {/* ── the centres they hold ── */}
      <Surface className="overflow-hidden">
        <PanelHeader
          Icon={Buildings}
          color="#4E7CB0"
          title="مراكزك"
          right={<Pill color="#4E7CB0" className="tabular-nums">{AR(centers.length)}</Pill>}
        />
        {centers.length === 0 ? (
          <EmptyState Icon={Buildings} title="لا مراكز مسنَدة" />
        ) : (
          <DataTable>
            <table className="w-full text-sm">
              <thead className="text-muted text-[11px] bg-[rgb(var(--c-bg))] border-b border-line">
                <tr>
                  <th className="px-5 py-3 text-start font-bold">المركز</th>
                  <th className="px-5 py-3 text-start font-bold">المنشأة</th>
                  <th className="px-5 py-3 text-start font-bold">الجنسية</th>
                  <th className="px-5 py-3 text-start font-bold">الحجاج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {centers.map(c => (
                  <tr key={c.id} className="hover:bg-[rgb(var(--c-bg))] transition-colors">
                    <td className="px-5 py-3.5 font-bold text-ink text-[13.5px]">{c.code}</td>
                    <td className="px-5 py-3.5 text-[12.5px] font-medium text-muted">{c.facilityName || '—'}</td>
                    <td className="px-5 py-3.5 text-[12.5px] font-medium text-muted">{c.pilgrimsNationality || '—'}</td>
                    <td className="px-5 py-3.5 text-[12.5px] font-medium tabular-nums text-muted">
                      {c.pilgrimsCount != null ? AR(c.pilgrimsCount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        )}
      </Surface>
    </div>
  );
}

/* A figure, what it counts, and one line of context under it. The colour is
   the tile's own — four grey cards say nothing that one grey card would not.

   It moves under the pointer only when it was handed somewhere to go. Three of
   the four figures here describe the caterer's own centres, which this page
   already lists in full below — there is no other screen to send them to, so
   those three stay flat and stay a div. */
function Stat({ Icon, label, value, note, tone, onClick }) {
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      type={clickable ? 'button' : undefined}
      className={`group block w-full text-start rounded-[14px] border p-4 shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ${
        clickable
          ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ' +
            'hover:shadow-[0_8px_22px_-8px_rgb(var(--c-ink)/0.22)] ' +
            'active:translate-y-0 active:shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ' +
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
          : ''
      }`}
      style={{ background: tint(tone, 12), borderColor: tint(tone, 28), outlineColor: tone }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-muted truncate">{label}</p>
        <Icon size={16} weight="duotone" style={{ color: tone }}
          className="shrink-0 mt-px transition-transform duration-200 group-hover:scale-125" />
      </div>
      <p
        className={`font-extrabold tabular-nums leading-none mt-3 truncate ${
          String(value).length > 9 ? 'text-[18px]' : 'text-[28px]'
        }`}
        style={{ color: tone }}
        title={String(value)}
      >
        {value}
      </p>
      {note && <p className="text-[11px] font-medium text-muted mt-2 truncate">{note}</p>}
    </Tag>
  );
}

function Panel({ Icon, title, count, tone, onAll, empty, children }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  const color = tone || 'rgb(var(--c-primary))';
  return (
    <Surface className="overflow-hidden flex flex-col">
      <PanelHeader
        Icon={Icon}
        color={color}
        title={title}
        action={onAll}
        actionLabel="الكل"
        right={count > 0
          ? <Pill color={color} className="tabular-nums">{AR(count)}</Pill>
          : null}
      />
      {has ? <div>{children}</div> : (
        <p className="py-12 text-center text-[12.5px] font-semibold text-muted flex-1 flex items-center justify-center">
          {empty}
        </p>
      )}
    </Surface>
  );
}
