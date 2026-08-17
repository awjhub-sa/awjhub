function range(s, e) {
  return Array.from({ length: e - s + 1 }, (_, i) => s + i);
}

export const NATIONALITIES = [
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

export const NAT_LABEL = Object.fromEntries(NATIONALITIES.map(n => [n.key, n.label]));
export const NAT_LOOKUP = Object.fromEntries(NATIONALITIES.map(n => [n.key, n]));

const _centerToNats = new Map();
NATIONALITIES.forEach(n => n.centers.forEach(c => {
  const key = Number(c);
  const list = _centerToNats.get(key) || [];
  list.push(n.key);
  _centerToNats.set(key, list);
}));

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
