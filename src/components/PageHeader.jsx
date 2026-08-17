/**
 * PageHeader — the masthead every admin section opens with.
 *
 * One component, so the sections cannot drift apart: a navy band carrying the
 * identity and the numbers that matter to that section, and — when the section
 * has controls — a light strip beneath it holding them.
 *
 * The split is deliberate. Controls are pale, bordered, gradient-filled things
 * designed for a white surface; dropping them onto the navy would have meant
 * restyling every button in the app. The band says where you are and how much
 * of it there is; the strip is where you act.
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
    <div className="rounded-2xl overflow-hidden border border-line shadow-[0_6px_24px_rgb(var(--c-primary-900)/0.18)]">
      <div className="relative px-4 sm:px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary-700)) 100%)' }}>

        {/* A warm bloom in the corner — the accent as light, not as a field. */}
        <span aria-hidden className="pointer-events-none absolute -top-20 -left-10 w-64 h-48 rounded-full opacity-[0.16]"
          style={{ background: 'radial-gradient(circle, rgb(var(--c-accent)) 0%, transparent 68%)' }} />

        <div className="relative flex items-center gap-3 min-w-0">
          {Icon && (
            <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-accent/40 bg-accent/12">
              <Icon size={21} weight="bold" className="text-accent" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.2em] text-accent/85">
              {kicker || 'لوحة الإدارة'}
            </p>
            <h1 className="text-lg sm:text-xl font-black text-white mt-1 truncate">{title}</h1>
            {subtitle && (
              <p className="text-[11px] font-bold text-white/55 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {(stats.length > 0 || heroActions) && (
          <div className="relative flex items-center gap-4 sm:gap-5 flex-shrink-0 flex-wrap">
            {stats.map((s, i) => (
              <div key={i} className="text-center px-1">
                <p className={`text-xl font-black tabular-nums leading-none ${
                  s.tone === 'gold' ? 'text-accent'
                    : s.tone === 'alert' ? 'text-red-400'
                    : 'text-white'
                }`}>
                  {s.value}
                </p>
                <p className="text-[10px] font-bold text-white/50 mt-1 whitespace-nowrap">{s.label}</p>
              </div>
            ))}
            {heroActions && (
              <>
                {stats.length > 0 && <span className="w-px h-10 bg-white/12" />}
                <div className="flex items-center gap-2 flex-wrap">{heroActions}</div>
              </>
            )}
          </div>
        )}
      </div>

      {right && (
        <div className="px-4 sm:px-5 py-2.5 bg-white border-t border-line flex items-center justify-end gap-2 flex-wrap">
          {right}
        </div>
      )}
    </div>
  );
}
