/* Demo mode data layer.
 * When the current user is the demo account (DEMO_EMAIL), all reads from
 * src/lib/db.js are short-circuited and return hardcoded data from here.
 * Writes are silently no-op'd so the viewer can navigate UI flows without
 * mutating real data.
 */

export const DEMO_EMAIL = 'demo@moraqeb.com';

export function isDemoEmail(email) {
  return (email || '').trim().toLowerCase() === DEMO_EMAIL;
}

/* Detect demo session by inspecting the persisted Supabase auth token. */
export function isDemoActive() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__moraqeb_demo_active === true) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes('-auth-token')) {
        const raw = localStorage.getItem(k);
        if (raw && raw.includes(DEMO_EMAIL)) return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

/* Dummy caterers + centers — used by getCenters() and embedded in seeded data. */
export const DEMO_CENTERS = [
  { id: 'مركز 1', caterer: 'شركة الذواقة الذهبية للأغذية' },
  { id: 'مركز 2', caterer: 'مؤسسة نخبة المذاق للإعاشة' },
  { id: 'مركز 3', caterer: 'شركة بستان الطعام لخدمات التغذية' },
  { id: 'مركز 4', caterer: 'مطابخ الواحة الذهبية' },
  { id: 'مركز 5', caterer: 'شركة ضيافة الكرام للوجبات' },
  { id: 'مركز 6', caterer: 'مؤسسة طعام الخير المتكاملة' },
  { id: 'مركز 7', caterer: 'شركة المائدة الراقية لخدمات الإعاشة' },
  { id: 'مركز 8', caterer: 'مطابخ جودة الضيافة العصرية' },
  { id: 'مركز 9', caterer: 'شركة نسائم الزاد لخدمات الأطعمة' },
  { id: 'مركز 10', caterer: 'مؤسسة بهجة المذاق للوجبات' },
  { id: 'مركز 11', caterer: 'شركة فخامة الطهي للإعاشة' },
  { id: 'مركز 12', caterer: 'مطابخ سمو الضيافة المحدودة' },
];

const DEMO_OBSERVERS = [
  'عبدالله الشهري', 'سامي القرني', 'خالد العتيبي', 'فيصل المطيري',
  'ماجد الدوسري', 'بدر الغامدي', 'تركي المالكي', 'حسن الصاعدي',
];

const DEMO_SUPERVISORS = ['عبدالعزيز الحربي', 'فهد الشمري', 'سلطان العتيبي'];

/* Stable UID generator so re-renders return the same ids. */
function uid(i) {
  return `demo-${String(i).padStart(8, '0')}-aaaa-bbbb-cccc-dddddddddddd`;
}

function isoDaysAgo(days = 0, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

/* ---------------- USERS ---------------- */
const DEMO_USERS = [
  {
    uid: uid(1), id_number: '1000000001', email: DEMO_EMAIL, auth_uid: null,
    name: 'حساب العرض التوضيحي', name_ar: 'حساب العرض التوضيحي',
    role: 'admin', center: null, assigned_centers: [], caterer: null,
    role_code: 'ADM-001', bravo_code: 'BRV-001',
    created_at: isoDaysAgo(120),
  },
  ...DEMO_OBSERVERS.map((name, i) => ({
    uid: uid(10 + i), id_number: `200000000${i+1}`, email: null, auth_uid: null,
    name, name_ar: name, role: 'observer',
    center: DEMO_CENTERS[i % DEMO_CENTERS.length].id,
    assigned_centers: [DEMO_CENTERS[i % DEMO_CENTERS.length].id],
    caterer: DEMO_CENTERS[i % DEMO_CENTERS.length].caterer,
    role_code: `OBS-${i+1}`, bravo_code: null,
    created_at: isoDaysAgo(90 - i * 3),
  })),
  ...DEMO_SUPERVISORS.map((name, i) => ({
    uid: uid(30 + i), id_number: `300000000${i+1}`, email: null, auth_uid: null,
    name, name_ar: name, role: 'supervisor',
    center: null,
    assigned_centers: DEMO_CENTERS.slice(i*4, i*4+4).map(c => c.id),
    caterer: null,
    role_code: `SUP-${i+1}`, bravo_code: null,
    created_at: isoDaysAgo(60 - i * 5),
  })),
];

/* ---------------- REPORTS ---------------- */
const REPORT_TYPES = ['نقص نظافة', 'عطل في المعدات', 'مشكلة في الطعام', 'تأخر التقديم', 'سلامة غذائية'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['pending', 'in_progress', 'resolved'];
const DESCRIPTIONS = [
  'وجود نقص واضح في نظافة منطقة الطهي ويستدعي التدخل الفوري',
  'عطل في إحدى مواقد الطهي تم رصده خلال جولة الفحص الميدانية',
  'ملاحظة على درجة حرارة الطعام عند التقديم - تحتاج معالجة',
  'تأخر في تقديم وجبة الغداء عن الموعد المحدد بأكثر من 20 دقيقة',
  'الحاجة لتأمين عبوات تخزين إضافية للوجبات الجاهزة',
];

const DEMO_REPORTS = Array.from({ length: 18 }, (_, i) => {
  const center = DEMO_CENTERS[i % DEMO_CENTERS.length];
  const observer = DEMO_OBSERVERS[i % DEMO_OBSERVERS.length];
  return {
    id: uid(100 + i),
    uid: uid(10 + (i % DEMO_OBSERVERS.length)),
    observer,
    center: center.id,
    caterer: center.caterer,
    report_type: REPORT_TYPES[i % REPORT_TYPES.length],
    severity: SEVERITIES[i % SEVERITIES.length],
    description: DESCRIPTIONS[i % DESCRIPTIONS.length],
    report_number: `BLG-${String(i + 1).padStart(4, '0')}`,
    status: STATUSES[i % STATUSES.length],
    status_since: isoDaysAgo(0, i * 3),
    durations: {},
    closed_at: STATUSES[i % STATUSES.length] === 'resolved' ? isoDaysAgo(0, i) : null,
    images: [],
    video_url: null,
    role: 'observer',
    timestamp: isoDaysAgo(Math.floor(i / 3), (i % 3) * 5),
  };
});

/* ---------------- LOGISTICS REQUESTS ---------------- */
const CATEGORIES = ['أدوات مطبخ', 'مواد تنظيف', 'مواد غذائية جافة', 'معدات تبريد', 'مستلزمات سلامة'];
const LOG_STATUSES = ['pending', 'approved', 'delivered', 'rejected'];

const DEMO_LOGISTICS = Array.from({ length: 15 }, (_, i) => {
  const center = DEMO_CENTERS[i % DEMO_CENTERS.length];
  const observer = DEMO_OBSERVERS[i % DEMO_OBSERVERS.length];
  return {
    id: uid(200 + i),
    uid: uid(10 + (i % DEMO_OBSERVERS.length)),
    observer,
    center: center.id,
    caterer: center.caterer,
    category: CATEGORIES[i % CATEGORIES.length],
    support_type: ['internal', 'external', 'both'][i % 3],
    qty_internal: (i % 3 === 0) ? null : (10 + i),
    qty_external: (i % 3 === 0) ? (5 + i) : null,
    notes: 'طلب توفير المواد المذكورة بشكل عاجل لاستكمال العمليات',
    request_number: `ISN-${String(i + 1).padStart(4, '0')}`,
    report_id: null,
    report_number: null,
    report_type: null,
    status: LOG_STATUSES[i % LOG_STATUSES.length],
    status_since: isoDaysAgo(0, i * 4),
    durations: {},
    closed_at: LOG_STATUSES[i % LOG_STATUSES.length] === 'delivered' ? isoDaysAgo(0, i) : null,
    role: 'observer',
    timestamp: isoDaysAgo(Math.floor(i / 2), (i % 2) * 6),
  };
});

/* ---------------- MEAL EVALUATIONS ---------------- */
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const MEAL_CATEGORIES = ['cooked', 'dry', 'sterilized'];

function makeAnswers(count, failRate = 0.15) {
  const a = {};
  for (let i = 1; i <= count; i++) {
    a[`q${i}`] = Math.random() < failRate ? 'لا' : 'نعم';
  }
  return a;
}

const DEMO_MEAL_EVALS = Array.from({ length: 22 }, (_, i) => {
  const center = DEMO_CENTERS[i % DEMO_CENTERS.length];
  const observer = DEMO_OBSERVERS[i % DEMO_OBSERVERS.length];
  const max = 30;
  const total = max - Math.floor(Math.random() * 8);
  return {
    id: uid(300 + i),
    uid: uid(10 + (i % DEMO_OBSERVERS.length)),
    observer,
    center: center.id,
    caterer: center.caterer,
    meal_type: MEAL_TYPES[i % 3],
    meal_category: MEAL_CATEGORIES[i % 3],
    answers: makeAnswers(15),
    total_score: total,
    max_score: max,
    score_out_of10: +(total / max * 10).toFixed(1),
    percentage: +(total / max * 100).toFixed(0),
    scheduled_date: isoDaysAgo(Math.floor(i / 3)).slice(0, 10),
    timestamp: isoDaysAgo(Math.floor(i / 3), (i % 3) * 4),
  };
});

/* ---------------- MINA & ARAFAT READINESS ---------------- */
function makeReadinessRows(count, idOffset) {
  return Array.from({ length: count }, (_, i) => {
    const center = DEMO_CENTERS[i % DEMO_CENTERS.length];
    const observer = DEMO_OBSERVERS[i % DEMO_OBSERVERS.length];
    const max = 35;
    const total = max - Math.floor(Math.random() * 12);
    return {
      id: uid(idOffset + i),
      uid: uid(10 + (i % DEMO_OBSERVERS.length)),
      observer,
      center: center.id,
      caterer: center.caterer,
      answers: makeAnswers(20, 0.18),
      total_score: total,
      max_score: max,
      score_out_of10: +(total / max * 10).toFixed(1),
      percentage: +(total / max * 100).toFixed(0),
      scheduled_date: isoDaysAgo(Math.floor(i / 2)).slice(0, 10),
      timestamp: isoDaysAgo(Math.floor(i / 2), (i % 2) * 6),
    };
  });
}

const DEMO_MINA = makeReadinessRows(12, 400);
const DEMO_ARAFAT = makeReadinessRows(12, 500);

/* ---------------- MEAL PHASES ---------------- */
const DEMO_PHASES = [];
DEMO_CENTERS.forEach((c, ci) => {
  for (let d = 0; d < 3; d++) {
    MEAL_TYPES.forEach((meal, mi) => {
      const idx = ci * 9 + d * 3 + mi;
      DEMO_PHASES.push({
        id: `${c.id}_2026-12-${String(15 + d).padStart(2, '0')}_${meal}`,
        center: c.id,
        day: `2026-12-${String(15 + d).padStart(2, '0')}`,
        meal_id: meal,
        phase1: idx % 5 === 0 ? null : isoDaysAgo(d, 6),
        phase2: idx % 4 === 0 ? null : isoDaysAgo(d, 4),
        phase3: idx % 3 === 0 ? null : isoDaysAgo(d, 2),
        phase1_photo: null,
        phase2_photo: null,
        phase3_photo: null,
        phase1_uid: uid(10 + (ci % DEMO_OBSERVERS.length)),
        phase2_uid: uid(10 + (ci % DEMO_OBSERVERS.length)),
        phase3_uid: uid(10 + (ci % DEMO_OBSERVERS.length)),
        updated_at: isoDaysAgo(d, 1),
      });
    });
  }
});

/* ---------------- ASSIGNED TASKS ---------------- */
const DEMO_TASKS = Array.from({ length: 8 }, (_, i) => ({
  id: uid(600 + i),
  task_types: [['meal_eval', 'logistics', 'report', 'readiness'][i % 4]],
  meal_types: i % 2 === 0 ? ['breakfast', 'lunch'] : ['dinner'],
  meal_categories: ['cooked'],
  target_nationalities: [],
  target_centers: DEMO_CENTERS.slice(i % 4, (i % 4) + 3).map((_, j) => j + 1),
  scheduled_date: isoDaysAgo(Math.floor(i / 2)).slice(0, 10),
  created_at: isoDaysAgo(Math.floor(i / 2) + 1),
}));

/* ---------------- TASK COMPLETIONS ---------------- */
const DEMO_COMPLETIONS = Array.from({ length: 14 }, (_, i) => ({
  id: uid(700 + i),
  task_id: uid(600 + (i % 8)),
  uid: uid(10 + (i % DEMO_OBSERVERS.length)),
  observer_name: DEMO_OBSERVERS[i % DEMO_OBSERVERS.length],
  center: DEMO_CENTERS[i % DEMO_CENTERS.length].id,
  task_type: ['meal_eval', 'logistics', 'report', 'readiness'][i % 4],
  meal_type: MEAL_TYPES[i % 3],
  meal_category: MEAL_CATEGORIES[i % 3],
  scheduled_date: isoDaysAgo(Math.floor(i / 3)).slice(0, 10),
  timestamp: isoDaysAgo(Math.floor(i / 3), (i % 3) * 2),
}));

/* ---------------- LOOKUP MAP ---------------- */
export const DEMO_TABLES = {
  users:              DEMO_USERS,
  reports:            DEMO_REPORTS,
  logistics_requests: DEMO_LOGISTICS,
  meal_evaluations:   DEMO_MEAL_EVALS,
  mina_readiness:     DEMO_MINA,
  arafat_readiness:   DEMO_ARAFAT,
  meal_phases:        DEMO_PHASES,
  assigned_tasks:     DEMO_TASKS,
  task_completions:   DEMO_COMPLETIONS,
};
