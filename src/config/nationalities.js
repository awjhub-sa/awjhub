function range(s, e) {
  return Array.from({ length: e - s + 1 }, (_, i) => s + i);
}

/**
 * The roster that ships in the box.
 *
 * These nine are one operator's pilgrims, with their centre numbers written in
 * by hand. They stay as the fallback — what a fresh install shows, and what
 * paints the first frame before the season's own rows arrive from the database
 * (see lib/nationalityStore.js). A customer's roster replaces this list at
 * runtime; nothing here is edited to add a nationality any more.
 */
export const DEFAULT_NATIONALITIES = [
  /* Eight hues spread evenly round the wheel. None fall inside the navy band
     (204–235) or near the #B99A64 accent, so a nationality chip can never be
     mistaken for a brand element or an active state.
     They are deliberately muted — around 55% saturation rather than the 80–90%
     they carried before. A dozen chips at full chroma shouted over a brand
     built on a quiet navy and a quiet gold; the hues still separate cleanly,
     they just no longer compete with the page. */
  { key: 'indonesia',   label: 'إندونيسيا', flag: '🇮🇩', centers: range(60, 90),             color: '#B84A5E' },
  { key: 'iraq',        label: 'العراق',     flag: '🇮🇶', centers: range(40, 51),             color: '#B96438' },
  { key: 'yemen',       label: 'اليمن',      flag: '🇾🇪', centers: range(20, 25),             color: '#9C7C2A' },
  { key: 'bangladesh1', label: 'بنغلاديش (٧-٨)',     flag: '🇧🇩', centers: [7, 8],       color: '#6E8C3A' },
  { key: 'bangladesh2', label: 'بنغلاديش (١٠١-١٠٢)', flag: '🇧🇩', centers: [101, 102],   color: '#3F8B57' },
  { key: 'afghanistan', label: 'أفغانستان',  flag: '🇦🇫', centers: [26, ...range(30, 35)],    color: '#6F5B96' },
  { key: 'comoros',     label: 'جزر القمر',  flag: '🇰🇲', centers: [26],                      color: '#3D6795' },
  { key: 'bahrain',     label: 'البحرين',    flag: '🇧🇭', centers: [99],                      color: '#96528F' },
  { key: 'bohra',       label: 'البهرة',     flag: '🕌',  centers: [5],                       color: 'rgb(var(--c-primary))' },
];

/* The live roster.
 *
 * Deliberately mutated in place rather than reassigned: nineteen call sites
 * across eight files hold this binding, and an array that is swapped out would
 * leave every one of them pointing at the shipped defaults for ever. Rebuilding
 * its contents keeps one source of truth without rewriting those files —
 * components re-render off useNationalityVersion(). */
export const NATIONALITIES = [...DEFAULT_NATIONALITIES];

export const NAT_LABEL  = {};
export const NAT_LOOKUP = {};

const _centerToNats = new Map();

/* Derives everything that hangs off the roster. Called once at module load and
   again whenever the season's rows land. */
function reindex() {
  for (const k of Object.keys(NAT_LABEL))  delete NAT_LABEL[k];
  for (const k of Object.keys(NAT_LOOKUP)) delete NAT_LOOKUP[k];
  _centerToNats.clear();

  NATIONALITIES.forEach(n => {
    NAT_LABEL[n.key]  = n.label;
    NAT_LOOKUP[n.key] = n;
    (n.centers || []).forEach(c => {
      const key = Number(c);
      if (Number.isNaN(key)) return;
      const list = _centerToNats.get(key) || [];
      list.push(n.key);
      _centerToNats.set(key, list);
    });
  });
}
reindex();

/**
 * Installs the season's roster.
 *
 * @param {Array<{id,name,flag,color,legacyKey,centers:number[]}>} rows
 *   Passing an empty list is a no-op, not a wipe: a customer who has not
 *   entered their own nationalities yet keeps seeing the shipped ones instead
 *   of an empty system.
 */
export function setNationalityOverlay(rows) {
  const next = (rows || [])
    .filter(r => r?.id && r?.name)
    .map(r => ({
      key: r.id,                        // the row's id is the key everything else uses
      label: r.name,
      flag: r.flag || '🏳️',
      color: r.color || '#6F5B96',
      centers: (r.centers || []).map(Number).filter(n => !Number.isNaN(n)),
      /* Points at a menu compiled into config/menus.js. Null for a nationality
         the customer created, which simply starts with no menu. */
      legacyKey: r.legacyKey || null,
    }));

  if (!next.length) return false;

  NATIONALITIES.length = 0;
  NATIONALITIES.push(...next);
  reindex();
  return true;
}

/** True once a customer's own roster is in place. */
export const usingCustomRoster = () =>
  NATIONALITIES.some(n => n.legacyKey !== undefined && n.key?.length > 20);

export function extractCenterNum(centerId) {
  if (centerId == null) return null;
  const m = String(centerId).match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function getCenterNationalityKeys(centerIdOrNum) {
  const num = typeof centerIdOrNum === 'number' ? centerIdOrNum : extractCenterNum(centerIdOrNum);
  if (num == null) return [];
  return _centerToNats.get(num) || [];
}

export function getCenterNationalities(centerIdOrNum) {
  return getCenterNationalityKeys(centerIdOrNum).map(k => NAT_LOOKUP[k]).filter(Boolean);
}

export function getCenterNationalityKey(centerIdOrNum) {
  return getCenterNationalityKeys(centerIdOrNum)[0] || null;
}

export function getCenterNationality(centerIdOrNum) {
  return getCenterNationalities(centerIdOrNum)[0] || null;
}
