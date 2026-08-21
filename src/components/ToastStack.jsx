/**
 * src/components/ToastStack.jsx
 *
 * Where the app answers back. Mounted once per portal; every action anywhere
 * inside it reports here.
 *
 * Stacked from the bottom so the newest is nearest the thumb, capped at four
 * so a burst of uploads cannot bury the screen, and each carries the colour of
 * its own kind — the same four tones the sections use, so a green strip here
 * and a green chip in a table mean the same thing.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { subscribeToasts } from '../lib/toast.js';
import { IconTile } from './ui/index.jsx';
import {
  CheckCircle, Info, WarningCircle, XCircle, X,
} from '@phosphor-icons/react';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

/* One colour per kind; the surface is derived from it, never picked. */
const KIND = {
  ok:   { Icon: CheckCircle,   color: '#15803D' },
  info: { Icon: Info,          color: 'rgb(var(--c-info))' },
  warn: { Icon: WarningCircle, color: '#B45309' },
  fail: { Icon: XCircle,       color: '#BE123C' },
};

const TTL = 5200;
const MAX = 4;

export default function ToastStack() {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  useEffect(() => {
    const drop = (id) => {
      setItems(list => list.filter(t => t.id !== id));
      const h = timers.current.get(id);
      if (h) { clearTimeout(h); timers.current.delete(id); }
    };
    const off = subscribeToasts((t) => {
      setItems(list => [...list, t].slice(-MAX));
      timers.current.set(t.id, setTimeout(() => drop(t.id), TTL));
    });
    const held = timers.current;
    return () => { off(); held.forEach(clearTimeout); held.clear(); };
  }, []);

  const dismiss = (id) => setItems(list => list.filter(t => t.id !== id));

  return (
    <div dir="rtl"
      className="fixed bottom-5 end-5 z-[200] flex flex-col gap-2 pointer-events-none w-[min(92vw,360px)]">
      <AnimatePresence initial={false}>
        {items.map(t => {
          const k = KIND[t.kind] || KIND.info;
          return (
            <motion.div key={t.id}
              initial={{ opacity: 0, x: -24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="relative pointer-events-auto rounded-[14px] border overflow-hidden
                         shadow-[0_8px_28px_-8px_rgb(var(--c-ink)/0.28)]"
              style={{ background: tint(k.color, 12), borderColor: tint(k.color, 28) }}>
              <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: k.color }} />
              <div className="flex items-start gap-3 ps-4 pe-3.5 py-3">
                <IconTile Icon={k.Icon} color={k.color} size="sm" className="mt-px" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-snug" style={{ color: k.color }}>{t.title}</p>
                  {t.detail && (
                    <p className="text-[11.5px] font-medium text-muted mt-1 leading-relaxed">
                      {t.detail}
                    </p>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="إغلاق"
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-muted
                             hover:bg-white/70 hover:text-ink transition-colors">
                  <X size={13} weight="bold" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
