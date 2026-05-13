# MoraqebWeb — Reference Documentation

> مرجع سريع للجلسات القادمة. يغطي التقنيات، هيكلة قاعدة البيانات، نظام الأدوار، والقواعد الثابتة في المشروع.

---

## 1. Stack التقني

| الطبقة | التقنية | الإصدار |
|---|---|---|
| Framework | React + Vite | 18.3.1 / 6.4.2 |
| Routing | React Router DOM | 6.23.1 |
| Styling | Tailwind CSS | 3.4.4 |
| Database | Firebase Firestore | 10.14.1 |
| Auth | Firebase Auth (email/password) | 10.14.1 |
| Storage | Firebase Cloud Storage | 10.14.1 |
| Icons | Lucide React + Phosphor Icons | mixed |
| Animation | Framer Motion | 12.38.0 |
| Charts | Recharts | 3.8.1 |
| PDF | jsPDF v4 + jspdf-autotable v5 | 4.2.1 / 5.0.7 |

**Firebase Project:** `hajj-2026-70c2b`

---

## 2. هيكلة الصفحات والـ Routes

```
src/pages/
├── Login.jsx                    → /login  (public)
├── Home.jsx                     → /home   (observer)
├── Profile.jsx                  → /profile
├── Mealcheck.jsx                → /mealcheck
├── MinaReadiness.jsx            → /mina-readiness
├── ArafatReadiness.jsx          → /arafat-readiness
├── LogisticsRequest.jsx         → /logistics
├── Report.jsx                   → /report
│
├── Supervisor/
│   ├── SupervisorHome.jsx       → /supervisor-home
│   ├── SupMealcheck.jsx         → /sup-mealcheck
│   ├── SupMinaReadiness.jsx     → /sup-mina-readiness
│   ├── SupArafatReadiness.jsx   → /sup-arafat-readiness
│   ├── SupReport.jsx            → /sup-report
│   └── SupLogisticsRequest.jsx  → /sup-logistics
│
└── admin/
    ├── AdminLayout.jsx          → layout wrapper (sidebar)
    ├── AdminDashboard.jsx       → /admin/dashboard
    ├── AdminUsers.jsx           → /admin/users
    ├── AdminTaskAssign.jsx      → /admin/tasks
    ├── AdminReports.jsx         → /admin/reports
    ├── AdminLogistics.jsx       → /admin/logistics
    ├── AdminAnalytics.jsx       → /admin/analytics
    ├── AdminPhases.jsx          → /admin/phases
    ├── AdminNotifications.jsx   → /admin/notifications
    └── AdminReportGenerator.jsx → component داخل AdminDashboard (زر إصدار تقرير)
```

---

## 3. نظام المستخدمين والأدوار

```
AuthContext → onAuthStateChanged → يجيب document من users/{uid}
```

