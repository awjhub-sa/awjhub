/**
 * src/config/fieldRecords.js
 *
 * The vocabulary of a field record — what a report type is called and what
 * colour it wears, what the statuses are, what a support type means.
 *
 * It lived in three places: the reports screen, the logistics screen and the
 * dashboard each kept its own copy, and they had already drifted — the same
 * report showed one colour in a list and another in a modal. One list, read by
 * every screen that shows one of these records.
 */

import {
  Drop as Droplets,
  Lightning as Zap,
  Users as UsersIcon,
  ForkKnife as Utensils,
  Heartbeat as HeartPulse,
  Shield,
  Fire as Flame,
  FileText,
  Package,
  Star,
  Thermometer,
  Hourglass,
  Clock,
  Pulse as Activity,
  CheckCircle as CheckCircle2,
  XCircle,
  ThumbsUp,
  ArrowRight,
  ArrowLeft,
  Stack as Layers,
  MapPin,
  Mountains as Mountain,
} from '@phosphor-icons/react';

/* ── Reports ──────────────────────────────────────────────── */

export const REPORT_STATUSES = [
  { value: 'pending',     label: 'قيد الانتظار', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', Icon: Clock        },
  { value: 'in_progress', label: 'جارٍ التنفيذ',  color: '#4E7CB0', bg: '#EFF6FF', border: '#BFDBFE', Icon: Activity     },
  { value: 'resolved',    label: 'تم الحل',       color: '#5E9070', bg: '#F0FDF4', border: '#86EFAC', Icon: CheckCircle2 },
];
export const REPORT_STATUS_LOOKUP = Object.fromEntries(REPORT_STATUSES.map(s => [s.value, s]));

export const SEVERITY_MAP = {
  high:   { label: 'عالية',   bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', bar: '#EF4444' },
  urgent: { label: 'عاجل',    bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', bar: '#DC2626' },
  medium: { label: 'متوسطة',  bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', bar: '#F59E0B' },
  low:    { label: 'منخفضة',  bg: '#EFF6FF', border: '#BFDBFE', text: '#26456A', bar: '#4E7CB0' },
};

export const REPORT_TYPE_MAP = {
  water:    { label: 'تسرب مياه',        Icon: Droplets,    color: '#4E7CB0' },
  electric: { label: 'عطل كهربائي',       Icon: Zap,         color: '#F59E0B' },
  crowd:    { label: 'ازدحام حرج',        Icon: UsersIcon,   color: '#B4674E' },
  food:     { label: 'مشكلة غذائية',      Icon: Utensils,    color: 'rgb(var(--c-primary))' },
  medical:  { label: 'حالة طبية طارئة',   Icon: HeartPulse,  color: '#EF4444' },
  security: { label: 'بلاغ أمني',         Icon: Shield,      color: '#1F2937' },
  fire:     { label: 'حريق / دخان',       Icon: Flame,       color: '#DC2626' },
  other:    { label: 'بلاغ آخر',          Icon: FileText,    color: 'rgb(var(--c-muted))' },
  shortage: { label: 'نقص في الكميات',    Icon: Package,     color: '#EA580C' },
  delay:    { label: 'تأخر في التوزيع',   Icon: Hourglass,   color: '#3D6795' },
  quality:  { label: 'مشكلة في الجودة',   Icon: Star,        color: '#EAB308' },
  hygiene:  { label: 'مخالفة صحية',       Icon: Thermometer, color: '#5E9070' },
};

/* ── Logistics ────────────────────────────────────────────── */

export const LOGISTICS_STATUSES = [
  { value: 'pending',   label: 'قيد الانتظار', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', Icon: Clock        },
  { value: 'approved',  label: 'موافق عليه',   color: '#4E7CB0', bg: '#EFF6FF', border: '#BFDBFE', Icon: ThumbsUp     },
  { value: 'delivered', label: 'تم التسليم',   color: '#5E9070', bg: '#F0FDF4', border: '#86EFAC', Icon: CheckCircle2 },
  { value: 'rejected',  label: 'مرفوض',        color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', Icon: XCircle      },
];
export const LOGISTICS_STATUS_LOOKUP = Object.fromEntries(LOGISTICS_STATUSES.map(s => [s.value, s]));

export const SUPPORT_TYPES = [
  { value: 'internal', label: 'داخلي',        short: 'داخلي',        Icon: ArrowRight, color: '#4E7CB0' },
  { value: 'external', label: 'خارجي',        short: 'خارجي',        Icon: ArrowLeft,  color: '#B4674E' },
  { value: 'both',     label: 'داخلي وخارجي', short: 'داخلي وخارجي', Icon: Layers,     color: '#2F5580' },
];
export const SUPPORT_LOOKUP = Object.fromEntries(SUPPORT_TYPES.map(t => [t.value, t]));

export const CATEGORY_LABEL = { meals: 'وجبات', water: 'مياه' };

/* ── Shared ───────────────────────────────────────────────── */

export const MEAL_LABEL = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
export const MEAL_COLOR = { breakfast: '#F59E0B', lunch: '#EF4444', dinner: '#B4674E' };
export const HOLY_SITE_LABEL = { mina: 'منى', arafat: 'عرفات' };
export const HOLY_SITE_COLOR = { mina: 'rgb(var(--c-primary))', arafat: '#5E9070' };
export const HOLY_SITE_ICON  = { mina: MapPin, arafat: Mountain };

export const reportType = (r) =>
  REPORT_TYPE_MAP[r?.reportType] || REPORT_TYPE_MAP[r?.type] ||
  { label: r?.reportType || 'بلاغ', Icon: FileText, color: 'rgb(var(--c-muted))' };

export const severityOf = (r) => SEVERITY_MAP[r?.severity] || null;
export const reportStatus = (r) => REPORT_STATUS_LOOKUP[r?.status] || REPORT_STATUSES[0];
export const logisticsStatus = (r) => LOGISTICS_STATUS_LOOKUP[r?.status] || LOGISTICS_STATUSES[0];
export const supportType = (r) => SUPPORT_LOOKUP[r?.supportType] || SUPPORT_TYPES[0];

/* A record is "new" while it is still pending and less than ten minutes old —
   long enough for the operations room to notice it, short enough that the
   badge means something. */
const NEW_THRESHOLD_MS = 10 * 60 * 1000;
export const isNewRecord = (r) => {
  if (r?.status && r.status !== 'pending') return false;
  const ts = r?.timestamp?.toMillis?.() ?? r?.createdAt?.toMillis?.() ?? 0;
  return ts > 0 && (Date.now() - ts) < NEW_THRESHOLD_MS;
};

export function timeAgo(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60)    return 'الآن';
    if (s < 3600)  return `منذ ${Math.floor(s / 60)} دقيقة`;
    if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
    return `منذ ${Math.floor(s / 86400)} يوم`;
  } catch { return '—'; }
}

export function fullDate(ts) {
  if (!ts) return '—';
  try {
    return (ts.toDate ? ts.toDate() : new Date(ts))
      .toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return '—'; }
}
