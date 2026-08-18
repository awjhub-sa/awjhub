/**
 * src/lib/printPage.js
 *
 * Gives one printable route the paper it asked for.
 *
 * `@page` is a document-level rule: it takes no selector and cannot be scoped
 * to a component. Vite bundles every imported stylesheet into one document, so
 * four routes each declaring their own `@page` in CSS produced four rules in
 * one file — and the last one parsed won everywhere. The slide deck's
 * 297×167mm was therefore the paper size for the report document and for a
 * caterer's form as well, which is why an A4 form printed as something else.
 *
 * The rule is injected instead, by whichever printable route is mounted, and
 * removed when it leaves. Only one such route is ever mounted at a time — they
 * each take the whole window — so exactly one `@page` is ever in force.
 */

import { useEffect } from 'react';

const TAG_ID = 'nsab-print-page-rule';

/**
 * @param {string} size    e.g. 'A4 portrait' or '297mm 167mm'
 * @param {string} margin  e.g. '14mm'
 */
export function usePrintPage(size, margin) {
  useEffect(() => {
    /* Replaced rather than appended: two of these would put us back where we
       started, with the later one silently winning. */
    document.getElementById(TAG_ID)?.remove();

    const el = document.createElement('style');
    el.id = TAG_ID;
    el.textContent = `@page { size: ${size}; margin: ${margin}; }`;
    document.head.appendChild(el);

    return () => el.remove();
  }, [size, margin]);
}
