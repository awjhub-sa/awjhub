/**
 * src/config/formSchema.js
 *
 * The vocabulary of the forms module: what a block is, what a field is, where a
 * field may pull its value from, and how a filled form is validated.
 *
 * A template's `definition` has two halves:
 *
 *   blocks  an ordered list that lays the document out — headings, prose,
 *           tables, a signature line. This is what makes the output read as an
 *           official letter rather than a stack of labelled inputs.
 *   fields  a keyed registry giving every blank its type and rules.
 *
 * Prose blocks reference fields inline with {{key}}. The same field may appear
 * inside a sentence or as a labelled input in a `fields` block; the author
 * chooses, and nothing else in the system cares which.
 */

import { BRAND } from './brand.js';

/* ── Blocks ───────────────────────────────────────────────── */
export const BLOCK_TYPES = [
  { type: 'heading',   label: 'عنوان',   hint: 'عنوان قسم داخل المستند' },
  { type: 'paragraph', label: 'فقرة',    hint: 'نص المستند، ويمكن إدراج حقول داخله' },
  /* Undertakings and terms are lists of clauses, not prose. Keeping each
     clause its own item is what lets an author reorder or drop one without
     retyping the paragraph around it. */
  { type: 'list',      label: 'قائمة بنود', hint: 'بنود مرقّمة أو منقّطة، كل سطر بند' },
  /* `style: 'list'` renders the same keys as bulleted «label: blank» lines,
     which is how the official forms present a short block of details. */
  { type: 'fields',    label: 'حقول',    hint: 'خانات معنونة — شبكة أو نقاط' },
  { type: 'table',     label: 'جدول',    hint: 'صفوف متكررة — العمال، الأصناف، العهد' },
  { type: 'note',      label: 'ملاحظة',  hint: 'تنبيه أو شرط يظهر بخلفية مميزة' },
  { type: 'divider',   label: 'فاصل',    hint: 'خط فاصل' },
  /* Saudi official letters close with a signature *and* a company stamp side by
     side, so the block holds slots rather than a single box. */
  { type: 'signature', label: 'توقيع وختم', hint: 'خانة أو أكثر: التوقيع، الختم' },
];
export const BLOCK_META = Object.fromEntries(BLOCK_TYPES.map(b => [b.type, b]));

/* ── Field types ──────────────────────────────────────────── */
/* `width` is the share of a printed line the blank takes, used by the preview
   and the PDF so a date does not stretch across the page like an address. */
export const FIELD_TYPES = [
  { type: 'text',     label: 'نص',            width: 'auto' },
  { type: 'textarea', label: 'نص طويل',       width: 'full' },
  { type: 'number',   label: 'رقم',           width: 'sm'   },
  { type: 'id',       label: 'رقم هوية',      width: 'md'   },
  { type: 'phone',    label: 'جوال',          width: 'md'   },
  { type: 'email',    label: 'بريد إلكتروني', width: 'md'   },
  { type: 'date',     label: 'تاريخ',         width: 'md'   },
  { type: 'select',   label: 'قائمة',         width: 'md'   },
  { type: 'multi',    label: 'اختيار متعدد',  width: 'full' },
  { type: 'bool',     label: 'نعم / لا',      width: 'sm'   },
  { type: 'file',     label: 'مرفق',          width: 'full' },
  { type: 'table',    label: 'جدول متكرر',    width: 'full' },
];
export const FIELD_META = Object.fromEntries(FIELD_TYPES.map(f => [f.type, f]));

/* ── Who fills a field ────────────────────────────────────── */
/**
 * Ownership and prefill are two different questions, and conflating them is the
 * easy mistake here:
 *
 *   owner   who may type into the blank
 *   source  where its opening value comes from
 *
 * A field can be owned by the caterer and still arrive prefilled from the
 * registry — that is the common case, and the point of holding a caterers
 * table at all. A liaison-appointment letter exists to collect the officer's
 * details from the caterer, so those blanks stay the caterer's even though the
 * registry can propose an answer.
 *
 *   system   on record and not in question; filled and locked
 *   admin    the company's own to state — a contract number, a deadline
 *   caterer  what the form is asking the caterer for
 *
 * A field with no source defaults to the caterer: a form asks its recipient
 * for something. Only mark a blank `admin` when the company, not the caterer,
 * is the one who knows it.
 */
