/**
 * src/config/reportSources.js
 *
 * Every part of the system, described well enough that one report builder can
 * cover all of them.
 *
 * The old generator hand-wrote five report types. Adding a sixth meant writing
 * a sixth. Here a section is a declaration — its table, its columns, how each
 * column is formatted, and which filters apply — so covering a new section is
 * data, not code.
 */

import { STATUS_META as FORM_STATUS } from './formSchema.js';
import { MEAL_QUESTIONS } from './mealQuestions.js';
import { MINA_ALL_CRITERIA, MINA_SECTIONS } from './minaQuestions.js';
import { ARAFAT_ALL_CRITERIA, ARAFAT_SECTIONS } from './arafatQuestions.js';

/* ── Day of Dhul-Hijjah ────────────────────────────────────
   The operational calendar during Hajj is 6–13 Dhul-Hijjah, not a range of
   Gregorian dates. Filtering by "the 9th" is how the work is actually
   discussed, so it is a filter of its own rather than a date range the user
   has to convert. */
export const DHU_DAYS = [6, 7, 8, 9, 10, 11, 12, 13];

export function dhuDayOf(value) {
  if (!value) return null;
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', timeZone: 'Asia/Riyadh',
    }).formatToParts(d);
    const day   = parseInt(parts.find(p => p.type === 'day')?.value, 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
    return month === 12 ? day : null;      // Dhul-Hijjah only
  } catch { return null; }
}

/* ── Shared formatters ────────────────────────────────────── */

const ts = (v) => {
  if (!v) return '';
  const d = v?.toDate?.() ?? new Date(v);
  return isNaN(d) ? '' : d.toISOString().slice(0, 16).replace('T', ' ');
};
const day  = (v) => (v ? String(v).slice(0, 10) : '');
const num  = (v) => (v === null || v === undefined || v === '' ? '' : String(v));
const yn   = (v) => (v ? 'نعم' : 'لا');
const arr  = (v) => (Array.isArray(v) ? v.length : '');
const map  = (dict) => (v) => dict[v] ?? v ?? '';
const score = (r) => {
  if (r.scoreOutOf10 != null) return Number(r.scoreOutOf10).toFixed(1);
  const max = Number(r.maxScore), tot = Number(r.totalScore);
  if (max > 0 && !isNaN(tot)) return ((tot / max) * 10).toFixed(1);
  const pct = parseFloat(r.percentage);
  return isNaN(pct) ? '' : (pct / 10).toFixed(1);
};

const REPORT_STATUS   = { pending: 'قيد الانتظار', in_progress: 'قيد المعالجة', resolved: 'تم الحل' };
const LOGISTIC_STATUS = { pending: 'قيد الانتظار', approved: 'معتمد', delivered: 'تم التسليم', rejected: 'مرفوض' };
const SEVERITY        = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };
const MEALS           = { breakfast: 'الإفطار', lunch: 'الغداء', dinner: 'العشاء' };
const MEAL_CATS       = { cooked: 'مطبوخة', dry: 'جافة', sterilized: 'معقّمة' };
const ROLES           = { admin: 'مسؤول', staff: 'موظف', observer: 'مراقب', supervisor: 'مشرف', caterer: 'متعهد' };
const SITES           = { mina: 'منى', arafat: 'عرفات' };
const CATERER_STATUS  = { active: 'نشط', suspended: 'موقوف', archived: 'مؤرشف' };

/* `filters` names the controls a source supports. A source that has no centre
   column must not offer a centre filter — an unusable control is worse than a
   missing one, because it reads as a filter that returned nothing. */
