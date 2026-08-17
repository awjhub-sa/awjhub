function range(s, e) {
  return Array.from({ length: e - s + 1 }, (_, i) => s + i);
}

export const NATIONALITIES = [
  /* Eight hues spread evenly round the wheel. None fall inside the navy band
     (204–235) or near the #D8A15C accent, so a nationality chip can never be
     mistaken for a brand element or an active state. The previous set had two
     blues (#3182CE, #1E40AF) sitting directly on the brand hue. */
  { key: 'indonesia',   label: 'إندونيسيا', flag: '🇮🇩', centers: range(60, 90),             color: '#E11D48' },
  { key: 'iraq',        label: 'العراق',     flag: '🇮🇶', centers: range(40, 51),             color: '#EA580C' },
  { key: 'yemen',       label: 'اليمن',      flag: '🇾🇪', centers: range(20, 25),             color: '#CA8A04' },
  { key: 'bangladesh1', label: 'بنغلاديش (٧-٨)',     flag: '🇧🇩', centers: [7, 8],       color: '#65A30D' },
  { key: 'bangladesh2', label: 'بنغلاديش (١٠١-١٠٢)', flag: '🇧🇩', centers: [101, 102],   color: '#16A34A' },
  { key: 'afghanistan', label: 'أفغانستان',  flag: '🇦🇫', centers: [26, ...range(30, 35)],    color: '#7C3AED' },
  { key: 'comoros',     label: 'جزر القمر',  flag: '🇰🇲', centers: [26],                      color: '#0891B2' },
  { key: 'bahrain',     label: 'البحرين',    flag: '🇧🇭', centers: [99],                      color: '#C026D3' },
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
