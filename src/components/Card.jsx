/**
 * src/components/Card.jsx
 *
 * The older card vocabulary, kept because call sites still use it, but drawn in
 * the language of src/components/ui: a flat tinted header, a hairline edge, and
 * no glow.
 *
 * What went: the blurred copy of the icon tile sitting behind itself, the
 * radial wash that faded in on hover, and the gradient fill on the tile. All
 * three were the same idea — depth painted on a surface that has none — and all
 * three are what dated these screens.
 */

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

export function Card({
  children,
  className = '',
  hover = true,
  accentColor,
  topAccent = false,
  ...rest
}) {
  return (
    <div
      {...rest}
      className={`group relative bg-white rounded-[14px] border border-line overflow-hidden
                  shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200 ${
        hover ? 'hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]' : ''
      } ${className}`}
      style={{
        ...(accentColor ? { borderRight: `3px solid ${accentColor}` } : {}),
        ...(rest.style || {}),
      }}
    >
      {topAccent && accentColor && (
        <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: accentColor }} />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export function CardHeader({
  Icon,
  title,
  subtitle,
  color = 'rgb(var(--c-primary))',
  bgGradient,
  right,
  sparkle,
  className = '',
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 sm:px-5 py-3.5 border-b gap-3 ${className}`}
      style={{ background: bgGradient || tint(color, 12), borderColor: tint(color, 28) }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span
            className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 border"
            style={{ background: tint(color, 9), borderColor: tint(color, 22) }}
          >
            <Icon size={18} weight="duotone" style={{ color }} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold truncate leading-tight" style={{ color }}>{title}</h2>
          {subtitle && (
            <p className="text-[11.5px] text-muted mt-1 font-medium truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

export function SectionPanel({
  Icon,
  title,
  subtitle,
  color = 'rgb(var(--c-primary))',
  bgGradient,
  right,
  sparkle,
  children,
  className = '',
}) {
  return (
    <Card className={className}>
      <CardHeader
        Icon={Icon}
        title={title}
        subtitle={subtitle}
        color={color}
        bgGradient={bgGradient}
        right={right}
      />
      {children}
    </Card>
  );
}

export default Card;
