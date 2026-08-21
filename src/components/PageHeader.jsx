/**
 * src/components/PageHeader.jsx
 *
 * The head every section wears.
 *
 * One component for twenty-odd screens, so it is where the system's character
 * is decided. The colours are the brand's and do not change; what changed is
 * that the band is gone.
 *
 * The admin chrome — the sidebar rail and the top bar — is already deep navy.
 * A navy masthead underneath it meant every screen opened with two dark bands
 * stacked, which pushed the first real figure below the fold and made the
 * canvas feel like a strip rather than a page. So the head now sits on the
 * canvas: a tile, a title, and the section's figures as small tinted cards in
 * the same language the panels below them use.
 *
 * The API is unchanged, so all twenty-odd call sites keep working.
 */

import { IconTile } from './ui/index.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/* A tone names which colour a figure carries, so a section can mark its lead
   number without every call site inventing a hex. */
const TONE = {
  gold:  'rgb(var(--c-accent-600))',
  alert: '#DC2626',
  undefined: 'rgb(var(--c-primary))',
};

export default function PageHeader({
  Icon,
  kicker,
  title,
  subtitle,
  /* [{ value, label, tone }] — tone 'gold' for the number the section is
     really about, so one figure leads and the rest support it. */
  stats = [],
  /* Two action slots kept from the banded version. Both now sit on the light
     canvas, so a control drawn for a white surface works in either. */
  heroActions,
  right,
  /* Kept for the call sites that still pass them. */
  gradient, glowColor, sparkle,
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">

        <div className="flex items-center gap-3.5 min-w-0">
          {Icon && <IconTile Icon={Icon} size="lg" />}
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase leading-none text-primary/55">
              {kicker || 'لوحة الإدارة'}
            </p>
            <h1 className="text-[21px] sm:text-[23px] font-extrabold text-ink mt-1.5 truncate leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[12px] font-medium text-muted mt-1 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* The stats block must stay shrinkable: at four stats plus an action it
            is wider than a phone, and flex-shrink-0 held it at max-content so the
            trailing counters were clipped off-screen. It only ever shrinks when it
            would otherwise overflow, so wide screens are unchanged. */}
        {(stats.length > 0 || heroActions) && (
          <div className="flex items-center gap-2 flex-wrap">
            {stats.map((s, i) => {
              const c = TONE[s.tone] || TONE.undefined;
              return (
                <div
                  key={i}
                  className="px-3.5 py-2 rounded-[11px] border text-center min-w-[74px]"
                  style={{ background: tint(c, 12), borderColor: tint(c, 28) }}
                >
                  <p className="text-[21px] font-extrabold tabular-nums leading-none" style={{ color: c }}>
                    {s.value}
                  </p>
                  <p className="text-[10px] font-semibold text-muted mt-1.5 whitespace-nowrap">{s.label}</p>
                </div>
              );
            })}
            {heroActions && (
              <div className="flex items-center gap-2 flex-wrap ms-1">{heroActions}</div>
            )}
          </div>
        )}
      </div>

      {right && (
        <div className="mt-3 pt-3 border-t border-line flex items-center justify-end gap-2 flex-wrap">
          {right}
        </div>
      )}
    </div>
  );
}
