/**
 * src/components/ui/index.jsx
 *
 * The refreshed surface vocabulary: dark chrome, clean content.
 *
 * Three rules separate this set from what it replaces, and every component
 * here follows them:
 *
 *   Colour is information. Every surface here is tinted with the colour of the
 *   thing it holds — red for reports, blue for logistics, gold for the season
 *   figures — so the tint tells you what you are looking at before you read it.
 *   The tint is computed from that one colour, never picked by hand, which is
 *   what keeps a colourful page from turning into confetti.
 *
 *   Surfaces are flat. The gradient-filled tile with a blurred copy of itself
 *   glowing behind it is the single most dating thing in the old screens. A
 *   tile is a flat tint with a hairline edge.
 *
 *   Weight builds hierarchy. When every string is font-black nothing leads.
 *   Titles are bold, figures are heavy, and everything else is medium.
 */

import { CaretLeft } from '@phosphor-icons/react';

/* Tints are computed rather than hand-picked so any brand or status colour can
   be passed in and still land on a readable surface. */
const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/* Hover states are spelled once here so every clickable surface answers the
   pointer the same way: a small lift, a deeper shadow, and a press that puts
   the card back down. A card that does not move is a card that does nothing —
   which is the contract, since nothing below renders as a button unless it was
   handed somewhere to go. */
const LIFT =
  'cursor-pointer transition-all duration-200 ' +
  'hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-8px_rgb(var(--c-ink)/0.22)] ' +
  'active:translate-y-0 active:shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/* ─── Surface ─────────────────────────────────────────────────
   The card. One hairline, one whisper of shadow, and nothing else. */
export function Surface({ children, className = '', interactive = false, ...rest }) {
  return (
    <div
      {...rest}
      className={`bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ${
        interactive ? LIFT : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── IconTile ────────────────────────────────────────────────
   Flat tint, hairline edge, no glow. Sizes are fixed so a page of them lines
   up rather than drifting a pixel per call site. */
export function IconTile({ Icon, color = 'rgb(var(--c-primary))', size = 'md', className = '' }) {
  const box = { sm: 'w-8 h-8 rounded-lg', md: 'w-10 h-10 rounded-[10px]', lg: 'w-12 h-12 rounded-xl' }[size];
  const px  = { sm: 15, md: 18, lg: 21 }[size];
  return (
    <span
      className={`${box} flex items-center justify-center shrink-0 border
                  transition-transform duration-200 group-hover:scale-105 ${className}`}
      style={{ background: tint(color, 9), borderColor: tint(color, 22) }}
    >
      <Icon size={px} weight="duotone" style={{ color }} />
    </span>
  );
}

/* ─── Pill ────────────────────────────────────────────────────
   One border-less chip at one size. The old screens stacked five of these per
   row at 9px with two-pixel borders, which read as confetti. */
export function Pill({ children, color = 'rgb(var(--c-muted))', Icon, solid = false, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded-md whitespace-nowrap leading-none ${className}`}
      style={
        solid
          ? { background: color, color: '#fff' }
          : { background: tint(color, 11), color }
      }
    >
      {Icon && <Icon size={10} weight="bold" />}
      {children}
    </span>
  );
}

/* ─── Masthead ────────────────────────────────────────────────
   The dark band at the top of a screen.
   One flat navy with a single soft lift toward the leading corner — not the
   three-stop diagonal and pair of coloured blobs it replaces. The gold appears
   once, as a hairline along the top edge, which is enough to place the brand.
   Figures sit in a row divided by rules rather than in frosted boxes; a divided
   row is what a set of related numbers looks like. */
