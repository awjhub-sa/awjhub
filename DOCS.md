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

---

## 4. هيكلة Firestore Collections

### `assigned_tasks`
المهام التي يُنشئها الأدمن ويسندها لمراكز معيّنة.
```
{
  id:             auto,
  target_centers: [40, 41, 42],  ← أرقام المراكز (ints)
  task_types:     ['meal_evaluation', 'mina_readiness', 'arafat_readiness'],
  meal_types:     ['breakfast', 'lunch', 'dinner'],  ← فقط إذا task_types يشمل meal_evaluation
  scheduled_date: '٨ ذو الحجة ١٤٤٧',
  created_at:     Timestamp
}
```
**استعلام المشرف:** `where('target_centers', 'array-contains', centerNum)`

### `task_completions`
سجل تسليم المراقبين للمهام.
```
{
  id:           auto,
  uid:          string,          ← uid المراقب
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
  observer:       string,       ← اسم المراقب
  mealType:       'breakfast' | 'lunch' | 'dinner',
  scheduled_date: '٨ ذو الحجة ١٤٤٧',
  answers:        { q1: 'نعم', q2: 'لا', ... },
  percentage:     number,       ← نسبة مئوية (0-100)
  timestamp:      Timestamp
}
```

### `mina_readiness` / `arafat_readiness`
تقارير جاهزية المشاعر.
```
{
  uid:           string,
  center:        'مركز 40',
  observer:      string,
  scheduledDate: '٨ ذو الحجة ١٤٤٧',
  answers:       { q1: 'نعم', q2: 'لا', ... },
  status:        'completed',
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

---

## 5. الإعدادات الثابتة

### `src/config/centers.js`
- قائمة كل المراكز: `CENTERS = [{ id: 'مركز 40', caterer: 'اسم المتعهد' }, ...]`
- دوال مساعدة: `getCaterer(centerId)`, `getShakhis(centerId)`, `getLocation(centerId)`
- **40+ مركز** من مركز 5 حتى مركز 102

### `src/hooks/useAssignedTasks.js`
الـ Hook الأساسي للمراقبين.
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

**الفونت:** Cairo TTF مضمّن كـ Base64 في `src/assets/fonts/CairoFont.js`
- يُجدَّد بـ: `node scripts/downloadCairoFont.mjs`

**دالة fixArabic()** — مُصدَّرة من نفس الملف:
- تُعيد تشكيل الحروف العربية إلى Presentation Forms-B
- تعكس ترتيب الكلمات والأحرف لـ jsPDF (LTR renderer)
- **لازم تمرر كل نص عربي عليها قبل doc.text() أو autoTable**

**ترتيب حرج في buildPDF():**
```js
// 1. سجّل الفونت أولاً — قبل أي doc.text()
doc.addFileToVFS('Cairo-Regular.ttf', cairoBase64);
doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
doc.setFont('Cairo', 'normal');

// 2. حمّل الشعار عبر canvas
const logoDataUrl = await getLogoDataUrl();

// 3. رسم الصفحات بعدها
```

**API جدول autoTable (v5):**
```js
// صح ✓
import { default as autoTable } from 'jspdf-autotable';
autoTable(doc, { head: [...], body: [...], ... });

// غلط ✗
doc.autoTable({ ... });
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

### المشرف (Supervisor)
- `selectedCenter` هو النص الكامل: `'مركز 40'`
- `extractCenterNum('مركز 40')` → `40` للاستعلامات اللي تحتاج رقم
- بيانات الجرس تُحسب من `assignedForCenter × completionsForCenter`

### PDF
- **كل نص عربي** يمر على `fixArabic()` قبل الرسم
- `halign: 'right'` على كل أعمدة autoTable
- `font: 'Cairo'` في كل `styles`, `headStyles`, `bodyStyles`
- الشعار: لا تمرر URL مباشرة لـ `addImage` — استخدم `getLogoDataUrl()` (canvas → base64)

### Git
- **Branch النشط:** `omarV2` — كل التعديلات تروح عليه

---

## 8. تدفق العمل السريع

```
Admin ينشئ مهمة في AdminTaskAssign
  → assigned_tasks collection
  → target_centers: [40, 41]

المراقب في مركز 40 يفتح Home.jsx
  → useAssignedTasks يجيب المهام (onSnapshot)
  → يظهر له قائمة المهام المطلوبة

المراقب يسلّم مهمة (Mealcheck مثلاً)
  → يكتب في meal_evaluations
  → يكتب في task_completions

المشرف في SupervisorHome
  → يشوف task_completions للمركز المختار (onSnapshot)
  → يشوف أي مهام اكتملت وأي منها معلقة في الجرس

Admin يحذف assigned_task
  → اختفى تلقائياً من المراقب والمشرف (onSnapshot)
```

---

*آخر تحديث: مايو ٢٠٢٦ — جلسة بناء PDF Generator + Arabic Reshaper*
