/**
 * src/components/PageHeader.jsx
 *
 * The masthead every section wears.
 *
 * One component for twenty-odd screens, so it is where the system's character
 * is decided. The colours are the brand's and do not change; what changed is
 * everything about how they are arranged.
 *
 * Three things do the work:
 *
 *   Light, not paint. The accent used to sit as a flat tinted square behind the
 *   icon. Now it arrives as two soft blooms across the navy and a thin bright
 *   seam along the top edge, so the surface reads as lit rather than coloured
 *   in. A flat field of tint is the single most dating thing an interface can
 *   do to itself.
 *
 *   Figures as objects. The statistics were loose numerals floating on the
 *   band; they are now frosted tiles with their own edge, which lets them be
 *   read at a glance and gives the right-hand side a shape rather than a ragged
 *   edge.
 *
 *   Room. The band is taller and the type is larger, because a masthead that
 *   sits tight against its own text reads as a toolbar.
 */

export default function PageHeader({
  Icon,
  kicker,
  title,
  subtitle,
  /* [{ value, label, tone }] — tone 'gold' for the number the section is
     really about, so one figure leads and the rest support it. */
  stats = [],
  /* Two action slots, because there are two kinds of control. `heroActions`
     sits on the navy and is for buttons styled for it — the gold card, the
     white ghost. `right` sits on the light strip below and is for everything
     already drawn for a white surface. */
  heroActions,
  right,
  /* Kept for the call sites that still pass them; the band is the brand navy
     now, and an accent per section would undo the point of a shared header. */
  gradient, glowColor, sparkle,
}) {
  return (
    <div className="rounded-3xl overflow-hidden shadow-brand">
      <div
        className="relative px-5 sm:px-7 py-6 sm:py-7 flex items-center justify-between gap-5 flex-wrap"
        style={{
          background:
            'linear-gradient(140deg, rgb(var(--c-primary-700)) 0%, rgb(var(--c-primary)) 42%, rgb(var(--c-primary-900)) 100%)',
        }}
      >
        {/* Two blooms rather than one: a warm one where the eye lands first and
            a cool one opposite, so the band has depth across its width instead
            of a single bright corner. */}
        <span aria-hidden className="pointer-events-none absolute -top-28 -left-16 w-[26rem] h-64 rounded-full opacity-[0.22]"
          style={{ background: 'radial-gradient(circle, rgb(var(--c-accent)) 0%, transparent 66%)' }} />
        <span aria-hidden className="pointer-events-none absolute -bottom-32 -right-10 w-96 h-64 rounded-full opacity-[0.20]"
          style={{ background: 'radial-gradient(circle, rgb(var(--c-primary-400)) 0%, transparent 70%)' }} />
        {/* The seam — one hairline of accent along the top, the way light
            catches an edge. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.55), transparent)' }} />

        <div className="relative flex items-center gap-4 min-w-0">
          {Icon && (
            <span
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0
                         border border-white/15 backdrop-blur-sm"
              style={{
                background: 'linear-gradient(150deg, rgb(var(--c-accent) / 0.28), rgb(var(--c-accent) / 0.08))',
                boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.18)',
              }}
            >
              <Icon size={26} weight="duotone" className="text-accent" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[10.5px] font-black tracking-[0.22em] text-accent/90 uppercase">
              {kicker || 'لوحة الإدارة'}
            </p>
            <h1 className="text-[22px] sm:text-[26px] font-black text-white mt-1.5 truncate leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[12.5px] font-bold text-white/60 mt-1 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {(stats.length > 0 || heroActions) && (
          <div className="relative flex items-center gap-2.5 flex-shrink-0 flex-wrap">
            {stats.map((s, i) => (
              <div
                key={i}
                className="px-4 py-2.5 rounded-2xl border border-white/12 backdrop-blur-sm text-center min-w-[76px]"
                style={{
                  background: s.tone === 'gold'
                    ? 'rgb(var(--c-accent) / 0.16)'
                    : s.tone === 'alert'
                      ? 'rgb(220 38 38 / 0.20)'
                      : 'rgb(255 255 255 / 0.07)',
                }}
              >
                <p className={`text-[25px] font-black tabular-nums leading-none ${
                  s.tone === 'gold' ? 'text-accent'
                    : s.tone === 'alert' ? 'text-red-300'
                    : 'text-white'
                }`}>
                  {s.value}
                </p>
                <p className="text-[10.5px] font-bold text-white/60 mt-1.5 whitespace-nowrap">{s.label}</p>
              </div>
            ))}
            {heroActions && (
              <div className="flex items-center gap-2 flex-wrap ms-1">{heroActions}</div>
            )}
          </div>
        )}
      </div>

      {right && (
        <div className="px-5 sm:px-7 py-3 bg-white border-t border-line flex items-center justify-end gap-2 flex-wrap">
          {right}
        </div>
      )}
    </div>
  );
}
