/**
 * src/lib/toast.js
 *
 * One line of feedback for one action, anywhere in the app.
 *
 * The system already told people things, but only in the place they happened:
 * an amber strip inside the form, a message that vanished when the sheet was
 * closed. An action that changes a record — a notice issued, an answer filed,
 * something deleted — deserves to be announced where the person is looking,
 * and to survive leaving the screen that caused it.
 *
 * Deliberately not a store: a toast has no state worth persisting. Subscribers
 * receive it, show it, and forget it.
 */

const listeners = new Set();
let seq = 0;

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const emit = (kind) => (title, detail) => {
  const t = { id: ++seq, kind, title, detail: detail || null };
  listeners.forEach(fn => { try { fn(t); } catch { /* a broken listener must not swallow the action */ } });
  return t.id;
};

export const toast = {
  ok:   emit('ok'),     // it happened
  info: emit('info'),   // it happened, and nothing is owed
  warn: emit('warn'),   // it happened, and something is owed
  fail: emit('fail'),   // it did not happen
};
