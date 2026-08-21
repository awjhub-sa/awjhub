/**
 * src/components/CommandPalette.jsx
 *
 * Ctrl K — go anywhere by typing.
 *
 * Twenty-three sections is past the point where a menu is the fastest way to a
 * known destination. Someone who has used the system for a week knows they want
 * the caterers; making them find the group, open it and aim at the third row is
 * three interactions to answer a question they had already answered.
 *
 * It searches records as well as sections, because "مركز ٦٥" is the way an
 * operations manager thinks about where they are going, not "المراكز".
 *
 * Matching strips Arabic diacritics and normalises alef and taa marbuta, so
 * "متعهدين" finds "المتعهدين" and a hurried "مراكب" does not fail on a hamza.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, ArrowElbowDownLeft } from '@phosphor-icons/react';
import { IconTile, Pill } from './ui/index.jsx';
import { db } from '../lib/db.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const NAVY = 'rgb(var(--c-primary))';

/* A result's colour says which register it came from before the label is read. */
const KIND_COLOR = {
  'قسم':   NAVY,
  'مركز':  'rgb(var(--c-info))',
  'متعهد': 'rgb(var(--c-accent-600))',
};

const norm = (v) => String(v ?? '')
  .replace(/[ً-ْ]/g, '')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export default function CommandPalette({ sections }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [records, setRecords] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Records are fetched the first time the palette is opened, not at boot: a
     keyboard shortcut nobody has pressed yet should cost nothing. */
  useEffect(() => {
    if (!open || records.length) return;
    (async () => {
      try {
        const [centers, caterers] = await Promise.all([db.centers.list(), db.caterers.list()]);
        setRecords([
          ...centers.map(c => ({
            label: c.code,
            hint: c.catererName || 'مركز',
            to: '/admin/centers',
            kind: 'مركز',
          })),
          ...caterers.map(c => ({
            label: c.name,
            hint: 'متعهد',
            to: '/admin/caterers',
            kind: 'متعهد',
          })),
        ]);
      } catch { /* the sections alone are still worth having */ }
    })();
  }, [open, records.length]);

  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);

  const results = useMemo(() => {
    const needle = norm(q);
    const all = [
      ...sections.map(s => ({ ...s, kind: 'قسم' })),
      ...records,
    ];
    if (!needle) return sections.slice(0, 8).map(s => ({ ...s, kind: 'قسم' }));
    return all
      .filter(r => norm(r.label).includes(needle) || norm(r.hint).includes(needle))
      /* Sections first: a word that names both a section and a record almost
         always means the section. */
      .sort((a, b) => (a.kind === 'قسم' ? -1 : 1) - (b.kind === 'قسم' ? -1 : 1))
      .slice(0, 10);
  }, [q, sections, records]);

  useEffect(() => { setI(0); }, [q]);

  if (!open) return null;

  const go = (r) => { if (!r) return; setOpen(false); nav(r.to); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(x + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(x - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[i]); }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-[12vh] px-4" dir="rtl">
      <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-label="إغلاق" />
      <div className="relative w-full max-w-lg bg-white rounded-[18px] overflow-hidden border border-line
                      shadow-[0_0_40px_-8px_rgb(0_0_0/0.45)]">
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}
        >
          <IconTile Icon={MagnifyingGlass} color={NAVY} size="sm" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="اذهب إلى قسم، أو ابحث عن مركز أو متعهد…"
            className="flex-1 min-w-0 text-[13.5px] font-bold text-ink bg-transparent focus:outline-none placeholder-muted/60 placeholder:font-medium"
          />
          <kbd className="text-[10px] font-bold text-muted bg-white border border-line rounded-md px-1.5 py-0.5 shrink-0">ESC</kbd>
        </div>

        <div className="max-h-[46vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="text-[12.5px] font-semibold text-muted text-center py-10">لا نتائج لـ «{q}»</p>
          ) : results.map((r, idx) => {
            const color = KIND_COLOR[r.kind] || 'rgb(var(--c-muted))';
            const on = idx === i;
            return (
              <button
                key={`${r.kind}-${r.to}-${r.label}-${idx}`}
                onMouseEnter={() => setI(idx)}
                onClick={() => go(r)}
                className={`relative w-full flex items-center gap-3 ps-5 pe-4 py-2.5 text-start transition-colors ${
                  on ? 'bg-[rgb(var(--c-primary)/0.06)]' : 'hover:bg-[rgb(var(--c-bg))]'
                }`}
              >
                {on && <span aria-hidden className="absolute inset-y-0 start-0 w-[3px]" style={{ background: color }} />}
                <Pill color={color} className="shrink-0">{r.kind}</Pill>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-ink truncate">{r.label}</span>
                  {r.hint && <span className="block text-[11px] font-medium text-muted truncate mt-0.5">{r.hint}</span>}
                </span>
                {on && <ArrowElbowDownLeft size={13} weight="bold" className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-line bg-[rgb(var(--c-bg))] text-[10.5px] font-semibold text-muted">
          <span>↑↓ للتنقل</span>
          <span>Enter للفتح</span>
          <span className="ms-auto font-bold text-ink/70">Ctrl K</span>
        </div>
      </div>
    </div>
  );
}
