/**
 * src/pages/caterer/CatererReports.jsx
 *
 * The findings raised against this caterer's centres, and their answer.
 *
 * This is the screen the portal exists for. A report used to reach a caterer by
 * telephone, and what they did about it stayed in that call — so the same
 * finding could be raised a second time with nothing on file to say it had
 * already been dealt with. Here the finding and the answer sit in one place.
 *
 * A list, then a record — the same shape the admin console uses, and the same
 * drawer component, so both sides of a finding are read the same way. The stack
 * of expanding cards it replaces made you scroll past four descriptions to
 * compare two dates.
 *
 * Two columns are never requested from the server: `admin_notes`, which is the
 * office talking to itself, and `observer`, the name of the inspector. The
 * inspector works inside this company's kitchen, and naming them turns a report
 * into a person to lean on. The finding, the photographs and the time are all
 * the caterer needs to act.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Siren, CheckCircle, PaperPlaneTilt, Image as ImageIcon, X, Clock, ChatText, Funnel,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import DetailDrawer from '../../components/DetailDrawer.jsx';
import FilterChip from '../../components/FilterChip.jsx';
import { Surface, Pill } from '../../components/ui/index.jsx';
import { db } from '../../lib/db.js';
import DataTable from '../../components/DataTable.jsx';
import {
  reportType, severityOf, reportStatus, timeAgo, fullDate, HOLY_SITE_LABEL,
} from '../../config/fieldRecords.js';

const AR = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const centreOf = (v) => (v ? `مركز ${AR(String(v).replace(/\D/g, '') || v)}` : '—');

/* Named rather than '*'. See the file header — discarding admin_notes in the
   browser would be too late; it would already have crossed the wire. */
const SAFE_COLUMNS = [
  'id', 'reportNumber', 'center', 'caterer', 'mealType', 'reportType', 'severity',
  'description', 'status', 'statusSince', 'closedAt', 'images', 'videoUrl',
  'holySite', 'timestamp', 'catererResponse', 'catererRespondedAt',
];

