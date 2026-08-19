/**
 * src/config/standardForms.js
 *
 * The forms every Hajj company asks its caterers for. They ship with the system
 * as `is_standard` templates so a new customer copies and edits rather than
 * starting from a blank page.
 *
 * These are seed data, not code the app reads at runtime: scripts/seedForms.mjs
 * writes them into form_templates, and from then on the admin screens own them.
 * Editing a template in the UI does not touch this file, which is deliberate —
 * one customer's changes must not become every customer's changes.
 */


/* ── The ministry sheet ───────────────────────────────────── */
/**
 * محضر تأكيد جاهزية تقديم خدمة الإعاشة — the readiness minute signed by the
 * service company and the caterer before the season opens.
 *
 * This one is reproduced, not designed. It is the ministry's sheet: a four
 * column ruled grid where the label cells are pale green and the values white,
 * and an inspector reads it by its shape as much as its words. So it is built
 * from `grid` rows that mirror the paper line for line, rather than from the
 * prose blocks the company's own letters use.
 *
 * What the system contributes is the filling, not the form: fourteen of its
 * blanks are already on record and arrive answered and locked, and the day and
 * date are taken from the clock when the minute is filled — which is the pair
 * people most often write inconsistently by hand.
 */

const READINESS_ITEMS = [
  'توفير عدد العاملين المرخص لهم للعمل بالمشاعر المقدسة لقطاع الإعاشة',
  'جاهزية مواقد الطبخ',
  'جاهزية خزانات الكيروسين',
  'جاهزية تمديدات المياه',
  'توفر مخزون الحطب (بمشعر عرفات)',
  'توفر المواد الغذائية',
  'توفر التجهيزات ومعدات الطبخ',
  'التحقق من كفاءة التشغيل وجاهزية المواقع وعدم وجود أي معوقات',
];

const READY_OPTIONS = ['جاهز', 'غير جاهز', 'لا ينطبق'];

/* The heading the sheet gives these blanks. Written once so the assignment
   screen and the document cannot disagree about what they are. */
const REP_GROUP = 'بيانات الأطراف · ممثل شركة تقديم الخدمة';

/* The answers the minute normally carries, proposed rather than assumed: they
   arrive filled and the company may change any of them before it sends the
   form. Item 3 is 'لا ينطبق' because kerosene tanks are not used, and item 5
   only applies at عرفات — a Mina minute answers it the same way for the same
   reason. */
const readyNotes = {
  6: 'مخزن في مستودعات المتعهدين لتجنب سوء تخزينها في المشاعر',
  8: 'المواقع جاهزة',
};

const readyDefaults = (mina) => ({
  1: 'جاهز',
  2: 'جاهز',
  3: 'لا ينطبق',
  4: 'جاهز',
  5: mina ? 'لا ينطبق' : 'جاهز',
  6: 'جاهز',
  7: 'جاهز',
  8: 'جاهز',
});

/* Cell shorthands — they let a row below read the way the row reads on paper. */
const lbl  = (text, extra = {}) => ({ text, tone: 'label', ...extra });
const val  = (field, extra = {}) => ({ field, ...extra });
const bar  = (text) => ({ cells: [{ text, tone: 'label', span: 4, align: 'center' }] });
const pair = (l1, f1, l2, f2) => ({ cells: [lbl(l1), val(f1), lbl(l2), val(f2)] });