| الدور | القيمة في Firestore | الوصول |
|---|---|---|
| مراقب | `observer` | /home وصفحات الإرسال |
| مشرف | `supervisor` | /supervisor-home وصفحات المراجعة |
| مسؤول | `admin` | /admin/* كامل |

**بنية document المستخدم (users collection):**
```
{
  uid:      string,
  email:    string,
  role:     'observer' | 'supervisor' | 'admin',
  center:   'مركز 40'   ← المركز المُعيَّن (للمراقب/المشرف),
  name:     string,
  createdAt: Timestamp
}
```

**Hook الرئيسي:** `useAuth()` من `src/context/AuthContext.jsx`
```js
const { user, profile, role, logout } = useAuth();
// profile = كامل document المستخدم من Firestore
// role = profile.role
```

**Login flow:** صفحة الدخول تطبّق **role-aware redirect** عبر `loginFlow.current`:
- يختار المستخدم نوع الحساب (مراقب/مشرف) أو يضغط زر "دخول الإدارة" (زر داكن واضح أسفل البطاقة)
- بعد `signInWithEmailAndPassword`، إذا الـ role لا يطابق المسار المختار → `signOut` + رسالة "هذا الحساب غير مسجّل كـ..."
- يمنع المشرف من الدخول كمراقب أو العكس، ويمنع المستخدمين العاديين من استخدام دخول الإدارة

---

## 4. هيكلة Firestore Collections

### `assigned_tasks`
المهام التي يُنشئها الأدمن ويسندها لمراكز معيّنة.
```
{
  id:              auto,
  target_centers:  [40, 41, 42],          ← أرقام المراكز (ints)
  task_types:      ['meal_evaluation', 'mina_readiness', 'arafat_readiness'],
  meal_types:      ['breakfast', 'lunch', 'dinner'],  ← إذا task_types يشمل meal_evaluation
  meal_categories: ['cooked', 'dry', 'sterilized'],   ← أصناف الوجبات (multi-select)
  scheduled_date:  '٨ ذو الحجة ١٤٤٧',
  created_at:      Timestamp
}
```
**استعلام المشرف:** `where('target_centers', 'array-contains', centerNum)`

**meal_categories:**
- `cooked` — وجبة مطبوخة (طبخ موقعي، ٣ مراحل)
- `dry` — وجبة جافة (لا طبخ، **٢ مراحل** فقط)
- `sterilized` — وجبة معقمة (٣ مراحل)
- Multi-select. لو `meal_categories === ['dry']` (جاف فقط)، شاشة التوثيق تُخفي مرحلة الطبخ.

### `task_completions`
سجل تسليم المراقبين/المشرفين للمهام.
```
{
  id:           auto,
  uid:          string,          ← uid المُسلِّم
  center:       'مركز 40',      ← اسم المركز الكامل
  taskId:       string,          ← id من assigned_tasks
  taskType:     'meal_evaluation' | 'mina_readiness' | 'arafat_readiness',
  mealType:     'breakfast' | 'lunch' | 'dinner' | null,
  observerName: string,
  completedAt:  Timestamp
}
```

### `meal_evaluations`
نتائج تقييم جودة الوجبات.
```
{
  uid:            string,
  center:         'مركز 40',
  centerId:       'مركز 40',     ← مكرّر للتوافق التاريخي
  caterer:        string,
  observer:       string,        ← الحقل المعياري للعرض
  observerName:   string,         ← مكرّر للتوافق التاريخي
  mealType:       'breakfast' | 'lunch' | 'dinner',
  mealLabel:      'الإفطار' | 'الغداء' | 'العشاء',
  scheduled_date: '٨ ذو الحجة ١٤٤٧',
  answers:        { 1: 'نعم', 2: 'لا', ... },
  totalScore:     number,        ← مجموع الدرجات المُكتسبة (Number)
  maxScore:       number,        ← السقف الأقصى من src/config/mealQuestions.js
  scoreOutOf10:   number,        ← (totalScore / maxScore) × 10
  percentage:     '85.7',        ← نسبة مئوية كنص (للتوافق)
  taskId:         string,
  status:         'pending',
  role:           'supervisor' | undefined,
  timestamp:      Timestamp
}
```

### `mina_readiness` / `arafat_readiness`
تقارير جاهزية المشاعر.
```
{
  uid:           string,
  center:        'مركز 40',
  caterer:       string,
  observer:      string,
  scheduledDate: '٨ ذو الحجة ١٤٤٧',
  answers:       { 1: 'نعم', 2: 'لا', ... },
  details:       { 14: { fridgeCount: '5', thermosType: 'درفتين' } },  ← لـ yesno_detail/multi_detail
  totalScore:    number,        ← مجموع الدرجات المُكتسبة (Number)
  maxScore:      number,        ← السقف الأقصى من config/{mina,arafat}Questions.js
  scoreOutOf10:  number,        ← (totalScore / maxScore) × 10
  percentage:    number,        ← نسبة 0-100 (Number, ليس string)
  status:        'completed',
  role:          'supervisor' | undefined,
  taskId:        string,
  timestamp:     Timestamp
}
```
> ⚠️ حقل التاريخ هنا `scheduledDate` (بدون underscore) بعكس `meal_evaluations` التي تستخدم `scheduled_date`.

### `reports`
بلاغات الطوارئ.
```
{
  uid:       string,
  center:    'مركز 40',
  status:    'pending' | 'resolved' | 'in_progress',
  timestamp: Timestamp,
  ...تفاصيل البلاغ
}
```

### `logistics_requests`
طلبات الإسناد اللوجستي.
```
{
  uid:       string,
  center:    'مركز 40',
  timestamp: Timestamp,
  ...تفاصيل الطلب
}
```

### `meal_phases`
طوابع زمنية لرفع صور مراحل التحضير (التجهيز/الطبخ/التعبئة).
```
{
  id:            `${center}_d${day}_${mealType}`,
  center:        'مركز 40',
  day:           '8',
  mealType:      'breakfast' | 'lunch' | 'dinner',
  scheduledDate: '٨ ذو الحجة ١٤٤٧',
  observer:      string,
  uid:           string,
  phase1:        Timestamp,      ← مرحلة التجهيز
  phase2:        Timestamp,      ← مرحلة الطبخ (تُتجاهل للجاف)
  phase3:        Timestamp,      ← مرحلة التعبئة والتوزيع
  updatedAt:     Timestamp
}
```

---

## 5. الإعدادات الثابتة وملفات التهيئة

### `src/config/centers.js`
- قائمة كل المراكز: `CENTERS = [{ id: 'مركز 40', caterer: 'اسم المتعهد' }, ...]`
- دوال مساعدة: `getCaterer(centerId)`, `getShakhis(centerId)`, `getLocation(centerId)`
- **40+ مركز** من مركز 5 حتى مركز 102

### `src/config/mealQuestions.js`  *(مصدر موحّد لأسئلة الوجبات)*
```js
export const MEAL_QUESTIONS = [
  { id, category, text, score, negative?, note? },
  ...
];
export const MEAL_MAX_SCORE  = MEAL_QUESTIONS.reduce(...);
export function computeMealScore(answers) { ... }
```
- **35 سؤال** موزعة على 6 أقسام: متطلبات عامة / التخزين / العاملين / التشغيل / الجودة / التوزيع
- درجات: 0.25، 0.50، 1.00 (أو 0 للأسئلة الاسترشادية)
- **negative: true** للأسئلة السلبية → الإجابة بـ"لا" تمنح الدرجة (مثل "هل توجد آثار للفئران؟")
- يستخدمها: `Mealcheck.jsx`, `SupMealcheck.jsx`, `AdminAnalytics.jsx`, `AdminReportGenerator.jsx`

### `src/config/minaQuestions.js`  *(جاهزية منى)*
```js
export const MINA_SECTIONS     = [{ id, title, criteria: [...] }, ...];
export const MINA_ALL_CRITERIA = MINA_SECTIONS.flatMap(s => s.criteria);
```
- **26 بنداً** (مع تخطي البند رقم 4 — سؤال الطاقة الكهربائية المحذوف)
- درجات: 0.25 / 0.50 / 0.75 / 1 / 2 (السقف الكلي ≈ 14، يُطبَّع إلى /10)
- أنواع: `'yesno'`, `'yesno_detail'`, `'choice'`

### `src/config/arafatQuestions.js`  *(جاهزية عرفة)*
```js
export const ARAFAT_SECTIONS     = [{ id, title, criteria: [...] }, ...];
export const ARAFAT_ALL_CRITERIA = ARAFAT_SECTIONS.flatMap(s => s.criteria);
```
- **24 بنداً** (الـ IDs متصلة 1-24، السؤال المحذوف لم يُضف أبداً)
- نفس نظام الدرجات كـ منى
- يدعم `'yesno_multi_detail'` لسؤال الثلاجات/الترامس

### `src/config/readinessScore.js`  *(helper للجاهزية)*
```js
export function computeReadinessTotals(criteria, answers)
// → { totalScore, maxScore, scoreOutOf10, percentage }
```
- يحسب فقط البنود التي `score > 0` (يتجاهل `score: null` الاسترشادية)
- نتيجة `scoreOutOf10` = `(totalScore / maxScore) × 10`
- تُحفظ النتيجة في كل سجل `mina_readiness` / `arafat_readiness` عند الإرسال

### `src/hooks/useAssignedTasks.js`
الـ Hook الأساسي للمراقبين/المشرفين.
```js
export function useAssignedTasks(profile)
// → { tasks, completions, loading }

export function extractCenterNum('مركز 40') // → 40
export function extractDay('٨ ذو الحجة ١٤٤٧') // → '8'
export const MEAL_META = { breakfast, lunch, dinner }  // labels + icons + colors
```

### نظام الألوان (ثابت في كل المشروع)
```js
const BRAND = {
  gold:       '#A98159',   // اللون الرئيسي — الزر والعناوين
  dark:       '#2D2926',   // النص الداكن
  cream:      '#FDF8F0',   // الخلفيات الفاتحة
  border:     '#D1C4B9',   // الحدود
  gray:       '#9D8F85',   // النص الثانوي
  success:    '#386B41',   // أخضر
  error:      '#BA1A1A',   // أحمر
};
```

### أسماء أيام الحج
```js
const DHU_DAYS = [
  '٧ ذو الحجة ١٤٤٧',
  '٨ ذو الحجة ١٤٤٧',
  // ... حتى ١٣
];
```

---

## 6. نظام PDF (AdminReportGenerator)

**الملف:** `src/pages/admin/AdminReportGenerator.jsx`

### الفونت
Cairo TTF مضمّن كـ Base64 في `src/assets/fonts/CairoFont.js`
- يُجدَّد بـ: `node scripts/downloadCairoFont.mjs`

### الشعار
**الملف:** `src/assets/logo-color.svg` (تصميم ملوّن landscape، viewBox 600×378.6)
- يُحوَّل تلقائياً إلى PNG عبر canvas في `getLogoDataUrl()`
- يُكبَّر بمعامل ×4 قبل rasterize للحصول على دقة عالية في الـ PDF
- ثوابت احتياطية `LOGO_FALLBACK_W/H` للمتصفحات اللي ترجع `naturalWidth=0` للـ SVG

### Arabic Reshaping
**دالة `fixArabic()`** — مُصدَّرة من نفس الملف:
- تُعيد تشكيل الحروف العربية إلى Presentation Forms-B (U+FE70–U+FEFF)
- تعكس ترتيب الكلمات والأحرف لـ jsPDF (LTR renderer)
- **لازم تمرر كل نص عربي عليها قبل `doc.text()` أو autoTable**

**`toArabicNum(input)`** — يحوّل الأرقام اللاتينية (`25`) لعربية-هندية (`٢٥`) للاتساق البصري.

**`wrapArabicLines(doc, text, maxWidth)`** — يلف النص العربي على عدة أسطر بشكل صحيح:
- يحسب العرض على شكل الـ **presentation forms** (بعد reshape) لا اللوغاريتمي
- يعيد مصفوفة أسطر، كل سطر معكوس الترتيب جاهز للرسم
- **لازم font + size محدّدين قبل الاستدعاء** (يستخدم `doc.getTextWidth`)

### ⚠️ تعطيل auto-Arabic في jsPDF (إجباري!)
jsPDF يشغّل خط Arabic shaper (`processArabic`) و BiDi reorderer تلقائياً على كل `doc.text()`. هذا **يكسر** نصنا الـ pre-shaped (يحوّل ا → FE8E ثم يدمج ﻟا → ﻻ ligature خاطئة، و BiDi يعكس الترتيب).

في بداية `buildPDF()` بعد تسجيل الفونت:
```js
doc.processArabic = (t) => t;          // no-op للـ getStringUnitWidth
const topics = doc.internal.events.getTopics();
for (const tok of Object.keys(topics.preProcessText || {}))
  doc.internal.events.unsubscribe(tok);  // إزالة processArabic
for (const tok of Object.keys(topics.postProcessText || {})) {
  const cb = topics.postProcessText[tok][0];
  if (cb && cb.toString().includes('doBidiReorder'))
    doc.internal.events.unsubscribe(tok);  // إزالة bidiEngineFunction
}
// إبقاء utf8EscapeFunction (لازم للترميز السليم في PDF)
```

### ترتيب حرج في `buildPDF()`
```js
// 1. سجّل الفونت أولاً — قبل أي doc.text()
doc.addFileToVFS('Cairo-Regular.ttf', cairoBase64);
doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
doc.setFont('Cairo', 'normal');

// 2. عطّل auto-Arabic + BiDi (كما أعلاه)

// 3. حمّل الشعار عبر canvas
const logoDataUrl = await getLogoDataUrl();

// 4. ارسم الصفحات بعدها
```

### API جدول autoTable (v5)
```js
// صح ✓
import { default as autoTable } from 'jspdf-autotable';
autoTable(doc, { head: [...], body: [...], ... });

// غلط ✗
doc.autoTable({ ... });
```

### وضع التقرير المفصّل (Detailed Mode)
الـ Modal فيه زرّان:
1. **«مع التفاصيل»** (أبيض بإطار داكن) → `buildPDF({ detailed: true })`
2. **«إنشاء وتنزيل تقرير PDF»** (ذهبي، الافتراضي) → `buildPDF({ detailed: false })`

في وضع `detailed`، بعد جدول كل مركز/نوع، يُضاف قسم **"التفاصيل الفردية"**:
- شريط ملوّن بعنوان "التفاصيل الفردية — N سجل"
- لكل سجل بطاقة تحوي:
  - صف عنوان: المراقب + شارة الدرجة `X.X / 10` بلون التبويب
  - شبكة عمودين: المركز، المتعهد، التاريخ، الوجبة (للوجبات)، وقت الإرسال
  - صندوق أحمر: "الأسئلة المُجابة بـ«لا» (N)" + قائمة كاملة بنصوص الأسئلة
  - صندوق أخضر: "لا توجد أسئلة مُجابة بـ«لا» في هذا السجل" (إن لم توجد مخالفات)

أسئلة المخالفات تُجلب من `QUESTION_BANK` map:
```js
const QUESTION_BANK = {
  meal_evaluations: MEAL_QUESTIONS,
  mina_readiness:   MINA_ALL_CRITERIA,
  arafat_readiness: ARAFAT_ALL_CRITERIA,
};
```

### `getRecordScore(rec)` — تطبيع الدرجة على /10
يدعم 3 طرق للاسترجاع (fallback chain):
```js
if (rec.scoreOutOf10 != null) return Number(rec.scoreOutOf10);
if (rec.maxScore > 0)         return (totalScore / maxScore) × 10;
if (rec.percentage)           return parseFloat(rec.percentage) / 10;
return null;
```

---

## 7. قواعد ثابتة لازم تتبعها

### تصميم
- كل الواجهة **عربي — RTL**، ضع `dir="rtl"` على containers الرئيسية
- استخدم ألوان الـ Brand الثابتة فوق — لا تخترع ألوان جديدة
- Rounded corners: `rounded-2xl` للبطاقات، `rounded-xl` للأزرار الصغيرة
- Shadows: `shadow-[0_4px_16px_rgba(169,129,89,0.35)]` للأزرار الذهبية

### Firebase
- **real-time data:** استخدم `onSnapshot` دائماً للبيانات اللي تحتاج تتحدث تلقائياً
- **one-time reads:** استخدم `getDocs` فقط عند الجلب الأولي أو للـ export
- عند حذف `assigned_task` من الأدمن، المراقب والمشرف يشوفون التغيير تلقائياً (onSnapshot يستقبل الحذف)
- الاستعلام عن المراكز: `where('target_centers', 'array-contains', centerNum)` — centerNum رقم int

### Field-name conventions (مهم — تاريخياً غير متسق)
- **center vs centerId:** المعياري `center`. الكود الجديد يحفظ `center` (و `centerId` للتوافق). القراءة تستخدم `d.center || d.centerId`.
- **observer vs observerName:** المعياري `observer`. الكود الجديد يحفظ كليهما. القراءة `d.observer || d.observerName`.
- **scheduled_date vs scheduledDate:** `meal_evaluations` تستخدم `scheduled_date` (snake_case)، الجاهزية تستخدم `scheduledDate` (camelCase). انتبه!
- في `AdminAnalytics.jsx` يوجد `getObserver()` و `getCenter()` helpers ينظّفوا الاختلاف.

### المراقب (Mealcheck)
- مراحل التحضير ٣ افتراضياً: التجهيز / الطبخ / التعبئة والتوزيع
- إذا `assignedTask.meal_categories === ['dry']` (جاف فقط) → **٢ مراحل** (يُخفى الطبخ)
- `buildPhases(categories)` يقرّر القائمة الديناميكية
- رقم الخطوة المعروض = `idx + 1` (مش `phase.id` — مهم لأن الجاف يستخدم IDs 1,3)
- الـ unlock check: `phaseDone[phases[idx - 1].id]` (مش `phaseDone[idx]`)

### المشرف (Supervisor)
- `selectedCenter` هو النص الكامل: `'مركز 40'`
- `extractCenterNum('مركز 40')` → `40` للاستعلامات اللي تحتاج رقم
- بيانات الجرس تُحسب من `assignedForCenter × completionsForCenter`
- قائمة الإشعارات منبثقة (dropdown) — استخدم z-index منخفض (z-[40]) للـ click-catcher بحيث الـ header (z-50) يبقى فوقه

### PDF
- **كل نص عربي** يمر على `fixArabic()` قبل الرسم
- `halign: 'right'` على كل أعمدة autoTable
- `font: 'Cairo'` + **`fontStyle: 'normal'`** في كل `styles` / `headStyles` / `columnStyles`
  - ⚠️ `fontStyle: 'bold'` يفشل (Cairo-Bold غير مسجّل) ويسبب fallback لـ Helvetica → garbled bytes
- الشعار: لا تمرر URL مباشرة لـ `addImage` — استخدم `getLogoDataUrl()` (canvas → base64)
- جداول العمود الواحد: حدّد `tableWidth: CW` + `columnStyles.cellWidth: CW` صراحةً ليفعل `overflow: 'linebreak'`
- استخدم `toArabicNum()` للأرقام في النص العربي للاتساق
- استخدم `wrapArabicLines()` بدل `splitTextToSize` للنصوص العربية الطويلة

### Git
- **Branch النشط:** `omarV2` — كل التعديلات تروح عليه

---

## 8. لوحة التحكم (التقييمات)

`AdminAnalytics.jsx` تعرض ٣ تبويبات: تقييم الوجبات / جاهزية منى / جاهزية عرفة.

**كل التبويبات الآن `hasScore: true`** — تعرض شارة `X.X / 10` بجانب المراقب + بطاقة "متوسط الدرجة" + مخطط "اتجاه الدرجات" + شريط "الدرجة الإجمالية" داخل التفاصيل.

**Helpers الموحّدة:**
- `getScore(doc)` — يطبّع الدرجة على /10 (يدعم 3 fallbacks)
- `getObserver(doc) = doc.observer || doc.observerName || '—'`
- `getCenter(doc)   = doc.center   || doc.centerId     || '—'`

---

## 9. تدفق العمل السريع

```
Admin ينشئ مهمة في AdminTaskAssign
  → assigned_tasks collection
  → target_centers: [40, 41]
  → meal_categories: ['cooked', 'dry']  (للوجبات)

المراقب في مركز 40 يفتح Home.jsx
  → useAssignedTasks يجيب المهام (onSnapshot)
  → يظهر له قائمة المهام المطلوبة

المراقب يسلّم مهمة (Mealcheck مثلاً)
  → buildPhases(task.meal_categories) يقرّر 2 أو 3 مراحل
  → يرفع صور المراحل → meal_phases
  → يجيب على QUESTIONS من mealQuestions.js
  → computeMealScore(answers) → totalScore + maxScore + scoreOutOf10
  → يكتب في meal_evaluations + task_completions

المشرف في SupervisorHome
  → يشوف task_completions للمركز المختار (onSnapshot)
  → يشوف أي مهام اكتملت وأي منها معلقة في الجرس
  → بيقدر يسلّم نفس المهام عبر صفحات Sup*

Admin يحذف assigned_task
  → اختفى تلقائياً من المراقب والمشرف (onSnapshot)

Admin يضغط "إصدار تقرير" → AdminReportGenerator
  → يختار المركز/اليوم/الأنواع
  → زر «إنشاء تقرير» (ذهبي) → PDF ملخّص
  → زر «مع التفاصيل» (داكن) → PDF مفصّل لكل سجل مع أسئلة المخالفات
```

---

*آخر تحديث: مايو ٢٠٢٦ — جلسة meal_categories + التقرير المفصّل + الشعار الجديد + إصلاح Arabic shaping*
