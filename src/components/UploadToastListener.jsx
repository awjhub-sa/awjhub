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
import { ShieldCheck, Mountain, X, User, Building2 } from 'lucide-react';
import { db } from '../lib/db.js';

const SITE_META = {
  mina:   { label: 'مشعر منى',  Icon: ShieldCheck, color: '#386B41', gradient: 'linear-gradient(135deg, #4F8856, #386B41)' },
  arafat: { label: 'مشعر عرفة', Icon: Mountain,    color: '#1D6FA4', gradient: 'linear-gradient(135deg, #2D87C2, #1D6FA4)' },
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
    <div className="fixed top-20 left-4 z-[200] flex flex-col gap-2 max-w-sm pointer-events-none" dir="rtl">
      {toasts.map(t => (
        <ToastCard key={t.id} site={t.site} doc={t.doc} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ site, doc, onClose }) {
  const meta = SITE_META[site];
  const Icon = meta.Icon;
  return (
    <div
      className="pointer-events-auto bg-white rounded-2xl border-2 shadow-[0_12px_32px_rgba(45,41,38,0.18)] p-3.5 flex items-center gap-3 animate-in slide-in-from-left-4 fade-in duration-300"
      style={{ borderColor: meta.color }}>
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-2xl blur-md opacity-50" style={{ background: meta.color }} />
        <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
          style={{ background: meta.gradient }}>
          <Icon size={22} className="text-white" strokeWidth={2.25} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: meta.color }}>
          تقييم جاهزية جديد
        </p>
        <div className="flex items-center gap-1.5 mb-0.5">
          <Building2 size={11} className="text-[#A98159] shrink-0" strokeWidth={2.5} />
          <p className="text-sm font-black text-[#2D2926] truncate">{doc.center || '—'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <User size={10} className="text-[#9D8F85] shrink-0" strokeWidth={2.5} />
          <p className="text-[11px] text-[#6D6E71] font-bold truncate">
            {meta.label} · {doc.observer || (doc.role === 'supervisor' ? 'مشرف' : 'مراقب')}
          </p>
        </div>
      </div>
      <button onClick={onClose}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F5F0EB] transition-colors shrink-0"
        title="إغلاق">
        <X size={14} className="text-[#9D8F85]" strokeWidth={2.25} />
      </button>
    </div>
  );
}

function docTime(d) {
  return d?.timestamp?.toMillis?.()
    ?? (d?.timestamp ? new Date(d.timestamp).getTime() : 0);
}
