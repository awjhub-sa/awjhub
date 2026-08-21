/**
 * DetailDrawer — the panel a field record opens into.
 *
 * The details used to unfold underneath the card: the list jumped, the row you
 * were reading moved down the page, and the panel was as wide as the table so
 * everything in it had to be a small tile. A record deserves its own surface.
 *
 * It slides from the left — the far side in a right-to-left layout — so it
 * never covers the sidebar, and it closes on Escape or on the backdrop the way
 * every drawer should.
 */

import { useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import { Panel } from './ui/index.jsx';

/* The head is navy, so a record's own colour has to be lifted toward white
   before it lands there — a navy support type on a navy band is invisible. */
const onDark = (c) => `color-mix(in srgb, ${c} 55%, #fff)`;

export default function DetailDrawer({
  open, onClose,
  kicker, title, subtitle,
  Icon, accent = 'rgb(var(--c-accent))',
  chips,          // rendered under the title, on the navy
  children,
  footer,         // sticky action bar
  width = 620,
}) {
  /* Escape closes, and the page behind stops scrolling — a drawer that lets
     the list scroll under it reads as broken. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* A CSS animation, not a JS-driven one: it runs on the compositor, so it
          cannot stall if the tab is throttled, and it needs no exit state. */}
      <style>{`
        @keyframes dwFade  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dwSlide { from { transform: translateX(-100%) } to { transform: none } }
        @media (prefers-reduced-motion: reduce) {
          .dw-panel, .dw-veil { animation: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-[60]" dir="rtl">
        <div
          onClick={onClose}
          className="dw-veil absolute inset-0 bg-[rgb(var(--c-primary-900)/0.62)] backdrop-blur-[3px]"
          style={{ animation: 'dwFade .18s ease-out both' }}
        />

        {/* Pinned to the left edge outright rather than pushed there by an auto
            margin: in a right-to-left flex row the auto margin left the panel a
            full width off-screen. */}
        <aside
          className="dw-panel absolute inset-y-0 left-0 bg-canvas flex flex-col
                     rounded-s-[18px] overflow-hidden shadow-[0_0_40px_-8px_rgb(0_0_0/0.45)]"
          style={{ width: `min(${width}px, 100%)`, animation: 'dwSlide .26s cubic-bezier(.2,.8,.2,1) both' }}
          onClick={e => e.stopPropagation()}
        >
            {/* ── Hero ── */}
            <header className="relative px-5 sm:px-6 pt-6 pb-5 flex-shrink-0"
              style={{ background: 'linear-gradient(180deg, rgb(var(--c-primary)) 0%, rgb(var(--c-primary-700)) 100%)' }}>
              <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${onDark(accent)}, transparent)` }} />

              <div className="relative flex items-start gap-3.5">
                {Icon && (
                  <span className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/12"
                    style={{ background: 'rgb(255 255 255 / 0.06)' }}>
                    <Icon size={21} weight="duotone" style={{ color: onDark(accent) }} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {kicker && (
                    <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: onDark(accent) }}>{kicker}</p>
                  )}
                  <h2 className="text-[21px] font-extrabold text-white mt-1 leading-tight">{title}</h2>
                  {subtitle && <p className="text-[12px] font-medium text-white/55 mt-1">{subtitle}</p>}
                </div>
                <button onClick={onClose} aria-label="إغلاق"
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 text-white/70 border border-white/15 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={16} weight="bold" />
                </button>
              </div>

              {chips && <div className="relative flex items-center gap-1.5 flex-wrap mt-3.5">{chips}</div>}
            </header>

            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-3">{children}</div>

            {footer && (
              <footer className="flex-shrink-0 px-4 sm:px-5 py-3 bg-white border-t border-line flex items-center gap-2 flex-wrap">
                {footer}
              </footer>
            )}
        </aside>
      </div>
    </>
  );
}

/* ── Pieces the drawer's contents are built from ────────────
   Exported together so both the reports screen and the logistics screen open
   into the same shapes; a record should not look like a different kind of
   object depending on which list it came from. */

export function Section({ title, Icon, right, children, tone = 'rgb(var(--c-accent))' }) {
  return (
    <Panel Icon={Icon} color={tone} title={title} right={right}>
      <div className="p-3.5 sm:p-4">{children}</div>
    </Panel>
  );
}

export function Facts({ items }) {
  const live = items.filter(i => i && i.value);
  if (!live.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-2">
      {live.map((f, i) => (
        <div
          key={i}
          className={`rounded-[11px] border border-line bg-[rgb(var(--c-bg))] px-3 py-2.5 ${f.wide ? 'col-span-2' : ''}`}
        >
          <dt className="text-[10.5px] font-semibold text-muted flex items-center gap-1.5">
            {f.Icon && <f.Icon size={12} weight="bold" style={{ color: f.color || 'rgb(var(--c-muted))' }} />}
            {f.label}
          </dt>
          <dd className="text-[12.5px] font-bold text-ink mt-1 truncate" title={String(f.value)}>
            {f.href
              ? <a href={f.href} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline">{f.value}</a>
              : f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* A chip for the navy hero: light enough to read on it, quiet enough not to
   compete with the title. Solid chips carry a lightened fill so dark text sits
   on them whatever colour the record brought. */
export function HeroChip({ children, color, solid }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-[3px] rounded-md border leading-none whitespace-nowrap"
      style={solid
        ? { background: onDark(color), borderColor: 'transparent', color: 'rgb(var(--c-primary-900))' }
        : { background: 'rgb(255 255 255 / 0.12)', borderColor: 'rgb(255 255 255 / 0.15)', color: color ? onDark(color) : '#fff' }}>
      {children}
    </span>
  );
}
