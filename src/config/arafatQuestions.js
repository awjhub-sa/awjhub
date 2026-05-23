/**
 * مصدر موحّد لأسئلة جاهزية مشعر عرفة.
 * تستخدم في:
 *   • src/pages/ArafatReadiness.jsx                (مراقب)
 *   • src/pages/Supervisor/SupArafatReadiness.jsx  (مشرف)
 *   • src/pages/admin/AdminAnalytics.jsx           (تفاصيل التقييم)
 *
 * الحقول:
 *   id          — رقم البند (متطابق مع البيانات التاريخية)
 *   text        — نص السؤال
 *   score       — الدرجة المخصصة. null تعني "بند استرشادي" (لا يُحتسب)
 *   type        — 'yesno' | 'yesno_detail' | 'yesno_multi_detail' | 'choice'
 *   choices     — لـ type='choice'
 *   detailLabel — لـ type='yesno_detail'
 *   fields      — لـ type='yesno_multi_detail' (مصفوفة حقول)
 *
 * الدرجة الإجمالية تُعرض على /10 بعد التطبيع عبر
 * computeReadinessTotals (src/config/readinessScore.js).
 *
 * ملاحظة: سؤال «الطاقة الكهربائية والأحمال» محذوف عمداً ولم يضف
 * أبداً إلى الكود (لذلك الـ IDs متصلة 1-24 بدون فجوة).
 */

/* ⚠ ملاحظة هامة: تم إعادة ترقيم الأسئلة بالكامل (1–24 متسلسلة) لتطابق
   ترتيب العرض الجديد. التقييمات السابقة المحفوظة في القاعدة قد تعرض
   نص السؤال الخاطئ لو تم استعراضها في AdminAnalytics لأن مفاتيح
   answers بالـ IDs القديمة. الموسم لم يبدأ فعلياً فالتأثير محدود. */
export const ARAFAT_SECTIONS = [
  {
    id: 'general',
    title: 'متطلبات عامة',
    criteria: [
      { id: 1, text: 'هل الطبخ داخل المخيم في مطبخ واحد أم في عدة مطابخ؟', score: null, type: 'choice', choices: ['مطبخ واحد', 'مطبخين', '3 مطابخ', '4 مطابخ أو أكثر'] },
      { id: 2, text: 'هل تم غسيل المطبخ (الحوائط / المداخن / مروح الشفط / الأرضيات) بشكل عام؟', score: 0.25, type: 'yesno' },
      { id: 3, text: 'هل يوجد مصادر مياه متوفرة داخل المطبخ مع توفر المياه داخل الخزان الإحتياطي؟', score: null, type: 'yesno' },
      { id: 4, text: 'هل يوجد ملصقات توعوية عن سلامة الغذاء داخل المطبخ؟', score: 1,    type: 'yesno' },
      { id: 5, text: 'هل صواعق الحشرات الكهربائية نظيفة وتعمل؟', score: 0.25, type: 'yesno' },
      { id: 6, text: 'هل تم توفير دولاب مخصص للأغراض الشخصية للعاملين؟', score: null, type: 'yesno' },
      { id: 7, text: 'هل تم وضع المستندات الرسمية للمنشأة في لوحة ظاهرة داخل المطبخ؟', score: 0.25, type: 'yesno' },
      { id: 8, text: 'هل تم وضع قائمة الوجبات الغذائية (المنيو) بلغة الحاج في لوحة المعلومات طيلة فترة الموسم؟', score: 1, type: 'yesno', requiresPhoto: true },
      { id: 9, text: 'هل تم وضع مواعيد توزيع الوجبات الغذائية بلغة الحاج في لوحة المعلومات طيلة فترة الموسم؟', score: 1, type: 'yesno' },
    ],
  },
  {
    id: 'technical',
    title: 'متطلبات فنية',
    criteria: [
      { id: 10, text: 'هل مواقد الطبخ متناسبة لعمليات الطبخ من حيث الإنشاء وتم تجربتها؟', score: 1, type: 'yesno' },
      { id: 11, text: 'هل تم توفير فلتر للمياه (فلتر ثلاثي) داخل المطبخ؟', score: 0.75, type: 'yesno' },
      { id: 12, text: 'هل تم توفير معدات وأدوات الطبخ (القدور – مواد التعبئة – المواد الغذائية – الحطب)؟', score: 0.50, type: 'yesno' },
      { id: 13, text: 'هل تم توفير حافظات (غرف الثلج)؟', score: 0.25, type: 'yesno' },
      { id: 14, text: 'هل تم توفير كميات كافية من الثلج داخل حافظة الثلج؟', score: 0.50, type: 'yesno', requiresPhoto: true },
      {
        id: 15,
        text: 'هل تم توفير (ثلاجات / ترامس) لتبريد مياه الشرب داخل المخيم؟',
        score: null,
        type: 'yesno_multi_detail',
        fields: [
          { key: 'fridgeCount', label: 'عدد الثلاجات / الترامس',                                  type: 'number' },
          { key: 'thermosType', label: 'نوع الثلاجات: درفة أو درفتين (إذا كانت ترامس اكتب «ترامس»)', type: 'text'   },
        ],
      },
      { id: 16, text: 'هل تم تحديد موقع مهيأ/مخصص لتخزين المواد الغذائية؟', score: null, type: 'yesno' },
      { id: 17, text: 'هل جميع المنتجات المستخدمة بها بطاقة تعريف المنتج (وصف المنتج – تاريخ الصلاحية – بلد المصدر – مسببات الحساسية – شروط النقل والتخزين)؟', score: 0.25, type: 'yesno' },
      { id: 18, text: 'هل يتم تخزين المواد الغذائية بطريقة آمنة وسليمة؟', score: 0.25, type: 'yesno', requiresPhoto: true },
      { id: 19, text: 'هل تم توفير مياه للشرب بشكل كافٍ داخل الموقع (علب – ريطات / شرنكات)؟', score: 2, type: 'yesno', requiresPhoto: true },
      { id: 20, text: 'هل تم توفير المواد الأساسية الغذائية من المتعهد (المواد الخام + البروتين)؟', score: 2, type: 'yesno', requiresPhoto: true },
      { id: 21, text: 'هل يوجد داخل الموقع مستودع (غرفة) تبريد مهيأة وجاهزة للاستخدام؟', score: null, type: 'yesno' },
      { id: 22, text: 'هل تم توفير مستودع منفصل مطابق للإشتراطات لتخزين الحطب؟', score: null, type: 'yesno' },
      { id: 23, text: 'هل الحطب متوفر بكميات كافية؟', score: 1, type: 'yesno', requiresPhoto: true },
      { id: 24, text: 'هل تم توفير الوجبات الجافة بكميات كافية (وجبات احتياطية)؟', score: 1, type: 'yesno' },
    ],
  },
];

export const ARAFAT_ALL_CRITERIA = ARAFAT_SECTIONS.flatMap(s => s.criteria);
