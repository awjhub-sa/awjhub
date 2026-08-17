/**
 * src/lib/menuStore.js
 *
 * Loads the customer's saved menus once and keeps every screen that draws a
 * menu in step with them.
 *
 * getMeal() in config/menus.js is synchronous — the observer's card, the phase
 * alerts and the admin screen all call it during render, and making it async
 * would mean rewriting all three. So the rows are fetched here, handed to the
 * overlay, and a version counter is bumped; components subscribe to the counter
 * and re-render. The read stays synchronous, the data stays live.
 */

import { useEffect, useState } from 'react';
import { db } from './db.js';
import { setMenuOverlay } from '../config/menus.js';

let version = 0;
let loading = null;
let loadedSeason = Symbol('unloaded');
const listeners = new Set();

const notify = () => { version++; listeners.forEach(fn => fn(version)); };

/**
 * Fetch the saved menus for a season and install them.
 * Repeated calls for the same season are collapsed unless `force` is set —
 * several screens mount at once and none of them should trigger its own fetch.
 */
export async function loadMenus(seasonId = null, { force = false } = {}) {
  if (!force && loadedSeason === seasonId) return version;
  if (!force && loading) return loading;

  loading = (async () => {
    try {
      const rows = await db.menus.list(seasonId ? { filter: { seasonId } } : {});
      setMenuOverlay(rows);
      loadedSeason = seasonId;
      notify();
    } catch (err) {
      /* A missing table or a network blip must not blank the menu: the
         built-in one keeps showing, which is the honest fallback. */
      console.error('[menuStore] load failed', err?.message || err);
    } finally {
      loading = null;
    }
    return version;
  })();

  return loading;
}

/** Re-fetch after a save. */
export const refreshMenus = (seasonId = null) => loadMenus(seasonId, { force: true });

/**
 * Re-renders the caller whenever saved menus change.
 * Returns the version so it can be used as a dependency.
 */
export function useMenuVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    return () => listeners.delete(setV);
  }, []);
  return v;
}
