/**
 * src/components/DataTable.jsx
 *
 * A table that survives a phone.
 *
 * Every register in this system was a `<div className="overflow-x-auto">`
 * around a wide table. On a desktop that is correct. On a 390px screen it
 * means ten columns compressed into a sideways scroll nobody discovers, and
 * the columns that carry the decision — status, deadline, the buttons — are
 * the ones that fall off the edge.
 *
 * Below the breakpoint each row becomes a card and each cell becomes a
 * «label: value» line. The labels are not typed a second time: they are
 * lifted from the table's own `<th>` after render, so a column added to a
 * table is labelled on mobile the same day, and the two can never disagree.
 *
 * Kept as an effect over the real DOM rather than as a parallel card markup
 * because a second rendering of every register is a second thing to keep
 * correct, and it would drift within a week.
 */

import { useEffect, useRef } from 'react';

export default function DataTable({ children, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const table = ref.current?.querySelector('table');
    if (!table) return;
    const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    for (const tr of table.querySelectorAll('tbody tr')) {
      const cells = [...tr.children];
      /* A full-width row — an empty state, a note strip — is not a cell in a
         column and must not be given a column's name. */
      if (cells.length === 1 && cells[0].hasAttribute('colspan')) {
        cells[0].removeAttribute('data-th');
        continue;
      }
      cells.forEach((td, i) => {
        const label = heads[i];
        if (label) td.setAttribute('data-th', label);
        else td.removeAttribute('data-th');
      });
    }
  });   /* no dep array: rows change, and every new row needs its labels */

  return (
    <div ref={ref} className={`nsab-rt overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}
