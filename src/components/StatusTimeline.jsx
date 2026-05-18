import { Clock, CheckCircle2, Hourglass, Timer } from 'lucide-react';
import { useNow } from '../lib/useNow.js';
import {
  fmtDuration, getStatusDurationMs, getTotalElapsedMs, isClosed, toMs,
} from '../lib/statusTracking.js';

export function StatusTimerChip({ doc, terminalStatuses, statusMeta, compact }) {
  const nowTick  = useNow(30000);
  const closed   = isClosed(doc, terminalStatuses);
  const total    = getTotalElapsedMs(doc, terminalStatuses, nowTick);
  const current  = doc.status || 'pending';
  const meta     = statusMeta?.[current] || { color: '#A98159', bg: '#FDF8F0', border: '#E8DDD4', label: '' };
  const currentMs = getStatusDurationMs(doc, current, nowTick);

  if (closed) {
    return (
      <span className={`inline-flex items-center gap-1 font-black tabular-nums rounded-lg border ${
        compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'
      }`}
        style={{ background: '#F0FDF4', borderColor: '#86EFAC', color: '#15803D' }}
        title={`أُغلق بعد ${fmtDuration(total)}`}>
        <CheckCircle2 size={compact ? 9 : 11} strokeWidth={2.5} />
        أُغلق بعد {fmtDuration(total)}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 font-black tabular-nums rounded-lg border ${
      compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'
    }`}
      style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
      title={`في ${meta.label || current}: ${fmtDuration(currentMs)}\nإجمالي: ${fmtDuration(total)}`}>
      <Hourglass size={compact ? 9 : 11} strokeWidth={2.5} />
      {fmtDuration(currentMs)}
      <span className="opacity-60 ms-0.5">/ {fmtDuration(total)}</span>
    </span>
  );
}

export function StatusTimeline({ doc, terminalStatuses, statusOrder, statusMeta, accentColor = '#A98159' }) {
  const nowTick   = useNow(30000);
  const total     = getTotalElapsedMs(doc, terminalStatuses, nowTick);
  const closed    = isClosed(doc, terminalStatuses);
  const created   = toMs(doc.timestamp);
  const closedMs  = toMs(doc.closedAt);
  const current   = doc.status || 'pending';

  /* Bar segments — pct of total per status */
  const segments = statusOrder.map(key => {
    const ms = getStatusDurationMs(doc, key, nowTick);
    const meta = statusMeta[key] || { color: '#9D8F85', label: key };
    const pct = total > 0 ? Math.max(0, (ms / total) * 100) : 0;
    return { key, ms, meta, pct, isCurrent: key === current };
  }).filter(s => s.ms > 0 || s.isCurrent);

  return (
    <div className="bg-white rounded-2xl border border-[#EDE5DC] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-black text-[#9D8F85] flex items-center gap-1.5">
          <span className="w-1.5 h-4 rounded-full" style={{ background: accentColor }} />
          <Timer size={12} strokeWidth={2.25} style={{ color: accentColor }} />
          سجل المدد
        </p>
        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border tabular-nums"
          style={closed
            ? { background: '#F0FDF4', borderColor: '#86EFAC', color: '#15803D' }
            : { background: '#FDF8F0', borderColor: '#E8DDD4', color: '#A98159' }}>
          {closed ? <CheckCircle2 size={11} strokeWidth={2.5} /> : <Hourglass size={11} strokeWidth={2.5} />}
          {closed ? `أُغلق بعد ${fmtDuration(total)}` : `إجمالي ${fmtDuration(total)}`}
        </span>
      </div>

      {/* Stacked progress bar */}
      {total > 0 && (
        <div className="h-2 rounded-full overflow-hidden flex bg-[#F5F0EB]">
          {segments.map(s => (
            <div key={s.key}
              className="h-full transition-all duration-500"
              style={{ width: `${s.pct}%`, background: s.meta.color }}
              title={`${s.meta.label}: ${fmtDuration(s.ms)}`}
            />
          ))}
        </div>
      )}

      {/* Per-status rows */}
      <div className="space-y-1.5">
        {statusOrder.map(key => {
          const ms = getStatusDurationMs(doc, key, nowTick);
          const meta = statusMeta[key];
          if (!meta) return null;
          const isCurrent = key === current && !closed;
          const StatusIcon = meta.Icon;
          const pct = total > 0 ? Math.round((ms / total) * 100) : 0;
          return (
            <div key={key}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${
                isCurrent ? 'shadow-sm' : ms === 0 ? 'opacity-40' : ''
              }`}
              style={isCurrent
                ? { background: meta.bg, borderColor: meta.color }
                : { background: '#fff', borderColor: '#EDE5DC' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}>
                {StatusIcon
                  ? <StatusIcon size={12} style={{ color: meta.color }} strokeWidth={2.5} />
                  : <Clock size={12} style={{ color: meta.color }} strokeWidth={2.5} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] font-black"
                    style={{ color: isCurrent ? meta.color : '#2D2926' }}>
                    {meta.label}
                    {isCurrent && (
                      <span className="ms-1.5 text-[9px] font-black tabular-nums opacity-80 inline-flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: meta.color }} />
                        نشط
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] font-black tabular-nums" style={{ color: meta.color }}>
                    {fmtDuration(ms)}
                    {total > 0 && ms > 0 && <span className="opacity-60 text-[9px] ms-1">({pct}%)</span>}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: created & closed timestamps */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#EDE5DC]/60">
        <div>
          <p className="text-[9px] text-[#9D8F85] font-bold">وقت الإنشاء</p>
          <p className="text-[10px] font-bold text-[#2D2926] tabular-nums">
            {created ? new Date(created).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-[#9D8F85] font-bold">{closed ? 'وقت الإغلاق' : 'الحالة الحالية'}</p>
          <p className="text-[10px] font-bold tabular-nums"
            style={{ color: closed ? '#15803D' : statusMeta[current]?.color || '#A98159' }}>
            {closed && closedMs
              ? new Date(closedMs).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })
              : (statusMeta[current]?.label || current)}
          </p>
        </div>
      </div>
    </div>
  );
}
