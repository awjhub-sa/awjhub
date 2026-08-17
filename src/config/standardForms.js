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
        { id: 'p1', type: 'heading', text: 'تعهد مقدم خدمات الإعاشة لموسم حج {{season_name}}' },

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
        season_name:   { label: 'الموسم',        type: 'text', source: 'season.name',   readonly: true },

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
];