export const REPORT_SOURCES = [
  {
    key: 'reports', label: 'البلاغات الميدانية', group: 'الميدان',
    table: 'reports', dateField: 'timestamp',
    filters: ['date', 'dhuDay', 'center', 'caterer', 'status'],
    statuses: REPORT_STATUS,
    columns: [
      { key: 'reportNumber', label: 'رقم البلاغ' },
      { key: 'center',       label: 'المركز' },
      { key: 'caterer',      label: 'المتعهد' },
      { key: 'observer',     label: 'المراقب' },
      { key: 'reportType',   label: 'نوع البلاغ' },
      { key: 'severity',     label: 'الخطورة', format: map(SEVERITY) },
      { key: 'holySite',     label: 'المشعر',  format: map(SITES) },
      { key: 'status',       label: 'الحالة',  format: map(REPORT_STATUS) },
      { key: 'description',  label: 'الوصف' },
      { key: 'images',       label: 'المرفقات', format: arr },
      { key: 'timestamp',    label: 'التاريخ', format: ts },
    ],
    defaultColumns: ['reportNumber', 'center', 'caterer', 'reportType', 'severity', 'status', 'timestamp'],
  },

  {
    key: 'logistics', label: 'طلبات الإسناد', group: 'الميدان',
    table: 'logistics_requests', dateField: 'timestamp',
    filters: ['date', 'dhuDay', 'center', 'caterer', 'status'],
    statuses: LOGISTIC_STATUS,
    columns: [
      { key: 'requestNumber', label: 'رقم الطلب' },
      { key: 'center',        label: 'المركز' },
      { key: 'caterer',       label: 'المتعهد' },
      { key: 'observer',      label: 'المراقب' },
      { key: 'category',      label: 'الفئة' },
      { key: 'supportType',   label: 'نوع الإسناد', format: map({ internal: 'داخلي', external: 'خارجي', both: 'كلاهما' }) },
      { key: 'qtyInternal',   label: 'كمية داخلية', format: num },
      { key: 'qtyExternal',   label: 'كمية خارجية', format: num },
      { key: 'status',        label: 'الحالة', format: map(LOGISTIC_STATUS) },
      { key: 'notes',         label: 'ملاحظات' },
      { key: 'timestamp',     label: 'التاريخ', format: ts },
    ],
    defaultColumns: ['requestNumber', 'center', 'caterer', 'category', 'supportType', 'status', 'timestamp'],
  },

  {
    key: 'meals', label: 'تقييم جودة الوجبات', group: 'التقييم',
    table: 'meal_evaluations', dateField: 'timestamp',
    filters: ['date', 'dhuDay', 'center', 'caterer'],
    columns: [
      { key: 'center',       label: 'المركز' },
      { key: 'caterer',      label: 'المتعهد' },
      { key: 'observer',     label: 'المراقب' },
      { key: 'mealType',     label: 'الوجبة',  format: map(MEALS) },
      { key: 'mealCategory', label: 'التصنيف', format: map(MEAL_CATS) },
      { key: '__score',      label: 'الدرجة /10', compute: score },
      { key: 'percentage',   label: 'النسبة %', format: num },
      { key: 'scheduledDate', label: 'اليوم', format: day },
      { key: 'timestamp',    label: 'وقت الرفع', format: ts },
    ],
    defaultColumns: ['center', 'caterer', 'mealType', '__score', 'percentage', 'timestamp'],
    questions: MEAL_QUESTIONS,
  },

  {
    key: 'mina', label: 'جاهزية منى', group: 'التقييم',
    table: 'mina_readiness', dateField: 'timestamp',
    filters: ['date', 'dhuDay', 'center', 'caterer'],
    columns: [
      { key: 'center',   label: 'المركز' },
      { key: 'caterer',  label: 'المتعهد' },
      { key: 'observer', label: 'المقيّم' },
      { key: 'role',     label: 'الصفة', format: map(ROLES) },
      { key: '__score',  label: 'الدرجة /10', compute: score },
      { key: 'percentage', label: 'النسبة %', format: num },
      { key: 'timestamp', label: 'التاريخ', format: ts },
    ],
    defaultColumns: ['center', 'caterer', 'observer', '__score', 'percentage', 'timestamp'],
    questions: MINA_ALL_CRITERIA,
    /* Grouped exactly as the inspection form groups them, so the record reads
       in the order it was filled. */
    criteriaSections: MINA_SECTIONS,
    dossierTitle: 'محضر جاهزية مشعر منى',
  },

  {
    key: 'arafat', label: 'جاهزية عرفة', group: 'التقييم',
    table: 'arafat_readiness', dateField: 'timestamp',
    filters: ['date', 'dhuDay', 'center', 'caterer'],
    columns: [
      { key: 'center',   label: 'المركز' },
      { key: 'caterer',  label: 'المتعهد' },
      { key: 'observer', label: 'المقيّم' },
      { key: 'role',     label: 'الصفة', format: map(ROLES) },
      { key: '__score',  label: 'الدرجة /10', compute: score },
      { key: 'percentage', label: 'النسبة %', format: num },
      { key: 'timestamp', label: 'التاريخ', format: ts },
    ],
    defaultColumns: ['center', 'caterer', 'observer', '__score', 'percentage', 'timestamp'],
    questions: ARAFAT_ALL_CRITERIA,
    criteriaSections: ARAFAT_SECTIONS,
    dossierTitle: 'محضر جاهزية مشعر عرفة',
  },

  {
    key: 'caterers', label: 'المتعهدون', group: 'السجلات',
    table: 'caterers', dateField: 'createdAt',
    filters: ['catererStatus'],
    statuses: CATERER_STATUS,
    columns: [
      { key: 'name',             label: 'اسم المتعهد' },
      { key: 'crNumber',         label: 'السجل التجاري' },
      { key: 'municipalLicense', label: 'رخصة بلدي' },
      { key: 'ownerName',        label: 'المالك' },
      { key: 'ownerCapacity',    label: 'الصفة' },
      { key: 'ownerPhone',       label: 'جوال المالك' },
      { key: 'liaisonName',      label: 'ضابط الاتصال' },
      { key: 'liaisonPhone',     label: 'جوال الضابط' },
      { key: 'email',            label: 'البريد' },
      { key: 'address',          label: 'العنوان' },
      { key: 'status',           label: 'الحالة', format: map(CATERER_STATUS) },
    ],
    defaultColumns: ['name', 'crNumber', 'ownerName', 'liaisonName', 'liaisonPhone', 'status'],
  },

  {
    key: 'centers', label: 'المراكز', group: 'السجلات',
    table: 'centers', dateField: 'createdAt', seasonScoped: true,
    filters: ['season', 'caterer'],
    columns: [
      { key: 'code',                label: 'رقم المركز' },
      { key: 'catererName',         label: 'المتعهد' },
      { key: 'facilityName',        label: 'اسم المنشأة' },
      { key: 'facilityLicense',     label: 'رقم الترخيص' },
      { key: 'category',            label: 'الفئة' },
      { key: 'pilgrimsCount',       label: 'عدد الحجاج', format: num },
      { key: 'pilgrimsNationality', label: 'الجنسية' },
      { key: 'shakhisMina',         label: 'الشاخص (منى)' },
      { key: 'shakhisArafat',       label: 'الشاخص (عرفة)' },
      { key: 'murabbaMina',         label: 'المربع (منى)' },
      { key: 'active',              label: 'مفعّل', format: yn },
    ],
    defaultColumns: ['code', 'catererName', 'category', 'pilgrimsCount', 'pilgrimsNationality', 'shakhisMina'],
  },

  {
    key: 'forms', label: 'تكليفات النماذج', group: 'النماذج',
    table: 'form_assignments', dateField: 'assignedAt', seasonScoped: true,
    filters: ['season', 'caterer', 'formStatus'],
    statuses: Object.fromEntries(Object.entries(FORM_STATUS).map(([k, v]) => [k, v.label])),
    columns: [
      { key: 'formNumber',  label: 'الرقم' },
      { key: '__template',  label: 'النموذج',  lookup: 'template' },
      { key: '__caterer',   label: 'المتعهد',  lookup: 'caterer' },
      { key: '__center',    label: 'المركز',   lookup: 'center' },
      { key: 'status',      label: 'الحالة',   format: (v) => FORM_STATUS[v]?.label ?? v },
      { key: 'dueAt',       label: 'تاريخ التسليم', format: day },
      { key: 'submittedAt', label: 'تاريخ الاستلام', format: ts },
      { key: '__late',      label: 'التأخير (يوم)', compute: (r) => {
        if (!r.dueAt) return '';
        const due = new Date(r.dueAt).getTime();
        const at  = r.submittedAt ? new Date(r.submittedAt).getTime() : Date.now();
        const d   = Math.floor((at - due) / 86_400_000);
        return d > 0 ? String(d) : '0';
      }},
    ],
    defaultColumns: ['formNumber', '__template', '__caterer', 'status', 'dueAt', '__late'],
  },

  {
    key: 'users', label: 'المراقبون والمشرفون', group: 'المستخدمون',
    table: 'users', dateField: 'createdAt',
    filters: ['role', 'center'],
    columns: [
      { key: 'nameAr',          label: 'الاسم' },
      { key: 'idNumber',        label: 'رقم الهوية' },
      { key: 'phone',           label: 'الجوال' },
      { key: 'role',            label: 'الدور', format: map(ROLES) },
      { key: 'center',          label: 'المركز' },
      { key: 'assignedCenters', label: 'عدد المراكز', format: arr },
      { key: 'caterer',         label: 'المتعهد' },
      { key: 'email',           label: 'البريد' },
    ],
    defaultColumns: ['nameAr', 'idNumber', 'phone', 'role', 'center'],
  },

  {
    key: 'phases', label: 'مراحل الوجبات', group: 'المتابعة',
    table: 'meal_phases', dateField: 'updatedAt',
    filters: ['center'],
    columns: [
      { key: 'center',  label: 'المركز' },
      { key: 'day',     label: 'اليوم' },
      { key: 'mealId',  label: 'الوجبة', format: map(MEALS) },
      { key: 'phase1',  label: 'المرحلة 1', format: ts },
      { key: 'phase2',  label: 'المرحلة 2', format: ts },
      { key: 'phase3',  label: 'المرحلة 3', format: ts },
    ],
    defaultColumns: ['center', 'day', 'mealId', 'phase1', 'phase2', 'phase3'],
  },

  {
    key: 'taskCompletions', label: 'إنجاز المهام', group: 'المتابعة',
    table: 'task_completions', dateField: 'timestamp',
    filters: ['date', 'center'],
    columns: [
      { key: 'center',        label: 'المركز' },
      { key: 'observerName',  label: 'المراقب' },
      { key: 'taskType',      label: 'نوع المهمة' },
      { key: 'mealType',      label: 'الوجبة', format: map(MEALS) },
      { key: 'mealCategory',  label: 'التصنيف', format: map(MEAL_CATS) },
      { key: 'scheduledDate', label: 'اليوم', format: day },
      { key: 'timestamp',     label: 'وقت الإنجاز', format: ts },
    ],
    defaultColumns: ['center', 'observerName', 'taskType', 'mealType', 'timestamp'],
  },
];

export const SOURCE_BY_KEY = Object.fromEntries(REPORT_SOURCES.map(s => [s.key, s]));

export const SOURCE_GROUPS = [...new Set(REPORT_SOURCES.map(s => s.group))];

/** Renders one cell, honouring `compute`, `lookup` and `format` in that order. */
export function cellValue(col, row, lookups = {}) {
  if (col.compute) return col.compute(row) ?? '';
  if (col.lookup) {
    const dict = lookups[col.lookup] || {};
    const id = row[`${col.lookup}Id`];
    return dict[id] ?? '';
  }
  const raw = row[col.key];
  return col.format ? col.format(raw) : (raw ?? '');
}