export const OWNERS = [
  { value: 'caterer', label: 'المتعهد' },
  { value: 'admin',   label: 'الإدارة عند الإسناد' },
  { value: 'system',  label: 'النظام — مقفل' },
];

export function fieldOwner(def) {
  if (!def) return 'caterer';
  if (def.owner) return def.owner;
  return def.source ? 'system' : 'caterer';
}

/** Field keys the document shows that belong to the given owner. */
export function keysOwnedBy(definition, owner) {
  const { fields = {} } = definition || {};
  return [...visibleFieldKeys(definition)].filter(k => fieldOwner(fields[k]) === owner);
}

/* ── Autofill sources ─────────────────────────────────────── */
/* A field with a `source` is answered by the system, not the caterer. A number
   typed by hand ten times is typed wrong at least once, so anything already on
   record is filled and locked rather than asked for again. */
export const SOURCES = [
  /* The document is addressed to the Hajj company that owns the system, so its
     own name is a source too — and it comes from brand.js, which is what makes
     the same template reusable by whoever buys the product. */
  { key: 'company.name',              label: 'اسم الشركة (كامل)' },
  { key: 'company.short',             label: 'اسم الشركة (مختصر)' },

  { key: 'caterer.name',              label: 'اسم المتعهد' },
  { key: 'caterer.cr_number',         label: 'السجل التجاري' },
  { key: 'caterer.municipal_license', label: 'رقم الرخصة (بلدي)' },
  { key: 'caterer.address',           label: 'العنوان الرئيسي' },
  { key: 'caterer.owner_name',        label: 'اسم المالك' },
  { key: 'caterer.owner_id_number',   label: 'هوية المالك' },
  { key: 'caterer.owner_phone',       label: 'جوال المالك' },
  { key: 'caterer.email',             label: 'بريد المتعهد' },
  { key: 'caterer.liaison_name',      label: 'ضابط الاتصال' },
  { key: 'caterer.liaison_phone',     label: 'جوال ضابط الاتصال' },
  { key: 'center.code',               label: 'رقم المركز' },
  { key: 'center.facility_name',      label: 'اسم المنشأة' },
  { key: 'center.facility_license',   label: 'رقم ترخيص المنشأة' },
  { key: 'center.pilgrims_count',     label: 'عدد الحجاج' },
  { key: 'center.category',           label: 'فئة المركز' },
  { key: 'center.shakhis_mina',       label: 'الشاخص (منى)' },
  { key: 'center.shakhis_arafat',     label: 'الشاخص (عرفة)' },
  { key: 'season.name',               label: 'الموسم' },
  { key: 'today',                     label: 'تاريخ اليوم' },
];
export const SOURCE_LABEL = Object.fromEntries(SOURCES.map(s => [s.key, s.label]));

/* ── Token handling ───────────────────────────────────────── */
export const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Every field key referenced by {{...}} anywhere in the blocks. */
export function tokensIn(blocks = []) {
  const found = new Set();
  for (const b of blocks) {
    const strings = [b.text, b.label, ...(b.items || [])];
    for (const text of strings) {
      if (typeof text !== 'string') continue;
      for (const m of text.matchAll(TOKEN_RE)) found.add(m[1]);
    }
  }
  return found;
}

