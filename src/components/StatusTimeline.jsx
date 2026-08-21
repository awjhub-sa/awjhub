import {
  Clock,
  CheckCircle as CheckCircle2,
  Hourglass,
  Timer,
} from '@phosphor-icons/react';
import { useNow } from '../lib/useNow.js';
import {
  fmtDuration, getStatusDurationMs, getTotalElapsedMs, isClosed, toMs,
} from '../lib/statusTracking.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const CLOSED = '#15803D';

export function StatusTimerChip({ doc, terminalStatuses, statusMeta, compact }) {
  const nowTick  = useNow(30000);
  const closed   = isClosed(doc, terminalStatuses);
  const total    = getTotalElapsedMs(doc, terminalStatuses, nowTick);
  const current  = doc.status || 'pending';
  const meta     = statusMeta?.[current] || { color: 'rgb(var(--c-primary))', label: '' };
  const currentMs = getStatusDurationMs(doc, current, nowTick);
  const c        = closed ? CLOSED : meta.color;

  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums rounded-[10px] border ${
      compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[10.5px] px-2 py-1'
    }`}
      style={{ background: tint(c, 12), borderColor: tint(c, 28), color: c }}
      title={closed
        ? `أُغلق بعد ${fmtDuration(total)}`
        : `في ${meta.label || current}: ${fmtDuration(currentMs)}\nإجمالي: ${fmtDuration(total)}`}>
      {closed ? <CheckCircle2 size={compact ? 10 : 11} weight="bold" />
              : <Hourglass size={compact ? 10 : 11} weight="bold" />}
      {closed ? `أُغلق بعد ${fmtDuration(total)}` : fmtDuration(currentMs)}
      {!closed && <span className="opacity-60 ms-0.5">/ {fmtDuration(total)}</span>}
    </span>
  );
}

export function StatusTimeline({ doc, terminalStatuses, statusOrder, statusMeta, accentColor = 'rgb(var(--c-primary))' }) {
  const nowTick   = useNow(30000);
  const total     = getTotalElapsedMs(doc, terminalStatuses, nowTick);
  const closed    = isClosed(doc, terminalStatuses);
  const created   = toMs(doc.timestamp);
  const closedMs  = toMs(doc.closedAt);
  const current   = doc.status || 'pending';

  /* Bar segments — pct of total per status */
  const segments = statusOrder.map(key => {
    const ms = getStatusDurationMs(doc, key, nowTick);
    const meta = statusMeta[key] || { color: 'rgb(var(--c-muted))', label: key };
    const pct = total > 0 ? Math.max(0, (ms / total) * 100) : 0;
    return { key, ms, meta, pct, isCurrent: key === current };
  }).filter(s => s.ms > 0 || s.isCurrent);

  return (
    <div className="bg-white rounded-[14px] border border-line overflow-hidden
                    shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-b"
        style={{ background: tint(accentColor, 12), borderColor: tint(accentColor, 28) }}>
        <p className="text-[12.5px] font-bold flex items-center gap-2" style={{ color: accentColor }}>
          <span className="w-7 h-7 rounded-[10px] flex items-center justify-center border"
            style={{ background: tint(accentColor, 9), borderColor: tint(accentColor, 22) }}>
            <Timer size={14} weight="duotone" style={{ color: accentColor }} />
          </span>
          سجل المدة
        </p>
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-[10px] border tabular-nums"
          style={{
            background: tint(closed ? CLOSED : accentColor, 12),
            borderColor: tint(closed ? CLOSED : accentColor, 28),
            color: closed ? CLOSED : accentColor,
          }}>
          {closed ? <CheckCircle2 size={11} weight="bold" /> : <Hourglass size={11} weight="bold" />}
          {closed ? `أُغلق بعد ${fmtDuration(total)}` : `إجمالي ${fmtDuration(total)}`}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {total > 0 && (
          <div className="h-2 rounded-full overflow-hidden flex bg-[rgb(var(--c-primary-50))]">
            {segments.map(s => (
              <div key={s.key}
                className="h-full transition-all duration-500"
                style={{ width: `${s.pct}%`, background: s.meta.color }}
                title={`${s.meta.label}: ${fmtDuration(s.ms)}`}
              />
            ))}
          </div>
        )}

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
                className={`flex items-center gap-2.5 rounded-[11px] px-3 py-2 border ${
                  !isCurrent && ms === 0 ? 'opacity-40' : ''
                }`}
                style={isCurrent
                  ? { background: tint(meta.color, 12), borderColor: tint(meta.color, 28) }
                  : { background: '#fff', borderColor: 'rgb(var(--c-line))' }}>
                <div className="w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0 border"
                  style={{ background: tint(meta.color, 9), borderColor: tint(meta.color, 22) }}>
                  {StatusIcon
                    ? <StatusIcon size={13} style={{ color: meta.color }} weight="duotone" />
                    : <Clock size={13} style={{ color: meta.color }} weight="duotone" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11.5px] font-bold"
                      style={{ color: isCurrent ? meta.color : 'rgb(var(--c-ink))' }}>
                      {meta.label}
                      {isCurrent && (
                        <span className="ms-1.5 text-[10px] font-bold tabular-nums opacity-80 inline-flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: meta.color }} />
                          نشط
                        </span>
                      )}
                    </p>
                    <p className="text-[11.5px] font-bold tabular-nums" style={{ color: meta.color }}>
                      {fmtDuration(ms)}
                      {total > 0 && ms > 0 && <span className="opacity-60 text-[10px] ms-1">({pct}%)</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line">
          <div>
            <p className="text-[10px] text-muted font-semibold">وقت الإنشاء</p>
            <p className="text-[11px] font-bold text-ink tabular-nums mt-0.5">
              {created ? new Date(created).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted font-semibold">{closed ? 'وقت الإغلاق' : 'الحالة الحالية'}</p>
            <p className="text-[11px] font-bold tabular-nums mt-0.5"
              style={{ color: closed ? CLOSED : statusMeta[current]?.color || 'rgb(var(--c-primary))' }}>
              {closed && closedMs
                ? new Date(closedMs).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })
                : (statusMeta[current]?.label || current)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
