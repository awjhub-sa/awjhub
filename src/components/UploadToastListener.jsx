/**
 * UploadToastListener.jsx
 *
 * Listens to mina_readiness and arafat_readiness via Supabase Realtime and
 * pops a non-blocking toast whenever a NEW evaluation is submitted by a
 * supervisor/observer. Mounted once inside AdminLayout so the toast appears
 * across all admin pages without needing to be on AdminAnalytics.
 *
 * First subscribe payload after page load is treated as "already seen" —
 * only docs that arrive afterwards trigger toasts. Toasts auto-dismiss
 * after ~8 seconds and can be closed manually.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  Mountains as Mountain,
  X,
  User,
  Buildings as Building2,
} from '@phosphor-icons/react';
import { IconTile } from './ui/index.jsx';
import { db } from '../lib/db.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const SITE_META = {
  mina:   { label: 'مشعر منى',  Icon: ShieldCheck, color: 'rgb(var(--c-success))' },
  arafat: { label: 'مشعر عرفة', Icon: Mountain,    color: '#2F5580' },
};

const TOAST_TTL_MS = 8000;

export default function UploadToastListener() {
  const [toasts, setToasts] = useState([]);
  /* Tracks IDs already seen per source. `null` until the first subscribe
     callback — that first batch is treated as "existing data" and ignored. */
  const seenIds = useRef({ mina: null, arafat: null });

  useEffect(() => {
    const handleBatch = (site) => (rows) => {
      const incoming = new Set(rows.map(r => r.id));
      if (seenIds.current[site] === null) {
        /* First load — record and exit without firing toasts */
        seenIds.current[site] = incoming;
        return;
      }
      const newDocs = rows.filter(r => !seenIds.current[site].has(r.id));
      seenIds.current[site] = incoming;
      if (newDocs.length === 0) return;
      /* Surface most recent first */
      newDocs
        .sort((a, b) => docTime(b) - docTime(a))
        .forEach(d => pushToast(site, d));
    };

    const u1 = db.mina_readiness.subscribe(handleBatch('mina'));
    const u2 = db.arafat_readiness.subscribe(handleBatch('arafat'));
    return () => { u1?.(); u2?.(); };
  }, []);

  const pushToast = (site, doc) => {
    const id = `${site}-${doc.id}-${Date.now()}`;
    setToasts(prev => [...prev, { id, site, doc }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_TTL_MS);
  };

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 end-4 z-[200] flex flex-col gap-2 max-w-sm pointer-events-none" dir="rtl">
      {toasts.map(t => (
        <ToastCard key={t.id} site={t.site} doc={t.doc} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ site, doc, onClose }) {
  const meta = SITE_META[site];
  return (
    <div
      className="relative pointer-events-auto rounded-[14px] border overflow-hidden
                 shadow-[0_8px_28px_-8px_rgb(var(--c-ink)/0.28)]
                 ps-4 pe-3 py-3 flex items-center gap-3
                 animate-in slide-in-from-left-4 fade-in duration-300"
      style={{ background: tint(meta.color, 12), borderColor: tint(meta.color, 28) }}>
      <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: meta.color }} />
      <IconTile Icon={meta.Icon} color={meta.color} size="lg" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.color }}>
          تقييم جاهزية جديد
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <Building2 size={12} className="text-muted/60 shrink-0" weight="bold" />
          <p className="text-[13.5px] font-bold text-ink truncate">{doc.center || '—'}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <User size={11} className="text-muted/60 shrink-0" weight="bold" />
          <p className="text-[11.5px] text-muted font-medium truncate">
            {meta.label} · {doc.observer || (doc.role === 'supervisor' ? 'مشرف' : 'مراقب')}
          </p>
        </div>
      </div>
      <button onClick={onClose}
        className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:bg-white/70 hover:text-ink transition-colors shrink-0"
        title="إغلاق">
        <X size={13} weight="bold" />
      </button>
    </div>
  );
}

function docTime(d) {
  return d?.timestamp?.toMillis?.()
    ?? (d?.timestamp ? new Date(d.timestamp).getTime() : 0);
}
