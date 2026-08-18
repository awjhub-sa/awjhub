/**
 * src/lib/workspace.js
 *
 * Which sections are open, and which the user keeps close to hand.
 *
 * The system is a sidebar and a single content pane: opening the caterers to
 * check a licence loses the report you were reading, and getting back means
 * finding it again. That is the cost this file removes. A section you visit
 * becomes a tab; the tab stays until you close it; the sidebar keeps a pinned
 * group for the two or three you live in.
 *
 * Tabs are sections, not records — every screen in this system opens its
 * records in a drawer over the list rather than at a URL of their own, so
 * there is no per-record address to hang a tab on. Saying so plainly here
 * because "why can't I tab two reports" is the obvious next question.
 *
 * Kept outside React: the tab bar, the sidebar and the palette all read it,
 * and threading it through context would put a provider around a layout that
 * already nests four deep.
 */

const KEY_TABS = 'nsab.ws.tabs';
const KEY_PINS = 'nsab.ws.pins';
const MAX_TABS = 8;

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    const val = raw ? JSON.parse(raw) : null;
    return Array.isArray(val) ? val : fallback;
  } catch { return fallback; }
};
const write = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode */ }
};

let tabs = read(KEY_TABS, []);      // [{ to, label }]
let pins = read(KEY_PINS, []);      // [to]
const listeners = new Set();

const emit = () => {
  write(KEY_TABS, tabs);
  write(KEY_PINS, pins);
  listeners.forEach(fn => fn());
};

export const getTabs = () => tabs;
export const getPins = () => pins;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/**
 * Records a visit. Idempotent — revisiting a section already open just makes
 * it current rather than opening it twice.
 *
 * Oldest-first eviction past MAX_TABS, skipping pinned ones: a strip that grows
 * without bound stops being navigation and becomes a second problem to manage.
 */
export function openTab(to, label) {
  if (!to || !label) return;
  if (!tabs.some(t => t.to === to)) {
    tabs = [...tabs, { to, label }];
    if (tabs.length > MAX_TABS) {
      const victim = tabs.find(t => !pins.includes(t.to));
      if (victim) tabs = tabs.filter(t => t !== victim);
      else tabs = tabs.slice(1);
    }
    emit();
  }
}

/** @returns {string|null} where to go if the closed tab was the current one */
export function closeTab(to, currentPath) {
  const i = tabs.findIndex(t => t.to === to);
  if (i < 0) return null;
  tabs = tabs.filter(t => t.to !== to);
  emit();
  if (to !== currentPath) return null;
  return (tabs[i] || tabs[i - 1] || tabs[tabs.length - 1])?.to ?? '/admin/dashboard';
}

export function closeOthers(keep) {
  tabs = tabs.filter(t => t.to === keep || pins.includes(t.to));
  emit();
}

export function togglePin(to) {
  pins = pins.includes(to) ? pins.filter(p => p !== to) : [...pins, to];
  emit();
}
export const isPinned = (to) => pins.includes(to);