function readinessMinute(site) {
  const mina = site === 'منى';
  const other = mina ? 'عرفات' : 'منى';
  const tick = (col) => ({ text: col === site ? '☑' : '', align: 'center' });

  return {
    key: `readiness_minutes_${mina ? 'mina' : 'arafat'}`,
    title: `محضر تأكيد جاهزية تقديم خدمة الإعاشة (${site})`,
    category: 'تشغيلي',
    description:
      `نموذج الوزارة بتصميمه الأصلي. يوقّعه ممثل شركة تقديم الخدمة وممثل مزود الإعاشة، ويثبت جاهزية مواقع الإعاشة بمشعر ${site} بنداً بنداً.`,
    requiresSignature: true,
    requiresAttachment: false,

    definition: {
      /* The sheet is the whole document: no letterhead of ours above it. */
      chrome: 'none',
      /* One minute per centre. It prints that centre's shakhis, its pilgrim
         count and its head by name, so a copy assigned to a caterer rather
         than to a centre is a sheet that cannot be completed — the blanks have
         nothing to resolve against. The assignment screen enforces it. */
      scope: 'center',
      blocks: [
        {
          id: 'sheet',
          type: 'grid',
          widths: ['17%', '41%', '21%', '21%'],
          rows: [
            { cells: [{ span: 4, tone: 'label', align: 'center', lines: [
              'محضر تأكيد جاهزية تقديم خدمة الإعاشة',
              'بين شركة تقديم الخدمة',
              'ومزود خدمة الإعاشة',
              'لموسم حج عام {{hijri_year}}هـ',
            ] }] },

            { cells: [lbl('اليوم'), val('minute_weekday'), lbl('التاريخ'), val('minute_date')] },

            bar('بيانات المشعر'),
            /* Both معشر are printed and one is ticked, exactly as on the sheet:
               the paper carries the choice, and a minute that silently dropped
               the unticked one would not be the ministry's form. */
            { cells: [
              lbl('اسم المشعر', { rowspan: 2 }),
              { text: mina ? site : other, tone: 'label', align: 'center' },
              { text: mina ? other : site, tone: 'label', align: 'center', span: 2 },
            ] },
            { cells: [tick(mina ? site : other), { ...tick(mina ? other : site), span: 2 }] },

            bar('بيانات مزود خدمة الإعاشة'),
            pair('رقم السجل التجاري', 'cr_number', 'رقم الرخصة', 'municipal_license'),
            pair('رقم التواصل', 'caterer_phone', 'اسم المتعهد', 'caterer_name'),
            { cells: [lbl('العنوان الرئيسي'), val('caterer_address', { span: 3 })] },

            bar('بيانات شركة تقديم الخدمة'),
            pair('رقم الترخيص', 'facility_license', 'اسم المنشأة', 'facility_name'),
            pair('رقم المربع', 'murabba', 'رقم مركز الضيافة', 'center_code'),
            pair('رقم الشاخص', 'shakhis', 'عدد الحجاج', 'pilgrims_count'),
            pair('اسم رئيس المركز', 'center_head_name', 'رقم التواصل', 'center_head_phone'),

            bar('جاهزية مواقع الإعاشة'),
            { cells: [lbl('م'), lbl('البند'), lbl('جاهز / غير جاهز'), lbl('الملاحظات')] },
            ...READINESS_ITEMS.map((item, i) => ({ cells: [
              { text: String(i + 1), align: 'center' },
              { text: item, align: 'right' },
              val(`item${i + 1}_status`),
              val(`item${i + 1}_note`),
            ] })),

            bar('بيانات الأطراف'),
            { cells: [
              lbl('#'),
              lbl('ممثل شركة تقديم الخدمة'),
              lbl('ممثل مزود خدمة الإعاشة', { span: 2 }),
            ] },
            { cells: [lbl('الاسم الرباعي'), val('company_rep_name'), val('caterer_rep_name', { span: 2 })] },
            { cells: [lbl('الصفة'),        val('company_rep_title'), val('caterer_rep_title', { span: 2 })] },
            { cells: [lbl('رقم الهوية'),   val('company_rep_id'),    val('caterer_rep_id', { span: 2 })] },
            { cells: [
              lbl('التوقيع'),
              { sig: ['company_signature'], owner: 'admin' },
              { sig: ['caterer_signature', 'caterer_stamp'], owner: 'caterer', span: 2 },
            ] },
            { cells: [lbl('التاريخ'), val('company_sign_date'), val('caterer_sign_date', { span: 2 })] },
          ],
        },
      ],

      fields: {
        hijri_year:     { label: 'السنة',   type: 'text', source: 'hijri_year', readonly: true },
        /* Taken from the clock as the minute is filled, so the weekday and the
           date can never contradict each other. */
        minute_weekday: { label: 'اليوم',   type: 'text', source: 'weekday', readonly: true },
        /* Gregorian, as the paper is. The rest of the app prints Hijri. */
        minute_date:    { label: 'التاريخ', type: 'date', source: 'today', calendar: 'gregorian', readonly: true },

        /* On record in the caterer registry. */
        caterer_name:      { label: 'اسم المتعهد',       type: 'text',  source: 'caterer.name',              readonly: true },
        cr_number:         { label: 'رقم السجل التجاري', type: 'text',  source: 'caterer.cr_number',         readonly: true },
        municipal_license: { label: 'رقم الرخصة',        type: 'text',  source: 'caterer.municipal_license', readonly: true },
        caterer_phone:     { label: 'رقم التواصل',       type: 'phone', source: 'caterer.owner_phone',       readonly: true },
        caterer_address:   { label: 'العنوان الرئيسي',   type: 'text',  source: 'caterer.address',           readonly: true },

        /* On record against the center for this season. */
        /* The service company's own operating identity, stated once in
           «هوية الشركة» and the same on every centre's minute. */
        facility_license: { label: 'رقم الترخيص', type: 'text', source: 'company.license_number', readonly: true },
        facility_name:    { label: 'اسم المنشأة', type: 'text', source: 'company.facility_name',  readonly: true },
        murabba:          { label: 'رقم المربع',  type: 'text', source: 'company.murabba',        readonly: true },

        /* On record against the centre for this season. */
        center_code:       { label: 'رقم مركز الضيافة', type: 'text',   source: 'center.code',             readonly: true },
        shakhis:           { label: 'رقم الشاخص',       type: 'text',   source: `center.shakhis_${mina ? 'mina' : 'arafat'}`, readonly: true },
        pilgrims_count:    { label: 'عدد الحجاج',       type: 'number', source: 'center.pilgrims_count',   readonly: true },
        center_head_name:  { label: 'اسم رئيس المركز',  type: 'text',   source: 'center.head_name',        readonly: true },
        center_head_phone: { label: 'رقم التواصل',      type: 'phone',  source: 'center.head_phone',       readonly: true },

        /* The eight answers are settled: this minute always carries them, so
           they are printed rather than asked for. Nobody retypes a constant
           eight times a season, and nobody mistypes it either. */
        ...Object.fromEntries(READINESS_ITEMS.flatMap((item, i) => [
          [`item${i + 1}_status`, { label: item, type: 'select', options: READY_OPTIONS, owner: 'system', default: readyDefaults(mina)[i + 1] }],
          [`item${i + 1}_note`,   { label: `ملاحظات البند ${i + 1}`, type: 'text', owner: 'system', default: readyNotes[i + 1] }],
        ])),

        /* Who signs for each side. `group` is the heading these blanks are
           gathered under wherever they are asked for, so whoever fills them in
           knows which party they are describing — the labels alone read the
           same for both sides of the sheet. */
        company_rep_name:  { label: 'الاسم الرباعي', type: 'text', owner: 'admin', required: true, group: REP_GROUP },
        company_rep_title: { label: 'الصفة',         type: 'text', owner: 'admin', group: REP_GROUP },
        company_rep_id:    { label: 'رقم الهوية',    type: 'id',   owner: 'admin', group: REP_GROUP },
        company_signature: { label: 'التوقيع',       type: 'file', owner: 'admin', group: REP_GROUP },
        company_sign_date: { label: 'التاريخ',       type: 'date', source: 'today', calendar: 'gregorian', readonly: true },

        /* Read from the caterer registry and locked. The caterer is not asked
           to retype what the company already holds about them; they add a
           signature and a stamp, and nothing else. */
        caterer_rep_name:  { label: 'الاسم الرباعي', type: 'text', source: 'caterer.owner_name',      readonly: true },
        caterer_rep_title: { label: 'الصفة',         type: 'text', source: 'caterer.owner_capacity',  readonly: true },
        caterer_rep_id:    { label: 'رقم الهوية',    type: 'id',   source: 'caterer.owner_id_number', readonly: true },
        caterer_sign_date: { label: 'التاريخ',       type: 'date', source: 'today', calendar: 'gregorian', readonly: true },

        /* All the caterer owes, and all they may touch. */
        caterer_signature: { label: 'التوقيع', type: 'file', owner: 'caterer', required: true },
        caterer_stamp:     { label: 'الختم',   type: 'file', owner: 'caterer', required: true },
      },
    },
  };
}

