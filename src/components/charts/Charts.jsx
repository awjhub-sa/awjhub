/**
 * A small chart kit, drawn by hand in SVG.
 *
 * No charting library. Three shapes cover everything this system has to say —
 * a ranked bar, a ring, a trend — and a library would have brought a hundred
 * kilobytes, its own theme system, and its own idea of which way round a
 * right-to-left axis goes. These take the brand tokens directly and read
 * correctly in Arabic because they were written for it.
 *
 * The card these sit in is src/components/ui's Panel; the leading number is
 * its StatTile. A chart kit should draw the data and nothing around it.
 */

import { useId } from 'react';

const AR = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
export const arNum = AR;

export function Empty({ label = 'لا بيانات في هذا القسم بعد' }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[12px] font-bold text-muted/70">{label}</p>
    </div>
  );
}

/* ── Ranked horizontal bars ───────────────────────────────── */
export function BarsH({ items, max, unit = '', height = 26 }) {
  if (!items?.length) return <Empty />;
  const top = max ?? Math.max(...items.map(i => i.value), 1);

  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="grid items-center gap-3"
          style={{ gridTemplateColumns: `minmax(0, ${it.wide ? '13rem' : '7.5rem'}) 1fr auto` }}>
          <span className="text-[11px] font-bold text-ink truncate" title={it.label}>{it.label}</span>
          <span className="rounded-full bg-[rgb(var(--c-bg))] overflow-hidden" style={{ height: height / 3 }}>
            <span className="block h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(2, (it.value / top) * 100)}%`,
                background: it.color,
              }} />
          </span>
          <span className="text-[11px] font-bold tabular-nums text-ink w-10 text-end">
            {AR(it.value)}{unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Ring ─────────────────────────────────────────────────── */
export function Donut({ segments, total, caption, size = 150, thickness = 22 }) {
  const sum = segments.reduce((a, s) => a + s.value, 0);
  if (!sum) return <Empty />;

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s, i) => {
            const len = (s.value / sum) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={s.color} strokeWidth={thickness}
                strokeDasharray={dash} strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle"
          className="fill-ink" style={{ fontSize: 26, fontWeight: 800 }}>
          {AR(total ?? sum)}
        </text>
        {caption && (
          <text x={size / 2} y={size / 2 + 16} textAnchor="middle"
            className="fill-muted" style={{ fontSize: 10, fontWeight: 700 }}>
            {caption}
          </text>
        )}
      </svg>

      <ul className="space-y-1.5 min-w-0 flex-1">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="font-bold text-ink flex-1 truncate">{s.label}</span>
            <span className="font-bold tabular-nums text-muted">{AR(s.value)}</span>
            <span className="font-semibold tabular-nums text-muted/60 w-9 text-end">
              {AR(Math.round((s.value / sum) * 100))}٪
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Trend ────────────────────────────────────────────────── */
export function Trend({ series, labels, max = 10, height = 190, unit = '' }) {
  const uid = useId().replace(/:/g, '');
  const live = series.filter(s => s.points.some(p => p != null));
  if (!live.length || labels.length < 2) return <Empty />;

  const W = 100, H = 100;                        // drawn in a unit box, scaled by viewBox

  /* The axis follows the data, not the scale. Readiness scores cluster between
     eight and nine, and a fixed 0–10 axis draws that as a flat line pinned to
     the ceiling — the movement the chart exists to show disappears. */
  const vals = live.flatMap(s => s.points.filter(v => v != null));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 0.6) { const mid = (hi + lo) / 2; lo = mid - 0.4; hi = mid + 0.4; }
  const pad = (hi - lo) * 0.18;
  lo = Math.max(0, lo - pad);
  hi = Math.min(max, hi + pad);

  const px = (i) => (i / (labels.length - 1)) * W;
  const py = (v) => H - ((v - lo) / (hi - lo)) * H;

  /* RTL: the first label belongs on the right. */
  const x = (i) => W - px(i);

  return (
    <div className="relative">
      <span className="absolute top-0 end-0 text-[10px] font-semibold text-muted tabular-nums">
        {AR(hi.toFixed(1))}
      </span>
      <span className="absolute end-0 text-[10px] font-semibold text-muted tabular-nums"
        style={{ top: height - 12 }}>
        {AR(lo.toFixed(1))}
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ width: '100%', height }} className="overflow-visible">
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f}
            stroke="rgb(var(--c-line))" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        ))}

        {live.map((s, si) => {
          const pts = s.points
            .map((v, i) => (v == null ? null : `${x(i)},${py(v)}`))
            .filter(Boolean);
          if (!pts.length) return null;
          return (
            <g key={si}>
              <defs>
                <linearGradient id={`${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`${W},${H} ${pts.join(' ')} 0,${H}`} fill={`url(#${uid}-${si})`} />
              {/* Line and fill only. The box is stretched to the panel width,
                  so anything with a shape of its own — a dot, a label — comes
                  out an oval; those live outside the svg as HTML. */}
              <polyline points={pts.join(' ')} fill="none" stroke={s.color}
                strokeWidth="2" vectorEffect="non-scaling-stroke"
                strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      {/* Each stop labelled with its value above the date, so the line is read
          without a tooltip. */}
      <div className="flex justify-between mt-2 px-0.5" dir="rtl">
        {labels.map((l, i) => (
          <span key={i} className="text-center leading-tight">
            <span className="block text-[11px] font-bold tabular-nums text-ink">
              {live[0]?.points[i] == null ? '—' : AR(live[0].points[i].toFixed(1))}
            </span>
            <span className="block text-[10px] font-bold text-muted tabular-nums mt-0.5">{l}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {live.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
            <span className="w-3 h-1.5 rounded-full" style={{ background: s.color }} />
            {s.name}
            {s.note && <span className="text-muted font-bold">· {s.note}{unit}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