/** Splits prose into printable runs and field placeholders, in order. */
export function splitTokens(text = '') {
  const parts = [];
  let last = 0;
  for (const m of String(text).matchAll(TOKEN_RE)) {
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'field', key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}

/* ── Autofill ─────────────────────────────────────────────── */
const SNAKE_TO_CAMEL = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

/**
 * Resolves the `source` of every field against the records the assignment
 * points at, returning the values the caterer should never have to type.
 * Rows arrive from db.js already camelCased, so source keys are converted.
 */
export function resolveSources(fields = {}, ctx = {}) {
  /* `company` is injected rather than passed in: it is the tenant's own
     identity, identical for every assignment, and no caller should have to
     remember to supply it. */
  const scope = {
    ...ctx,
    company: { name: BRAND.companyFullAr, short: BRAND.companyName },
  };

  const out = {};
  for (const [key, def] of Object.entries(fields)) {
    if (!def?.source) continue;
    if (def.source === 'today') { out[key] = new Date().toISOString().slice(0, 10); continue; }
    const [entity, column] = def.source.split('.');
    const value = scope[entity]?.[SNAKE_TO_CAMEL(column || '')];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

/* ── Validation ───────────────────────────────────────────── */
const PATTERNS = {
  id:    { re: /^[12]\d{9}$/,                   msg: 'رقم الهوية يبدأ بـ 1 أو 2 ويتكوّن من 10 أرقام' },
  phone: { re: /^05\d{8}$/,                     msg: 'الجوال يبدأ بـ 05 ويتكوّن من 10 أرقام' },
  email: { re: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,    msg: 'صيغة البريد الإلكتروني غير صحيحة' },
};

const isBlank = (v) =>
  v === undefined || v === null || v === '' ||
  (Array.isArray(v) && v.length === 0);

/**
 * Checks filled values against the template's field registry.
 * Returns { [fieldKey]: message } — empty when the form may be submitted.
 *
 * Only fields the document actually shows are checked: a template edited to
 * drop a block should not keep failing on a required field nobody can see.
 */
export function validateForm(definition, values = {}, { owner } = {}) {
  const { fields = {}, blocks = [] } = definition || {};
  const shown = visibleFieldKeys(definition);
  const errors = {};

  for (const key of shown) {
    const def = fields[key];
    if (!def) continue;
    const who = fieldOwner(def);
    if (who === 'system') continue;            // answered from the registry
    /* Scoped so the admin is not blocked by a blank the caterer owes, and the
       caterer is not blocked by one the admin left. */
    if (owner && who !== owner) continue;
    const value = values[key];

    if (def.required && isBlank(value)) {
      errors[key] = `${def.label || key} مطلوب`;
      continue;
    }
    if (isBlank(value)) continue;

    const pattern = PATTERNS[def.type];
    if (pattern && !pattern.re.test(String(value))) {
      errors[key] = pattern.msg;
      continue;
    }
    if (def.type === 'number' && isNaN(Number(value))) {
      errors[key] = `${def.label || key} يجب أن يكون رقماً`;
      continue;
    }
    if (def.type === 'table' && def.required && !(Array.isArray(value) && value.length)) {
      errors[key] = `${def.label || key} — أضف صفاً واحداً على الأقل`;
    }
  }

  /* A token pointing at a field that was deleted prints as a raw {{key}} in the
     PDF, so it is an authoring error worth surfacing before assignment. */
  for (const key of tokensIn(blocks)) {
    if (!fields[key]) errors[`__token_${key}`] = `الحقل {{${key}}} مذكور في النص وغير معرَّف`;
  }

  return errors;
}

/** Field keys the rendered document actually puts in front of the user. */
export function visibleFieldKeys(definition) {
  const { blocks = [] } = definition || {};
  const keys = new Set(tokensIn(blocks));
  for (const b of blocks) {
    if (b.type === 'fields') (b.keys || []).forEach(k => keys.add(k));
    if (b.type === 'table' && b.key) keys.add(b.key);
  }
  return keys;
}

/* ── Assignment status ────────────────────────────────────── */
export const FORM_STATUSES = [
  { value: 'pending',   label: 'في الانتظار', color: '#64748B' },
  { value: 'draft',     label: 'مسودة',       color: '#0891B2' },
  { value: 'submitted', label: 'مُسلَّم',      color: '#0D9488' },
  { value: 'accepted',  label: 'مقبول',       color: '#16A34A' },
  { value: 'returned',  label: 'مُعاد للتعديل', color: '#F59E0B' },
];
export const STATUS_META = Object.fromEntries(FORM_STATUSES.map(s => [s.value, s]));

/**
 * Overdue is derived, never stored. "Past its due date" and "submitted but not
 * yet reviewed" are independent facts, and a single status column can only
 * carry one of them.
 */
export function isOverdue(assignment, now = Date.now()) {
  if (!assignment?.dueAt) return false;
  const due = new Date(assignment.dueAt).getTime();
  const settled = ['submitted', 'accepted'].includes(assignment.status);
  const at = settled && assignment.submittedAt
    ? new Date(assignment.submittedAt).getTime()
    : now;
  return at > due;
}

/** Whole days late; 0 when on time. */
export function daysLate(assignment, now = Date.now()) {
  if (!isOverdue(assignment, now)) return 0;
  const due = new Date(assignment.dueAt).getTime();
  const at = assignment.submittedAt ? new Date(assignment.submittedAt).getTime() : now;
  return Math.max(0, Math.floor((at - due) / 86_400_000));
}
