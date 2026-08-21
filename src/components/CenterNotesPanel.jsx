import {
  Note as StickyNote,
} from '@phosphor-icons/react';
import { getCenterNotes } from '../config/centerNotes.js';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;
const NOTE = '#B45309';

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
      <div className="mt-1.5 inline-flex items-start gap-1.5 text-[10.5px] font-semibold rounded-[10px] border px-2 py-1 max-w-full"
        style={{ background: tint(NOTE, 12), borderColor: tint(NOTE, 28), color: NOTE }}>
        <StickyNote size={11} weight="bold" className="shrink-0 mt-[1px]" />
        <span className="leading-snug">
          {notes.length === 1
            ? notes[0]
            : (
              <>
                <span className="font-bold">{notes.length} ملاحظات</span> · {notes.join(' · ')}
              </>
            )}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-[14px] border ${variant === 'modal' ? 'p-3.5' : 'p-3'}`}
      style={{ background: tint(NOTE, 12), borderColor: tint(NOTE, 28) }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-[10px] flex items-center justify-center border shrink-0"
          style={{ background: tint(NOTE, 9), borderColor: tint(NOTE, 22) }}>
          <StickyNote size={14} weight="duotone" style={{ color: NOTE }} />
        </span>
        <p className="text-[11.5px] font-bold" style={{ color: NOTE }}>
          ملاحظات غرفة العمليات للمركز
        </p>
        {notes.length > 1 && (
          <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md border"
            style={{ background: tint(NOTE, 9), borderColor: tint(NOTE, 22), color: NOTE }}>
            {notes.length}
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {notes.map((n, i) => (
          <li key={i}
            className="flex items-start gap-2 text-[12px] font-semibold bg-white rounded-[10px] border px-2.5 py-1.5"
            style={{ borderColor: tint(NOTE, 28), color: NOTE }}>
            <span className="w-1 h-1 rounded-full mt-[7px] shrink-0" style={{ background: NOTE }} />
            <span className="leading-snug">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
