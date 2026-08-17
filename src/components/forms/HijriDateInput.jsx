/**
 * src/components/forms/HijriDateInput.jsx
 *
 * Picks a Hijri date from dropdowns and stores an ISO Gregorian one.
 *
 * Storing Gregorian is what keeps the data sortable, comparable and unambiguous
 * in the database; showing Hijri is what matches the paperwork. A Hajj deadline
 * is written 1447/11/15, and asking an admin to convert it before picking is
 * both friction and a source of off-by-one errors.
 *
 * Month lengths come from the Umm al-Qura tables via a round-trip rather than
 * from arithmetic — Hijri months are 29 or 30 days by observation, not by rule,
 * so the day list is rebuilt for whichever month is selected.
 */

import { useMemo } from 'react';
import {
  HIJRI_MONTHS, toHijriParts, fromHijriParts, hijriMonthLength,
} from '../../lib/hijri.js';

const selCls =
  'px-2 py-1 border border-line rounded-lg text-sm text-ink outline-none focus:border-primary transition bg-white';

export default function HijriDateInput({ value, onChange, error }) {
  const parts = useMemo(() => {
    if (!value) return null;
    const d = new Date(`${value}T12:00:00`);
    return isNaN(d) ? null : toHijriParts(d);
  }, [value]);

  const nowY = useMemo(() => toHijriParts(new Date()).y, []);
  const years = useMemo(
    () => Array.from({ length: 7 }, (_, i) => nowY - 1 + i),
    [nowY],
  );

  const y = parts?.y ?? nowY;
  const m = parts?.m ?? 1;
  const dayCount = useMemo(() => hijriMonthLength(y, m), [y, m]);

  const set = (ny, nm, nd) => {
    /* Clamp before converting: moving from a 30-day month to a 29-day one with
       the 30th selected would otherwise produce a date that does not exist. */
    const len = hijriMonthLength(ny, nm);
    const day = Math.min(nd, len);
    const g = fromHijriParts(ny, nm, day);
    onChange(g ? g.toISOString().slice(0, 10) : '');
  };

  return (
    <span className="inline-flex flex-col gap-1 align-middle">
      <span className="inline-flex items-center gap-1">
        <select
          value={parts ? m : ''}
          onChange={e => set(y, Number(e.target.value), parts?.d ?? 1)}
          className={`${selCls} ${error ? 'border-red-400' : ''}`}
        >
          <option value="" disabled>الشهر</option>
          {HIJRI_MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>{name}</option>
          ))}
        </select>

        <select
          value={parts ? parts.d : ''}
          onChange={e => set(y, m, Number(e.target.value))}
          className={`${selCls} ${error ? 'border-red-400' : ''}`}
        >
          <option value="" disabled>اليوم</option>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={parts ? y : ''}
          onChange={e => set(Number(e.target.value), m, parts?.d ?? 1)}
          className={`${selCls} ${error ? 'border-red-400' : ''}`}
        >
          <option value="" disabled>السنة</option>
          {years.map(yy => <option key={yy} value={yy}>{yy}هـ</option>)}
        </select>
      </span>

      {/* The Gregorian equivalent, so a date agreed with a supplier or a
          government portal can be checked without a second tool. */}
      {value && (
        <span className="text-[10px] text-muted" dir="ltr">{value}</span>
      )}
    </span>
  );
}
