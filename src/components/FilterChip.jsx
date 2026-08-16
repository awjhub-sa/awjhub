export default function FilterChip({
  active,
  onClick,
  count,
  Icon,
  color = 'rgb(var(--c-primary))',
  children,
}) {
  const activeStyle = active
    ? {
        background: `linear-gradient(135deg, ${color}DD, ${color})`,
        borderColor: color,
        color: '#fff',
        boxShadow: `0 3px 10px ${color}55`,
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      style={activeStyle}
      className={`group/chip px-3 py-1.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${
        active
          ? 'scale-[1.03]'
          : 'bg-white text-ink border-line hover:scale-[1.02]'
      }`}
    >
      {Icon && (
        <Icon
          size={14}
          className={`transition-transform duration-300 ${
            active ? 'scale-110' : 'group-hover/chip:scale-110'
          }`}
          style={!active ? { color } : undefined}
        />
      )}
      {children}
      {count !== undefined && count !== null && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-xs ${
            active ? 'bg-white/25 text-white' : 'bg-background'
          }`}
          style={!active ? { color } : undefined}
        >
          {count}
        </span>
      )}
    </button>
  );
}
