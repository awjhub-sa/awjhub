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
import {
  CheckCircle, Info, WarningCircle, XCircle, X,
} from '@phosphor-icons/react';

const KIND = {
  ok:   { Icon: CheckCircle,    ink: '#047857', bg: '#ECFDF5', line: '#6EE7B7', bar: 'linear-gradient(90deg,#10B981,#059669)' },
  info: { Icon: Info,           ink: '#1D4ED8', bg: '#EFF6FF', line: '#93C5FD', bar: 'linear-gradient(90deg,#3B82F6,#2563EB)' },
  warn: { Icon: WarningCircle,  ink: '#B45309', bg: '#FFFBEB', line: '#FCD34D', bar: 'linear-gradient(90deg,#F59E0B,#D97706)' },
  fail: { Icon: XCircle,        ink: '#BE123C', bg: '#FFF1F2', line: '#FDA4AF', bar: 'linear-gradient(90deg,#F43F5E,#E11D48)' },
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
      className="fixed bottom-5 left-5 z-[200] flex flex-col gap-2 pointer-events-none w-[min(92vw,360px)]">
      <AnimatePresence initial={false}>
        {items.map(t => {
          const k = KIND[t.kind] || KIND.info;
          return (
            <motion.div key={t.id}
              initial={{ opacity: 0, x: -24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto rounded-2xl border overflow-hidden shadow-[0_10px_30px_rgb(0,0,0,0.12)]"
              style={{ background: k.bg, borderColor: k.line }}>
              <div className="h-1" style={{ background: k.bar }} />
              <div className="flex items-start gap-2.5 px-3.5 py-3">
                <k.Icon size={18} weight="fill" style={{ color: k.ink }} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-black leading-snug" style={{ color: k.ink }}>{t.title}</p>
                  {t.detail && (
                    <p className="text-[12px] font-bold mt-0.5 leading-relaxed opacity-80" style={{ color: k.ink }}>
                      {t.detail}
                    </p>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="إغلاق"
                  className="opacity-45 hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ color: k.ink }}>
                  <X size={14} weight="bold" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
