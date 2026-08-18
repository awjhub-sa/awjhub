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
 * Two columns are never requested from the server: `admin_notes`, which is the
 * office talking to itself, and `observer`, the name of the inspector. The
 * inspector works inside this company's kitchen, and naming them turns a report
 * into a person to lean on. The finding, the photographs and the time are all
 * the caterer needs to act.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Siren, CheckCircle, Clock, PaperPlaneTilt, Image as ImageIcon, X, CaretDown,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import { db } from '../../lib/db.js';
import {
  reportType, severityOf, reportStatus, timeAgo, fullDate, HOLY_SITE_LABEL,
} from '../../config/fieldRecords.js';

const AR = (n) => String(n ?? '').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

/* Named rather than '*'. See the file header — discarding admin_notes in the
   browser would be too late; it would already have crossed the wire. */
const SAFE_COLUMNS = [
  'id', 'reportNumber', 'center', 'caterer', 'mealType', 'reportType', 'severity',
  'description', 'status', 'statusSince', 'closedAt', 'images', 'videoUrl',
  'holySite', 'timestamp', 'catererResponse', 'catererRespondedAt',
];

export default function CatererReports() {
  const { caterer, centers } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');   // 'open' | 'all'
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!caterer?.name) return;
    setLoading(true);
    const list = await db.reports.list({ columns: SAFE_COLUMNS });
    /* Filtered here as well as by the query's own scope — the caterer name is
       the only link the reports table carries. */
    setRows(list.filter(r => String(r.caterer ?? '').trim() === String(caterer.name).trim()));
    setLoading(false);
  }, [caterer]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const base = filter === 'open' ? rows.filter(r => r.status !== 'resolved') : rows;
    return [...base].sort((a, b) => {
      const t = (x) => (x.timestamp?.toMillis?.() ?? new Date(x.timestamp || 0).getTime());
      return t(b) - t(a);
    });
  }, [rows, filter]);

  const openCount = rows.filter(r => r.status !== 'resolved').length;
  const answered = rows.filter(r => r.catererResponse).length;

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        kicker={caterer?.name || 'المتعهد'}
        Icon={Siren}
        title="البلاغات"
        subtitle="المخالفات المسجَّلة على مراكزك وردّك عليها"
        stats={[
          { value: AR(openCount), label: 'مفتوح', tone: openCount ? 'alert' : undefined },
          { value: AR(rows.length - openCount), label: 'مُغلق' },
          { value: AR(answered), label: 'رددتَ عليه', tone: 'gold' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-line p-3 flex items-center gap-2 flex-wrap">
        {[['open', `المفتوحة (${AR(openCount)})`], ['all', `الكل (${AR(rows.length)})`]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`h-9 px-4 rounded-xl border text-[12px] font-black transition-colors ${
              filter === k ? 'bg-primary text-white border-transparent' : 'bg-white border-line text-muted hover:text-ink'
            }`}>{l}</button>
        ))}
        <span className="mr-auto text-[11px] font-bold text-muted">
          اضغط أي بلاغ لقراءته والردّ عليه
        </span>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-line py-14 flex flex-col items-center gap-2">
          <CheckCircle size={28} weight="fill" className="text-success" />
          <p className="text-[13px] font-black text-ink">
            {filter === 'open' ? 'لا بلاغات مفتوحة على مراكزك' : 'لا بلاغات'}
          </p>
          <p className="text-[11px] font-bold text-muted">
            {filter === 'open' ? 'كل ما ورد أُغلق' : 'لم يُسجَّل أي بلاغ بعد'}
          </p>
        </div>
      ) : shown.map(r => (
        <ReportCard key={r.id} r={r} open={openId === r.id}
          onToggle={() => setOpenId(o => (o === r.id ? null : r.id))} onSaved={load} />
      ))}
    </div>
  );
}

