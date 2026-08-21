export default function FilterChip({
  active,
  onClick,
  count,
  Icon,
  color = 'rgb(var(--c-primary))',
  children,
}) {
  /* Selected is a flat fill of the filter's own colour, not a gradient with a
     coloured shadow under it. A chip that grows and glows when picked competes
     with the rows it is meant to be filtering. */
  return (
    <button
      type="button"
      onClick={onClick}
      style={
        active
          ? { background: color, borderColor: color, color: '#fff' }
          : undefined
      }
      className={`group/chip px-3 py-1.5 rounded-[10px] text-[12.5px] font-bold border
                  transition-colors flex items-center gap-1.5 whitespace-nowrap ${
        active ? '' : 'bg-white text-ink border-line hover:bg-[rgb(var(--c-bg))]'
      }`}
    >
      {Icon && <Icon size={14} weight="bold" style={!active ? { color } : undefined} />}
      {children}
      {count !== undefined && count !== null && (
        <span
          className="px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums"
          style={
            active
              ? { background: 'rgb(255 255 255 / 0.22)', color: '#fff' }
              : { background: `color-mix(in srgb, ${color} 12%, #fff)`, color }
          }
        >
          {count}
        </span>
      )}
    </button>
  );
}
