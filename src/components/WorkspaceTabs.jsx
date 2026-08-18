/**
 * src/components/WorkspaceTabs.jsx
 *
 * The strip of open sections, above the content.
 *
 * It exists so that being interrupted is cheap. Checking a caterer's licence
 * in the middle of reading a report should not cost the report — the tab is
 * still there when you turn back.
 *
 * The current route joins the strip on its own; nothing has to be clicked to
 * "open" anything. A tab is closed with the ×, pinned from the right-click
 * menu, and pinned tabs survive the eviction that keeps the strip from growing
 * past what a person can scan.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, PushPin, PushPinSlash, Prohibit } from '@phosphor-icons/react';
import {
  subscribe, getTabs, getPins, openTab, closeTab, closeOthers, togglePin,
} from '../lib/workspace.js';

export default function WorkspaceTabs({ labelFor }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const tabs = useSyncExternalStore(subscribe, getTabs);
  const pins = useSyncExternalStore(subscribe, getPins);
  const [menu, setMenu] = useState(null);   // { to, x, y }

  /* Visiting a section is what opens its tab — there is no separate gesture,
     because a gesture nobody discovers is a feature nobody has. */
  useEffect(() => {
    const label = labelFor(pathname);
    if (label) openTab(pathname, label);
  }, [pathname, labelFor]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', close); };
  }, [menu]);

  if (tabs.length <= 1) return null;   // one tab is not a strip, it is a title

  const onClose = (e, to) => {
    e.stopPropagation();
    const next = closeTab(to, pathname);
    if (next) nav(next);
  };

  return (
    <div className="flex items-stretch gap-0.5 bg-white border-b border-line px-2 overflow-x-auto no-scrollbar flex-shrink-0"
         dir="rtl">
      {tabs.map(t => {
        const on = t.to === pathname;
        const pinned = pins.includes(t.to);
        return (
          <button
            key={t.to}
            onClick={() => nav(t.to)}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ to: t.to, x: e.clientX, y: e.clientY }); }}
            className={`group relative flex items-center gap-1.5 px-3 py-2 text-[11.5px] font-bold whitespace-nowrap
                        border-b-2 transition-colors ${
              on ? 'border-accent text-primary bg-primary/[0.04]'
                 : 'border-transparent text-muted hover:text-ink hover:bg-background'
            }`}
          >
            {pinned && <PushPin size={10} weight="fill" className="text-accent-600 flex-shrink-0" />}
            <span>{t.label}</span>
            {/* A pinned tab keeps its × — pinning survives eviction, it does
                not take away the ability to close something deliberately. */}
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => onClose(e, t.to)}
              className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0
                          hover:bg-ink/10 ${on ? 'opacity-60' : 'opacity-0 group-hover:opacity-60'}`}
            >
              <X size={9} weight="bold" />
            </span>
          </button>
        );
      })}

      {menu && (
        <div
          className="fixed z-[90] bg-white border border-line rounded-xl shadow-[0_10px_34px_rgb(var(--c-ink)/0.22)] py-1 min-w-[168px]"
          style={{ top: menu.y, insetInlineStart: `calc(100vw - ${menu.x}px)` }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            Icon={pins.includes(menu.to) ? PushPinSlash : PushPin}
            label={pins.includes(menu.to) ? 'إلغاء التثبيت' : 'تثبيت'}
            onClick={() => { togglePin(menu.to); setMenu(null); }}
          />
          <MenuItem
            Icon={Prohibit}
            label="إغلاق البقية"
            onClick={() => { closeOthers(menu.to); nav(menu.to); setMenu(null); }}
          />
          <MenuItem
            Icon={X}
            label="إغلاق"
            onClick={() => {
              const next = closeTab(menu.to, pathname);
              if (next) nav(next);
              setMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

const MenuItem = ({ Icon, label, onClick }) => (
  <button onClick={onClick}
    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-background text-right">
    <Icon size={12} weight="bold" className="text-muted" />
    {label}
  </button>
);