export default function CatererReports() {
  const { caterer } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');   // 'open' | 'waiting' | 'all'
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!caterer?.name) return;
    setLoading(true);
    const list = await db.reports.list({ columns: SAFE_COLUMNS });
    setRows(list.filter(r => String(r.caterer ?? '').trim() === String(caterer.name).trim()));
    setLoading(false);
  }, [caterer]);

  useEffect(() => { load(); }, [load]);

  const openCount = rows.filter(r => r.status !== 'resolved').length;
  const waiting = rows.filter(r => r.status !== 'resolved' && !r.catererResponse).length;
  const answered = rows.filter(r => r.catererResponse).length;

  const shown = useMemo(() => {
    const base = filter === 'all' ? rows
      : filter === 'waiting' ? rows.filter(r => r.status !== 'resolved' && !r.catererResponse)
      : rows.filter(r => r.status !== 'resolved');
    const t = (x) => (x.timestamp?.toMillis?.() ?? new Date(x.timestamp || 0).getTime());
    return [...base].sort((a, b) => t(b) - t(a));
  }, [rows, filter]);

  const current = rows.find(r => r.id === openId) || null;

  /* Each tab wears the colour of the thing it holds, so the one that matters
     today is found before it is read. */
  const TABS = [
    ['open', 'المفتوحة', openCount, '#DC2626', Siren],
    ['waiting', 'بانتظار ردّك', waiting, '#B99A64', ChatText],
    ['all', 'الكل', rows.length, 'rgb(var(--c-muted))', Funnel],
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        kicker={caterer?.name || 'المتعهد'}
        Icon={Siren}
        title="البلاغات"
        stats={[
          { value: AR(openCount), label: 'مفتوح', tone: openCount ? 'alert' : undefined },
          { value: AR(waiting), label: 'بانتظار ردّك', tone: waiting ? 'gold' : undefined },
          { value: AR(answered), label: 'رددتَ عليه' },
        ]}
      />

      <Surface className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-line flex items-center gap-2 flex-wrap">
          {TABS.map(([k, label, n, color, Icon]) => (
            <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}
              count={AR(n)} Icon={Icon} color={color}>
              {label}
            </FilterChip>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-7 h-7 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <div className="py-14 px-5 text-center">
            <CheckCircle size={26} weight="duotone" className="mx-auto" style={{ color: '#15803D' }} />
            <p className="text-[13px] font-semibold text-ink mt-3">
              {filter === 'all' ? 'لا بلاغات على مراكزك' : 'لا شيء هنا'}
            </p>
            <p className="text-[11.5px] font-medium text-muted mt-1">
              {filter === 'waiting' ? 'رددتَ على كل ما هو مفتوح' : 'كل ما ورد أُغلق'}
            </p>
          </div>
        ) : (
          <DataTable>
            <table className="w-full text-sm">
              <thead className="text-muted text-[11px] bg-[rgb(var(--c-bg))] border-b border-line">
                <tr>
                  <th className="px-5 py-3 text-start font-bold">الرقم</th>
                  <th className="px-5 py-3 text-start font-bold">المركز</th>
                  <th className="px-5 py-3 text-start font-bold">النوع</th>
                  <th className="px-5 py-3 text-start font-bold">الخطورة</th>
                  <th className="px-5 py-3 text-start font-bold">المشعر</th>
                  <th className="px-5 py-3 text-start font-bold">الحالة</th>
                  <th className="px-5 py-3 text-start font-bold">ردّك</th>
                  <th className="px-5 py-3 text-start font-bold">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map(r => {
                  const sev = severityOf(r);
                  const st = reportStatus(r);
                  return (
                    <tr key={r.id} onClick={() => setOpenId(r.id)}
                      className="hover:bg-[rgb(var(--c-bg))] cursor-pointer transition-colors"
                      style={{ borderInlineStart: `3px solid ${sev?.bar || '#4E7CB0'}` }}>
                      <td className="px-5 py-3.5 tabular-nums text-[12.5px] font-medium text-muted">
                        {r.reportNumber || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-ink text-[13.5px] whitespace-nowrap">
                        {centreOf(r.center)}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-medium text-ink">{reportType(r).label}</td>
                      <td className="px-5 py-3.5">
                        {sev && <Pill color={sev.text}>{sev.label}</Pill>}
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] font-medium text-muted whitespace-nowrap">
                        {HOLY_SITE_LABEL[r.holySite] || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Pill color={st.color}>{st.label}</Pill>
                      </td>
                      <td className="px-5 py-3.5">
                        {r.catererResponse
                          ? <Pill color="#15803D" Icon={CheckCircle}>أُرسل</Pill>
                          : <Pill color="#8C7038" Icon={ChatText}>بانتظارك</Pill>}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] font-medium text-muted whitespace-nowrap">
                        {timeAgo(r.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        )}
      </Surface>

      <ReportDrawer report={current} onClose={() => setOpenId(null)} onSaved={load} />
    </div>
  );
}

function ReportDrawer({ report, onClose, onSaved }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shot, setShot] = useState(null);

  useEffect(() => { setText(report?.catererResponse || ''); setErr(''); }, [report]);

  if (!report) return null;
  const sev = severityOf(report);
  const st = reportStatus(report);

  const send = async () => {
    const body = text.trim();
    if (!body) { setErr('اكتب ردّك أولاً'); return; }
    setBusy(true); setErr('');
    try {
      /* Only these two columns. The caterer cannot close their own finding —
         that judgement belongs to whoever raised it. */
      await db.reports.update(report.id, {
        catererResponse: body,
        catererRespondedAt: new Date(),
      });
      await onSaved();
      onClose();
    } catch (e) { setErr(e?.message || 'تعذّر الإرسال'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <DetailDrawer
        open
        onClose={onClose}
        Icon={Siren}
        accent={sev?.bar || 'rgb(var(--c-accent))'}
        kicker={report.reportNumber || 'بلاغ'}
        title={reportType(report).label}
        subtitle={`${centreOf(report.center)}${report.holySite ? ` · ${HOLY_SITE_LABEL[report.holySite]}` : ''}`}
        chips={
          /* Drawn on the drawer's navy head — white on dark, deliberately. */
          <>
            {sev && (
              <span className="text-[11px] font-bold px-2 py-[3px] rounded-md bg-white/12 border border-white/15 text-white">
                {sev.label}
              </span>
            )}
            <span className="text-[11px] font-bold px-2 py-[3px] rounded-md bg-white/12 border border-white/15 text-white">
              {st.label}
            </span>
          </>
        }
        footer={
          <div className="flex items-center gap-3 w-full">
            <p className="text-[11.5px] font-medium flex-1 leading-relaxed"
              style={{ color: err ? 'rgb(var(--c-error))' : 'rgb(var(--c-muted))' }}>
              {err || 'إغلاق البلاغ يعود للإدارة بعد التحقّق من المعالجة.'}
            </p>
            <button onClick={send} disabled={busy}
              className="h-9 px-5 rounded-[10px] bg-primary border border-primary text-white text-[12px]
                         font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity
                         disabled:opacity-50 shrink-0">
              <PaperPlaneTilt size={14} weight="bold" />
              {busy ? 'جارٍ الإرسال…' : report.catererResponse ? 'تحديث الردّ' : 'إرسال الردّ'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {report.description && (
            <section>
              <p className="text-[10.5px] font-bold text-muted tracking-[0.14em] mb-1.5">الوصف</p>
              <p className="text-[13.5px] text-ink leading-relaxed">{report.description}</p>
            </section>
          )}

          {Array.isArray(report.images) && report.images.length > 0 && (
            <section>
              <p className="text-[10.5px] font-bold text-muted tracking-[0.14em] mb-2 flex items-center gap-1.5">
                <ImageIcon size={12} weight="bold" />المرفقات ({AR(report.images.length)})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {report.images.map((src, i) => (
                  <button key={i} onClick={() => setShot(src)}
                    className="aspect-square rounded-[10px] overflow-hidden border border-line">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[11px] border border-line bg-[rgb(var(--c-bg))] p-3">
            <p className="text-[10.5px] font-bold text-muted tracking-[0.14em] mb-1.5 flex items-center gap-1.5">
              <Clock size={12} weight="bold" />التوقيت
            </p>
            <p className="text-[12.5px] font-bold text-ink">{fullDate(report.timestamp)}</p>
            {report.closedAt && (
              <p className="text-[11.5px] font-semibold mt-1.5" style={{ color: '#15803D' }}>
                أُغلق {timeAgo(report.closedAt)}
              </p>
            )}
          </section>

          <section>
            <p className="text-[10.5px] font-bold text-muted tracking-[0.14em] mb-1.5">ردّك على البلاغ</p>
            {report.catererResponse && (
              <p className="text-[11.5px] font-semibold mb-1.5" style={{ color: '#15803D' }}>
                أُرسل {timeAgo(report.catererRespondedAt)}
              </p>
            )}
            <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
              placeholder="ما الإجراء الذي اتُّخذ؟ اذكر ما تمّ ومتى."
              className="w-full px-3.5 py-2.5 rounded-[10px] border border-line bg-white text-[13px] text-ink
                         leading-relaxed focus:outline-none focus:border-primary/50 transition-colors resize-none" />
          </section>
        </div>
      </DetailDrawer>

      {shot && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setShot(null)}>
          <div className="absolute inset-0 bg-ink/85" />
          <img src={shot} alt="" className="relative max-h-[88vh] max-w-full rounded-[14px]" />
          <button className="absolute top-4 end-4 w-9 h-9 rounded-[10px] bg-white/12 border border-white/25
                             flex items-center justify-center text-white">
            <X size={18} weight="bold" />
          </button>
        </div>
      )}
    </>
  );
}