function ReportCard({ r, open, onToggle, onSaved }) {
  const sev = severityOf(r);
  const st = reportStatus(r);
  const [text, setText] = useState(r.catererResponse || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shot, setShot] = useState(null);

  useEffect(() => { setText(r.catererResponse || ''); }, [r.catererResponse]);

  const send = async () => {
    const body = text.trim();
    if (!body) { setErr('اكتب ردّك أولاً'); return; }
    setBusy(true); setErr('');
    try {
      /* Only these two columns. The caterer cannot close their own finding —
         that judgement belongs to whoever raised it. */
      await db.reports.update(r.id, {
        catererResponse: body,
        catererRespondedAt: new Date(),
      });
      await onSaved();
    } catch (e) {
      setErr(e?.message || 'تعذّر الإرسال');
    } finally { setBusy(false); }
  };

  return (
    <section className="bg-white rounded-2xl border border-line overflow-hidden">
      <button onClick={onToggle} className="w-full text-right px-4 py-3 flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${sev?.bar || '#4E7CB0'} 14%, #fff)` }}>
          <Siren size={16} weight="bold" style={{ color: sev?.bar || '#4E7CB0' }} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <b className="text-[13px] text-ink">{reportType(r).label}</b>
            {sev && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: sev.bg, color: sev.text }}>{sev.label}</span>
            )}
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </span>
          <span className="block text-[11px] font-bold text-muted mt-1">
            {r.center ? `مركز ${AR(String(r.center).replace(/\D/g, '') || r.center)}` : '—'}
            {r.holySite && ` · ${HOLY_SITE_LABEL[r.holySite] || r.holySite}`}
            {' · '}{timeAgo(r.timestamp)}
            {r.reportNumber && ` · ${r.reportNumber}`}
          </span>
        </span>
        <CaretDown size={14} weight="bold"
          className={`text-muted flex-shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
          {r.description && (
            <div>
              <p className="text-[10px] font-black text-muted/70 tracking-widest mb-1">الوصف</p>
              <p className="text-[12px] text-ink leading-relaxed">{r.description}</p>
            </div>
          )}

          {Array.isArray(r.images) && r.images.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-muted/70 tracking-widest mb-1.5 flex items-center gap-1">
                <ImageIcon size={11} weight="bold" />المرفقات ({AR(r.images.length)})
              </p>
              <div className="flex gap-2 flex-wrap">
                {r.images.map((src, i) => (
                  <button key={i} onClick={() => setShot(src)}
                    className="w-20 h-20 rounded-lg overflow-hidden border border-line">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10.5px] font-bold text-muted flex items-center gap-1.5">
            <Clock size={11} weight="bold" />
            {fullDate(r.timestamp)}
            {r.closedAt && <> · أُغلق {timeAgo(r.closedAt)}</>}
          </div>

          {/* ── the answer ── */}
          <div className="rounded-xl border border-line bg-background p-3">
            <p className="text-[11px] font-black text-ink mb-2">ردّك على البلاغ</p>
            {r.catererResponse && (
              <p className="text-[10px] font-bold text-success mb-2">
                أُرسل {timeAgo(r.catererRespondedAt)} — يمكنك تحديثه
              </p>
            )}
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
              placeholder="ما الإجراء الذي اتُّخذ؟ اذكر ما تمّ ومتى."
              className="w-full px-3 py-2 rounded-lg border border-line bg-white text-[12px] text-ink
                         leading-relaxed focus:outline-none focus:border-primary/50 resize-none" />
            <div className="flex items-center gap-2 mt-2">
              {err && <p className="text-[11px] font-bold text-error flex-1">{err}</p>}
              <button onClick={send} disabled={busy}
                className="mr-auto h-9 px-4 rounded-lg text-white text-[12px] font-black flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
                <PaperPlaneTilt size={13} weight="bold" />
                {busy ? 'جارٍ الإرسال…' : r.catererResponse ? 'تحديث الردّ' : 'إرسال الردّ'}
              </button>
            </div>
            <p className="text-[10px] font-bold text-muted/70 mt-2 leading-relaxed">
              إغلاق البلاغ يعود للإدارة بعد التحقّق من المعالجة.
            </p>
          </div>
        </div>
      )}

      {shot && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setShot(null)}>
          <div className="absolute inset-0 bg-ink/80" />
          <img src={shot} alt="" className="relative max-h-[86vh] max-w-full rounded-xl" />
          <button className="absolute top-4 left-4 w-9 h-9 rounded-lg bg-white/15 border border-white/25
                             flex items-center justify-center text-white">
            <X size={16} weight="bold" />
          </button>
        </div>
      )}
    </section>
  );
}
