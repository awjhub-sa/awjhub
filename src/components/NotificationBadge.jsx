export default function NotificationBadge({
  count,
  variant = 'red',
  floating = false,
  className = '',
  label,
}) {
  if (!count || count <= 0) return null;

  const VARIANTS = {
    red:   {
      bg:    'linear-gradient(135deg, #EF4444, #DC2626)',
      pulse: 'badge-pulse-red',
    },
    blue:  {
      bg:    'linear-gradient(135deg, #06B6D4, #0891B2)',
      pulse: 'badge-pulse-blue',
    },
    gold:  {
      bg:    'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))',
      pulse: 'badge-pulse-gold',
    },
  };

  const v = VARIANTS[variant] || VARIANTS.red;
  const display = count > 99 ? '99+' : count;
  const position = floating ? 'absolute -top-1.5 -right-1.5 z-10' : 'inline-flex';

  return (
    <span
      role="status"
      aria-label={label || `${count} جديد`}
      className={`${position} ${v.pulse} min-w-[22px] h-[22px] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center px-1.5 ring-2 ring-white shadow-md tabular-nums ${className}`}
      style={{ background: v.bg }}
    >
      {display}
    </span>
  );
}
