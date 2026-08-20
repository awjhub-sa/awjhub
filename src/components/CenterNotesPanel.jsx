import {
  Note as StickyNote,
} from '@phosphor-icons/react';
import { getCenterNotes } from '../config/centerNotes.js';

/**
 * Renders operations-room notes for a given center.
 *
 * @param {Object} props
 * @param {string} props.centerId  - e.g. 'مركز 84'
 * @param {'modal'|'card'|'compact'} [props.variant='card']
 */
export default function CenterNotesPanel({ centerId, variant = 'card' }) {
  const notes = getCenterNotes(centerId);
  if (notes.length === 0) return null;

  if (variant === 'compact') {
    /* Single-line summary chip — used inline in list rows */
    return (
      <div className="mt-1.5 inline-flex items-start gap-1.5 text-[10.5px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 max-w-full">
        <StickyNote size={11} weight="bold" className="text-amber-600 shrink-0 mt-[1px]" />
        <span className="leading-snug">
          {notes.length === 1
            ? notes[0]
            : (
              <>
                <span className="font-black">{notes.length} ملاحظات</span> · {notes.join(' · ')}
              </>
            )}
        </span>
      </div>
    );
  }

  const wrapClass = variant === 'modal'
    ? 'rounded-2xl p-3.5'
    : 'rounded-xl p-3';

  return (
    <div className={`bg-gradient-to-br from-amber-50 via-amber-50/70 to-orange-50/40 border-2 border-amber-200 ${wrapClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
          <StickyNote size={13} weight="bold" className="text-white" />
        </div>
        <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider">
          ملاحظات غرفة العمليات للمركز
        </p>
        {notes.length > 1 && (
          <span className="text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md bg-amber-200/60 text-amber-900">
            {notes.length}
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {notes.map((n, i) => (
          <li key={i}
            className="flex items-start gap-2 text-[12px] font-bold text-amber-900 bg-white/60 border border-amber-200/60 rounded-lg px-2.5 py-1.5">
            <span className="w-1 h-1 rounded-full bg-amber-600 mt-[7px] shrink-0" />
            <span className="leading-snug">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
