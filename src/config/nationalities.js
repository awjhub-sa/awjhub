function range(s, e) {
  return Array.from({ length: e - s + 1 }, (_, i) => s + i);
}

export const NATIONALITIES = [
  { key: 'indonesia',   label: 'إندونيسيا', flag: '🇮🇩', centers: range(60, 90),             color: '#E53E3E' },
  { key: 'iraq',        label: 'العراق',     flag: '🇮🇶', centers: range(40, 51),             color: '#D97706' },
  { key: 'yemen',       label: 'اليمن',      flag: '🇾🇪', centers: range(20, 25),             color: '#2F855A' },
  { key: 'bangladesh',  label: 'بنغلاديش',   flag: '🇧🇩', centers: [7, 8, 101, 102],          color: '#3182CE' },
  { key: 'afghanistan', label: 'أفغانستان',  flag: '🇦🇫', centers: [26, ...range(30, 35)],    color: '#7C3AED' },
  { key: 'comoros',     label: 'جزر القمر',  flag: '🇰🇲', centers: [26],                      color: '#059669' },
  { key: 'bahrain',     label: 'البحرين',    flag: '🇧🇭', centers: [99],                      color: '#0987A0' },
  { key: 'bohra',       label: 'البهرة',     flag: '🕌',  centers: [5],                       color: '#A98159' },
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
