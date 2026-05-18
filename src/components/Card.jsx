/**
 * Shared professional card primitives — used across the app for visual consistency.
 *
 * Card        — base wrapper with subtle gradient bg, rounded-2xl, hover lift + glow.
 * CardHeader  — colored gradient header strip with optional icon container.
 * SectionPanel — Card + CardHeader composition used for list/feed sections.
 */

import { Sparkles } from 'lucide-react';

/* ── Base Card ───────────────────────────────────────────── */
export function Card({
  children,
  className = '',
  hover = true,
  accentColor,        // optional — adds 3px right border + radial glow on hover
  topAccent = false,  // shows a thin gradient strip at top
  ...rest
}) {
  return (
    <div
      {...rest}
      className={`group relative bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden transition-all duration-300 ${
        hover ? 'hover:shadow-[0_8px_28px_rgba(169,129,89,0.15)] hover:-translate-y-0.5' : ''
      } ${className}`}
      style={{
        ...(accentColor ? { borderRight: `3px solid ${accentColor}` } : {}),
        ...(rest.style || {}),
      }}
    >
      {topAccent && accentColor && (
        <div
          className="absolute top-0 right-0 left-0 h-0.5 opacity-70"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          }}
        />
      )}
      {accentColor && hover && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 100% 0%, ${accentColor}15, transparent 60%)`,
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

/* ── Card Header ─────────────────────────────────────────── */
export function CardHeader({
  Icon,
  title,
  subtitle,
  color = '#A98159',
  bgGradient,
  right,
  sparkle = false,
  className = '',
}) {
  const headerBg =
    bgGradient ||
    `linear-gradient(135deg, ${color}10 0%, #fff 55%)`;
  const iconGradient = `linear-gradient(135deg, ${color}DD, ${color})`;

  return (
    <div
      className={`flex items-center justify-between px-5 py-3.5 border-b border-[#EDE5DC] gap-3 ${className}`}
      style={{ background: headerBg }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="relative flex-shrink-0">
            <div
              className="absolute inset-0 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity"
              style={{ background: iconGradient }}
            />
            <div
              className="relative w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
              style={{ background: iconGradient }}
            >
              <Icon size={16} className="text-white" strokeWidth={2.25} />
              {sparkle && (
                <Sparkles
                  size={9}
                  className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow"
                />
              )}
            </div>
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-bold text-[#2D2926] text-sm truncate">{title}</h2>
          {subtitle && (
            <p className="text-[11px] text-[#9D8F85] mt-0.5 font-medium truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

/* ── Section Panel — Card + Header composition ───────────── */
export function SectionPanel({
  Icon,
  title,
  subtitle,
  color = '#A98159',
  bgGradient,
  right,
  sparkle = false,
  children,
  className = '',
}) {
  return (
    <Card className={className} accentColor={color}>
      <CardHeader
        Icon={Icon}
        title={title}
        subtitle={subtitle}
        color={color}
        bgGradient={bgGradient}
        right={right}
        sparkle={sparkle}
      />
      {children}
    </Card>
  );
}

export default Card;