export const STANDARD_FORMS = [
  {
    key: 'caterer_pledge',
    title: 'تعهد مقدم خدمات الإعاشة',
    category: 'تعاقدي',
    description:
      'إقرار المتعهد باطلاعه على كراسة ملحق العقد والتزامه بالاشتراطات التشغيلية والرقابية للموسم.',
    requiresSignature: true,
    requiresAttachment: false,

    definition: {
      blocks: [
        { id: 'p1', type: 'heading', text: 'تعهد مقدم خدمات الإعاشة لموسم حج {{hijri_year}}هـ' },

        { id: 'p2', type: 'paragraph',
          text: 'يقر المتعهد / {{caterer_name}} المتعاقد بموجب العقد رقم ({{contract_number}}) بالاطلاع على كراسة ملحق العقد التي تتضمن الاشتراطات والمواصفات الفنية، والتي تم إرسالها إليه إلكترونيًا من قبل شركة {{company_name}}، ويتعهد بالالتزام التام بجميع ما ورد فيها والعمل بموجبها.' },

        { id: 'p3', type: 'paragraph', text: 'ويقر بالتعهد والالتزام بالتالي:' },

        { id: 'p4', type: 'list', ordered: false, items: [
          'التعهد والالتزام بتقديم الخطة التشغيلية لتنفيذ نطاق الأعمال المطلوبة، بموعد أقصاه {{plan_due_date}}.',
          'التعهد والالتزام بكافة التعليمات والاشتراطات الصادرة من الجهات الحكومية والرقابية، ومنها (وزارة الحج والعمرة - المديرية العامة للدفاع المدني - هيئة الغذاء والدواء - أمانة العاصمة المقدسة - شركة كدانة للتنمية والتطوير)، وجميع التزامات الجهات الرقابية المشاركة في أعمال الموسم.',
          'التعهد والالتزام بتوفير جميع الاشتراطات والمتطلبات الخاصة بالعاملين والكادر البشري، واستخراج التصاريح اللازمة لهم حسب أنظمة الجهات الرقابية ذات العلاقة، مع توفير الزي الموحد لهم بشعار المنشأة.',
          'التعهد والالتزام بالإفصاح عن مصدر التوريد والتموين (محلية - مستوردة) للمواد المستخدمة في التحضير، مثل: (اللحوم - الأسماك - الدواجن - منتجات الحليب والألبان - البيض …) وأنواعها (مجمد - مبرد).',
          'التعهد والالتزام بأهمية التأكد من صلاحية جميع المواد الغذائية وتخزينها بالشكل الصحيح، والتحقق من مدى مطابقتها لمتطلبات اللوائح الفنية والمواصفات الغذائية المعتمدة، وتوفير معلومات صحيحة وغير مضللة.',
          'التعهد والالتزام بالمحافظة على النظافة وجودة وصحة الأطعمة المقدمة للحجاج والزوار، ويتحمل كامل المسؤولية في حالة وجود أي أضرار على الصحة العامة للحجاج والزوار تكون سببها تلك الأطعمة، على سبيل المثال: التسمم الغذائي لا سمح الله.',
          'التعهد والالتزام بسحب العينات المرجعية وعدم إتلافها طيلة أيام عمل الموسم حتى انتهائه، ونقلها من المشاعر المقدسة إلى المطبخ الرئيسي، حيث يتم إتلاف العينات بعد انتهاء الموسم بعد أخذ موافقة من إدارة قطاع التغذية بالإتلاف، ويتم توثيق عملية الإتلاف عن طريق محضر وإرساله إلى إدارة قطاع التغذية بشركة {{company_name}}.',
          'التعهد والالتزام بحصوله على دورة تأهيل وتدريب الطهاة على استخدام الكيروسين بعدد (10) ساعات تدريبية، وبحد أدنى متدرب واحد لكل مطبخ، على أن يتم تسليم شهادات التدريب إلى إدارة قطاع التغذية بشركة {{company_name}} في موعد أقصاه {{training_due_date}}.',
          'التعهد والالتزام بسداد كافة التكاليف الناتجة عن سوء تنفيذ مهامه، وكذلك التكاليف الناتجة عن تصرفات عمالته داخل المخيمات سواء في المطبخ أو المرافق، وذلك في مشعري (عرفات - منى).',
          'التعهد والالتزام بسداد قيمة الوقود (الكيروسين) لتشغيل عملية الطبخ داخل المشاعر.',
          'التعهد والالتزام بسداد قيمة استهلاك الكهرباء داخل مشعري (عرفات - منى).',
          'التعهد والالتزام بتوفير اللوحة النموذجية بمواقع الطبخ في المشاعر المقدسة (عرفة - منى) طيلة فترة الموسم، وتحتوي على:',
        ]},

        { id: 'p5', type: 'list', ordered: true, items: [
          'قائمة الطعام (المنيو) وموضحة أوقات توزيع الوجبات، باللغة العربية ولغة الحاج.',
          'قائمة مسببات الحساسية، باللغة العربية ولغة الحاج.',
          'قائمة السعرات الحرارية، باللغة العربية ولغة الحاج.',
          'استبيان رضا الحاج والشكاوى والاقتراحات، باللغة العربية ولغة الحاج.',
          'السجل التجاري للمنشأة.',
          'رخصة البلدية وتأهيل متعهد الحج.',
          'ملصقات إرشادية وتوعوية، باللغة العربية ولغة الحاج.',
          'البطاقات الصحية للعاملين.',
        ]},

        { id: 'p6', type: 'list', ordered: false, items: [
          'التعهد والالتزام بتوفير ملصق (غلاف) لجميع الوجبات الغذائية كما تم توضيح تفاصيله في كراسة ملحق العقد.',
          'التعهد والالتزام بتوفير عربات لنقل وتوزيع الوجبات داخل المخيمات بكميات كافية ذات (الأربع عجلات).',
          'التعهد والالتزام بتوفير مركبة وسيلة نقل مغلقة، ويتم وضع ملصق على المركبة بها شعار واسم المنشأة، مع ضرورة توفير تصريح دخول المركبة للمشاعر المقدسة.',
          'التعهد والالتزام بتوفير أجهزة مستشعرات الحرارة (Data Logger) داخل مركبات النقل.',
          'التعهد والالتزام بتوفير أجهزة تتبع داخل مركبات النقل.',
          'التعهد والالتزام بتوفير عربات كافية لا تقل عن ٤ عربات ذات (الأربع عجلات)، وتكون مغلقة لاستخدامها في سلاسل الإمداد.',
          'التعهد والالتزام بأنه اطلع على كامل لائحة العقوبات والغرامات، ويتعهد بالالتزام بدفع الغرامات على أي مخالفة وردت في اللائحة في حال رصدها من قبل إدارة قطاع التغذية في شركة {{company_name}}.',
          'التعهد والالتزام بأنه تم الاطلاع على كامل الشروط والمواصفات والالتزامات والاشتراطات والشروط الجزائية في العقد وكراسة ملحق العقد، وأتعهد بالالتزام بها وبجميع ما ورد فيها، بالإضافة إلى جميع التعاميم الإلحاقية الصادرة من إدارة قطاع التغذية في شركة {{company_name}}، مع تحملي كافة الإجراءات أو الغرامات المترتبة على إخلالي بها.',
          'التعهد والالتزام بالتعاون مع شركة {{company_name}} في كافة الإجراءات المتعلقة بخدمات التغذية وأوقات تسليم الوجبات الغذائية للحجاج على وجه الخصوص.',
          'التعهد والالتزام بالتنسيق مع شركة {{company_name}} وفق النطاق المكاني لمعالجة أي نقص أو خلل في تنفيذ المتعهد لالتزاماته التعاقدية.',
          'التعهد والالتزام بوضع QR-CODE مخصص لاستبيان رضا الحاج عن الخدمات المقدمة (التغذية) باللغة العربية ولغة الحجاج، ورفع نتائج الاستبيان ضمن التقرير النهائي.',
          'التعهد والالتزام بتقديم التقرير المفصل بتنفيذ الأعمال بعد نهاية الموسم، بموعد أقصاه {{report_due_date}}.',
        ]},

        { id: 'p7', type: 'divider' },

        { id: 'p8', type: 'fields', style: 'grid', columns: 2,
          keys: ['rep_name', 'pledge_date'] },

        { id: 'p9', type: 'signature',
          slots: [{ label: 'التوقيع', key: 'signature' }, { label: 'الختم', key: 'stamp' }] },

        { id: 'p10', type: 'note',
          text: 'جميع النقاط المذكورة في ملحق العقد قد يتم تحديثها عن طريق تعاميم، وذلك بحسب حاجة العمل.' },
      ],

      fields: {
        company_name:  { label: 'اسم الشركة',    type: 'text', source: 'company.name',  readonly: true },
        caterer_name:  { label: 'اسم المتعهد',   type: 'text', source: 'caterer.name',  readonly: true },
        hijri_year:    { label: 'السنة',         type: 'text', source: 'hijri_year',    readonly: true },

        /* The company sets these, not the caterer: the contract number is on
           the company's own contract, and the deadlines are its instructions.
           They also move every season, which is why they are blanks rather
           than dates baked into the clause text. */
        contract_number:   { label: 'رقم العقد',                 type: 'text', owner: 'admin', required: true },
        plan_due_date:     { label: 'موعد الخطة التشغيلية',       type: 'date', owner: 'admin' },
        training_due_date: { label: 'موعد شهادات تدريب الكيروسين', type: 'date', owner: 'admin' },
        report_due_date:   { label: 'موعد التقرير الختامي',       type: 'date', owner: 'admin' },

        /* The caterer names who is signing on their behalf, and dates it. */
        rep_name:    { label: 'ممثل المنشأة', type: 'text', source: 'caterer.owner_name', owner: 'caterer', required: true },
        pledge_date: { label: 'التاريخ',      type: 'date', owner: 'caterer', required: true },
      },
    },
  },

  {
    key: 'liaison_officer',
    title: 'تعيين ضابط اتصال',
    category: 'تشغيلي',
    description:
      'يطلب من المتعهد تسمية ضابط اتصال يكون المسؤول المباشر عن استلام الملاحظات والتنسيق اليومي.',
    requiresSignature: true,
    requiresAttachment: false,

    definition: {
      blocks: [
        { id: 'b1', type: 'paragraph', text: 'السادة/ لجنة التغذية بشركة {{company_name}}' },

        /* Two blanks on one line, exactly as the paper form has them. */
        { id: 'b2', type: 'paragraph',
          text: 'نحن إدارة مطبخ: {{kitchen_name}}   سجل تجاري رقم: {{cr_number}}' },

        { id: 'b3', type: 'paragraph', text: 'تحية طيبة وبعد،،' },

        { id: 'b4', type: 'paragraph',
          text: 'بالإشارة إلى التعاون القائم بين شركة {{company_name}} ومطبخكم الموقر في تقديم خدمات الإعاشة، ومن مبدأ تنظيم العمل وضمان سرعة الاستجابة والتنسيق الفعّال في تنفيذ المهام اليومية؛' },

        { id: 'b5', type: 'paragraph',
          text: 'نرجو منكم التكرم بتزويدنا ببيانات ضابط اتصال من طرفكم، ليكون هو المسؤول المباشر عن استلام الملاحظات والتنسيق مع فريق عملنا، مع تزويدنا ببيانات التواصل الخاصة به كما هو موضح أدناه:' },

        { id: 'b6', type: 'fields', style: 'list',
          keys: ['officer_name', 'officer_phone', 'officer_email'] },

        { id: 'b7', type: 'paragraph',
          text: 'بناءً عليه، يرجى اعتماد التواصل مع المذكور أعلاه في كل ما يتعلق بمتطلبات الإعاشة اليومية، الجداول الزمنية، وملاحظات التشغيل.' },

        { id: 'b8', type: 'paragraph', text: 'شاكرين لكم تعاونكم الدائم،،' },

        { id: 'b9', type: 'signature',
          slots: [{ label: 'التوقيع', key: 'signature' }, { label: 'الختم', key: 'stamp' }] },
      ],

      fields: {
        /* Answered by the system — the caterer never retypes what is on record. */
        company_name: { label: 'اسم الشركة',    type: 'text', source: 'company.name',       readonly: true },
        kitchen_name: { label: 'اسم المطبخ',    type: 'text', source: 'caterer.name',       readonly: true },
        cr_number:    { label: 'السجل التجاري', type: 'text', source: 'caterer.cr_number',  readonly: true },

        /* This letter exists to obtain these three from the caterer, so they
           stay the caterer's to answer. The registry proposes what it already
           knows so a caterer whose liaison has not changed just confirms and
           signs — prefilled, not decided for them. */
        officer_name:  { label: 'اسم ضابط الاتصال', type: 'text',  owner: 'caterer', source: 'caterer.liaison_name',  required: true },
        officer_phone: { label: 'رقم الجوال',        type: 'phone', owner: 'caterer', source: 'caterer.liaison_phone', required: true },
        officer_email: { label: 'البريد الإلكتروني', type: 'email', owner: 'caterer', source: 'caterer.email' },
      },
    },
  },


  readinessMinute('منى'),
  readinessMinute('عرفات'),
];
