/**
 * src/lib/sectionAlerts.js
 *
 * What is waiting for the office, section by section.
 *
 * The sidebar carried one badge, hard-wired to البلاغات. Everything else that
 * arrives — a form filed, a violation answered, a readiness sheet uploaded by
 * an observer at three in the morning — arrived silently, and was found only
 * by someone who thought to go looking. A count on the door is the difference
 * between a system that reports to you and one you have to interrogate.
 *
 * Two kinds of count, because two kinds of thing are being counted:
 *
 *   backlog — items that are genuinely waiting on the office to act (a report
 *             still open, a form submitted and unreviewed). Opening the
 *             section does not make the work go away, so the number stays.
 *
 *   new     — items that simply arrived (a readiness sheet, a meal check).
 *             Nobody has to «clear» an upload; what matters is whether you
 *             have seen it. Opening the section zeroes it.
 *
 * `fresh` is orthogonal and applies to both: something here landed since you
 * last opened this section. It drives the colour, not the number — so a
 * standing backlog of four does not shout every time you glance at the
 * sidebar, but a fifth one arriving does.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from './db.js';

/* Postgres hands back ISO strings. Code elsewhere in this app called
   `.toMillis()` on them — a Firestore method — so every row scored 0 and
   nothing was ever new. Accept all three shapes and stop repeating it. */
export function ms(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}
export const rowTime = (r) =>
  ms(r?.submittedAt) || ms(r?.timestamp) || ms(r?.createdAt) || ms(r?.updatedAt) || 0;

/* ── When each section was last opened ──────────────────────
   Per path, in localStorage: a badge that resets on every reload is a badge
   nobody trusts. */
const SEEN_KEY = (path) => `nsab:seen:${path}`;
export function seenAt(path) {
  const v = Number(localStorage.getItem(SEEN_KEY(path)) || 0);
  if (v) return v;
  /* Never opened: start the clock now rather than counting the whole season as
     unread. A badge that opens at 99+ on a fresh browser teaches people to
     ignore it, which is the one thing a badge must not do. */
  const now = Date.now();
  localStorage.setItem(SEEN_KEY(path), String(now));
  return now;
}
export function markSeen(path) {
  localStorage.setItem(SEEN_KEY(path), String(Date.now()));
}

/* ── The tables each section answers for ────────────────────
   `awaiting` decides what counts as backlog; sections without one are
   arrival-counted instead. */
const WATCH = [
  { path: '/admin/reports',   table: 'reports',
    awaiting: (r) => (r.status || 'pending') === 'pending' },
  { path: '/admin/logistics', table: 'logistics_requests',
    awaiting: (r) => (r.status || 'pending') === 'pending' },

  /* Uploads from the field. Nothing to «resolve» — only to have seen. */
  { path: '/admin/readiness/mina',   table: 'mina_readiness' },
  { path: '/admin/readiness/arafat', table: 'arafat_readiness' },
  { path: '/admin/phases',           table: 'meal_evaluations' },
];

/* Both live on one table and are told apart by their template, so they are
   counted together and split afterwards. */
const ASSIGNMENT_PATHS = { forms: '/admin/forms', violations: '/admin/violations' };

/* The field tables already stream over realtime — the bell has subscribed to
   them since before this file existed. Assignments are the new arrival and may
   not be in the publication yet, so they alone get a floor. Polling the others
   would mean re-listing every meal check of the season once a minute to learn
   a number. */
const POLL_MS = 60_000;

export function useSectionAlerts() {
  const [rows, setRows] = useState({});          // table → array
  const [assignments, setAssignments] = useState([]);
  const [violationIds, setViolationIds] = useState(() => new Set());
  const [seenTick, setSeenTick] = useState(0);   // bump to re-read localStorage
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /* Which templates are notices rather than requests. Two columns, once. */
  useEffect(() => {
    db.form_templates.list({ columns: ['id', 'category'] })
      .then(ts => { if (alive.current) setViolationIds(new Set(ts.filter(t => t.category === 'مخالفات').map(t => t.id))); })
      .catch(() => { /* a badge must never take a screen down */ });
  }, []);

  useEffect(() => {
    const put = (table) => (list) => { if (alive.current) setRows(p => ({ ...p, [table]: list })); };
    const unsubs = WATCH.map(w => db[w.table].subscribe(put(w.table)));

    const loadAssignments = () => db.form_assignments
      .list({ columns: ['id', 'status', 'templateId', 'submittedAt', 'createdAt'] })
      .then(a => { if (alive.current) setAssignments(a); })
      .catch(() => {});
    loadAssignments();
    const unsubA = db.form_assignments.subscribe(a => { if (alive.current) setAssignments(a); },
      { columns: ['id', 'status', 'templateId', 'submittedAt', 'createdAt'] });

    const poll = setInterval(loadAssignments, POLL_MS);

    return () => { unsubs.forEach(u => u?.()); unsubA?.(); clearInterval(poll); };
  }, []);

  const alerts = useMemo(() => {
    void seenTick;
    const out = {};

    const tally = (path, items, awaiting) => {
      const since = seenAt(path);
      const pool = awaiting ? items.filter(awaiting) : items.filter(r => rowTime(r) > since);
      if (!pool.length) return;
      out[path] = {
        n: pool.length,
        fresh: pool.some(r => rowTime(r) > since),
        kind: awaiting ? 'backlog' : 'new',
      };
    };

    for (const w of WATCH) tally(w.path, rows[w.table] || [], w.awaiting);

    /* A filing the caterer has sent and nobody has ruled on yet. */
    const submitted = assignments.filter(a => a.status === 'submitted');
    tally(ASSIGNMENT_PATHS.forms,
      submitted.filter(a => !violationIds.has(a.templateId)), () => true);
    tally(ASSIGNMENT_PATHS.violations,
      submitted.filter(a => violationIds.has(a.templateId)), () => true);

    return out;
  }, [rows, assignments, violationIds, seenTick]);

  const see = useCallback((path) => {
    if (!path) return;
    markSeen(path);
    setSeenTick(t => t + 1);
  }, []);

  return { alerts, see };
}

/* The sum a collapsed group carries, so «إدارة المتعهدين» shows that something
   inside it is waiting without being opened first. */
export function groupAlert(alerts, children) {
  let n = 0, fresh = false, owed = false;
  for (const c of children) {
    const a = alerts[c.to];
    if (!a) continue;
    n += a.n;
    fresh = fresh || a.fresh;
    owed  = owed  || a.kind !== 'new';
  }
  /* Red only if something inside genuinely waits on the office. */
  return n ? { n, fresh, kind: owed ? 'backlog' : 'new' } : null;
}
