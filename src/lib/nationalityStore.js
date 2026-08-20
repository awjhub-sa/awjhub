/**
 * src/lib/nationalityStore.js
 *
 * Loads the season's pilgrim groups and the centres that feed them.
 *
 * The roster used to be a list in the source. It is now rows the customer owns,
 * but the code that reads it — nineteen call sites across eight screens — reads
 * it synchronously during render. So the rows are fetched here, folded into the
 * config module, and a version counter is bumped for components to re-render
 * off. Same shape as menuStore, deliberately: two stores that behave
 * differently would be two things to remember.
 *
 * If nothing is stored yet, the shipped roster stays. A customer mid-setup sees
 * a working system, not an empty one.
 */

import { useEffect, useState } from 'react';
import { db } from './db.js';
import { setNationalityOverlay, extractCenterNum } from '../config/nationalities.js';

let version = 0;
let loading = null;
let loadedSeason = Symbol('unloaded');
let custom = false;
const listeners = new Set();

const notify = () => { version++; listeners.forEach(fn => fn(version)); };

/** True once the season's own roster replaced the shipped one. */
export const hasCustomRoster = () => custom;

export async function loadNationalities(seasonId = null, { force = false } = {}) {
  if (!force && loadedSeason === seasonId) return version;
  if (!force && loading) return loading;

  loading = (async () => {
    try {
      const [nats, links, centers] = await Promise.all([
        db.nationalities.list(seasonId ? { filter: { seasonId } } : {}),
        db.center_nationalities.list(),
        db.centers.list(seasonId ? { filter: { seasonId } } : {}),
      ]);

      /* The join table speaks in centre ids; every screen speaks in centre
         numbers, because that is what is painted on the building. */
      const numById = new Map(centers.map(c => [c.id, extractCenterNum(c.code)]));
      const byNat = new Map();
      for (const l of links) {
        const num = numById.get(l.centerId);
        if (num == null) continue;
        const list = byNat.get(l.nationalityId) || [];
        list.push(num);
        byNat.set(l.nationalityId, list);
      }

      const rows = nats
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(n => ({
          id: n.id,
          name: n.name,
          flag: n.flag,
          color: n.color,
          legacyKey: n.legacyKey,
          centers: (byNat.get(n.id) || []).sort((a, b) => a - b),
        }));

      custom = setNationalityOverlay(rows);
      loadedSeason = seasonId;
      notify();
    } catch (err) {
      /* The shipped roster keeps showing. A blank nationality rail would make
         every screen below it look broken over what may be a dropped packet. */
      console.error('[nationalityStore] load failed', err?.message || err);
    } finally {
      loading = null;
    }
    return version;
  })();

  return loading;
}

export const refreshNationalities = (seasonId = null) =>
  loadNationalities(seasonId, { force: true });

/** Re-renders the caller whenever the roster changes. */
export function useNationalityVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    return () => listeners.delete(setV);
  }, []);
  return v;
}