export function Masthead({ Icon, kicker, title, subtitle, stats = [], actions }) {
  return (
    <div
      className="relative rounded-[18px] overflow-hidden px-5 sm:px-7 py-6 flex items-center justify-between gap-6 flex-wrap"
      style={{
        background:
          'linear-gradient(180deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary-700)) 100%)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.6), transparent)' }}
      />

      <div className="relative flex items-center gap-4 min-w-0">
        {Icon && (
          <span
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
            style={{ background: 'rgb(255 255 255 / 0.06)' }}
          >
            <Icon size={23} weight="duotone" className="text-accent" />
          </span>
        )}
        <div className="min-w-0">
          {kicker && (
            <p className="text-[10px] font-bold tracking-[0.18em] text-accent/80 uppercase">{kicker}</p>
          )}
          <h1 className="text-[21px] sm:text-[24px] font-extrabold text-white mt-1 truncate leading-tight">
            {title}
          </h1>
          {subtitle && <p className="text-[12px] font-medium text-white/55 mt-1 truncate">{subtitle}</p>}
        </div>
      </div>

      {(stats.length > 0 || actions) && (
        <div className="relative flex items-center gap-5 flex-wrap">
          {stats.length > 0 && (
            <div className="flex items-center">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className={`px-5 first:ps-0 ${i > 0 ? 'border-s border-white/12' : ''}`}
                >
                  <p
                    className={`text-[26px] font-extrabold tabular-nums leading-none ${
                      s.tone === 'gold' ? 'text-accent' : s.tone === 'alert' ? 'text-red-300' : 'text-white'
                    }`}
                  >
                    {s.value ?? '—'}
                  </p>
                  <p className="text-[11px] font-medium text-white/55 mt-1.5 whitespace-nowrap">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
      )}
    </div>
  );
}

/* ─── PanelHeader / Panel ─────────────────────────────────────
   A section's own masthead: tile, title, count, and one way out to the full
   register. The "view all" control is a quiet text link with a chevron, not a
   third tinted button competing with the tile beside it. */
export function PanelHeader({ Icon, color = 'rgb(var(--c-primary))', title, subtitle, action, actionLabel = 'عرض الكل', right }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b"
      style={{ background: tint(color, 12), borderColor: tint(color, 28) }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <IconTile Icon={Icon} color={color} size="md" />}
        <div className="min-w-0">
          <p className="text-[14px] font-bold truncate leading-tight" style={{ color }}>{title}</p>
          {subtitle && <p className="text-[11.5px] font-medium text-muted mt-1 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        {action && (
          <button
            onClick={action}
            className="group inline-flex items-center gap-1 text-[11.5px] font-bold text-muted hover:text-primary transition-colors px-2 py-1 rounded-lg"
          >
            {actionLabel}
            <CaretLeft size={11} weight="bold" className="transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function Panel({ children, className = '', ...header }) {
  return (
    <Surface className={`overflow-hidden ${className}`}>
      <PanelHeader {...header} />
      {children}
    </Surface>
  );
}

/* ─── StatTile ────────────────────────────────────────────────
   A figure that describes the season. The label leads at small size, the
   number carries the weight, and the colour is confined to the icon — a
   five-across row of differently-coloured numerals is a chart nobody asked
   for. */
export function StatTile({ label, value, Icon, color = 'rgb(var(--c-primary))', sub, onClick, active = false }) {
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      type={clickable ? 'button' : undefined}
      aria-pressed={clickable ? active : undefined}
      className={`group block text-start rounded-[14px] border p-4 w-full
                  shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ${clickable ? LIFT : ''}`}
      style={{
        background: tint(color, active ? 20 : 12),
        borderColor: tint(color, active ? 58 : 28),
        outlineColor: color,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-muted truncate">{label}</p>
        <Icon size={16} weight={active ? 'fill' : 'duotone'} style={{ color }}
          className="shrink-0 mt-px transition-transform duration-200 group-hover:scale-125" />
      </div>
      <p className="text-[30px] font-extrabold tabular-nums leading-none mt-3" style={{ color }}>{value ?? '—'}</p>
      {sub && <p className="text-[11px] font-medium text-muted mt-2 truncate">{sub}</p>}
    </Tag>
  );
}

/* ─── QueueCard ───────────────────────────────────────────────
   The two queues the page exists to answer. Loud when they hold something,
   settled and green when they do not — but "loud" is now a coloured rail and a
   large numeral rather than a tinted gradient panel. */
export function QueueCard({ n, label, done, Icon, color, DoneIcon, onClick }) {
  const live = n > 0;
  const tone = live ? color : '#15803D';
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      type={clickable ? 'button' : undefined}
      className={`group relative w-full text-start rounded-[14px] border overflow-hidden
                  flex items-center gap-4 ps-5 pe-4 py-4
                  shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] ${clickable ? LIFT : ''}`}
      style={{ background: tint(tone, 12), borderColor: tint(tone, 30), outlineColor: tone }}
    >
      <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: tone }} />
      <IconTile Icon={live ? Icon : DoneIcon} color={tone} size="lg" />
      <span className="min-w-0 flex-1">
        {live ? (
          <>
            <span className="block text-[32px] font-extrabold tabular-nums leading-none" style={{ color: tone }}>
              {n}
            </span>
            <span className="block text-[12px] font-semibold text-muted mt-2">{label}</span>
          </>
        ) : (
          <>
            <span className="block text-[15px] font-bold" style={{ color: tone }}>{done}</span>
            <span className="block text-[11.5px] font-medium text-muted mt-1">لا شيء ينتظر هنا</span>
          </>
        )}
      </span>
      {clickable && (
        <CaretLeft size={15} weight="bold"
          className="shrink-0 text-muted/40 transition-all duration-200
                     group-hover:text-muted group-hover:-translate-x-0.5" />
      )}
    </Tag>
  );
}

/* ─── ListRow ─────────────────────────────────────────────────
   The register row. The leading rail is where a row's category lives, which
   frees the body to be typography instead of a shelf of coloured chips. */
export function ListRow({ children, onClick, rail, last = false, flagged = false, className = '' }) {
  const clickable = typeof onClick === 'function';
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      type={clickable ? 'button' : undefined}
      className={`group relative w-full text-start flex items-center gap-3.5 ps-5 pe-4 py-3.5
                  transition-colors ${last ? '' : 'border-b border-line'}
                  ${flagged ? 'bg-[rgb(var(--c-primary)/0.03)]' : ''}
                  ${clickable ? 'cursor-pointer hover:bg-[rgb(var(--c-bg))] active:bg-[rgb(var(--c-line)/0.5)]' : ''}
                  ${className}`}
    >
      {rail && (
        <span className="absolute inset-y-0 start-0 w-[3px] transition-all duration-200 group-hover:w-[5px]"
          style={{ background: rail }} />
      )}
      {children}
    </Tag>
  );
}

/* Row internals — kept here so every register spells a row the same way. */
export function RowTitle({ children, className = '' }) {
  return <p className={`text-[13.5px] font-bold text-ink truncate ${className}`}>{children}</p>;
}

export function RowMeta({ items = [] }) {
  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5">
      {items.filter(Boolean).map(({ Icon, value }, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted min-w-0">
          <Icon size={12} weight="bold" className="text-muted/60 shrink-0" />
          <span className="font-medium text-ink/75 truncate max-w-[110px]">{value || '—'}</span>
        </span>
      ))}
    </div>
  );
}

/* ─── EmptyState ──────────────────────────────────────────────
   Quiet by design: an empty register is a normal state, not an error. */
export function EmptyState({ Icon, title, hint }) {
  return (
    <div className="py-14 px-5 text-center">
      <Icon size={26} weight="duotone" className="mx-auto text-muted/35" />
      <p className="text-[13px] font-semibold text-muted mt-3">{title}</p>
      {hint && <p className="text-[11.5px] font-medium text-muted/70 mt-1">{hint}</p>}
    </div>
  );
}
