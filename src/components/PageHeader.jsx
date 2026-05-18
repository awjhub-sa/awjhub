import { Sparkles } from 'lucide-react';

/**
 * Shared page header with creative gradient icon container,
 * soft glow, and sparkle accent. Use across admin pages for consistency.
 *
 * Props:
 *   Icon       — lucide-react icon component
 *   title      — h1 text
 *   subtitle   — small description below title
 *   gradient   — { from, to } CSS color stops for the icon container
 *   glowColor  — rgba string used for the soft glow behind the icon
 *   right      — optional ReactNode rendered on the left (RTL → visually right end)
 *   sparkle    — boolean, show sparkle accent (default true)
 */
export default function PageHeader({
  Icon,
  title,
  subtitle,
  gradient = { from: '#C4A46E', to: '#A98159' },
  glowColor = 'rgba(196,164,110,0.4)',
  right,
  sparkle = true,
}) {
  const gradientStyle = `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`;

  return (
    <div className="bg-white rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] overflow-hidden group">
      <div
        className="flex items-center justify-between px-6 py-4 relative gap-3"
        style={{ background: 'linear-gradient(135deg, #FDF8F0 0%, #fff 55%)' }}
      >
        <div
          className="absolute inset-y-0 right-0 w-40 opacity-30 pointer-events-none"
          style={{
            background: `radial-gradient(circle at top right, ${glowColor}, transparent 70%)`,
          }}
        />
        <div className="flex items-center gap-3 relative min-w-0">
          {Icon && (
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity"
                style={{ background: gradientStyle }}
              />
              <div
                className="relative w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                style={{ background: gradientStyle }}
              >
                <Icon size={20} className="text-white" strokeWidth={2.25} />
                {sparkle && (
                  <Sparkles
                    size={10}
                    className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow"
                  />
                )}
              </div>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[#2D2926] truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-[#9D8F85] mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div className="flex-shrink-0 relative">{right}</div>}
      </div>
    </div>
  );
}
