// ============================================================================
// Translations — Omar Elsahragty Portfolio
// English & Arabic (RTL) support
// ============================================================================

export type Lang = 'en' | 'ar';

export const translations = {
  en: {
    // ---- Navbar ----
    nav: {
      home: 'Home',
      about: 'About',
      experience: 'Experience',
      projects: 'Projects',
      contact: 'Contact',
      toggleLang: 'عربي',
    },

    // ---- Hero ----
    hero: {
      greeting: "Hi, I'm Omar Elsahragty.",
      tagline:
        'I turn coffee into distributed systems and bugs into undocumented features — one microservice at a time.',
      role: 'Software Engineer',
      company: 'Bazaarvoice',
      from: 'Computer Engineer from',
      location: 'Alexandria, Egypt',
      available: 'Available for Opportunities',
      ctaHire: '> Deploy Me (Hire Me)',
      ctaDocs: '$ Read the Docs',
      duckCaption: 'rubber duck debugging champion',
    },

    // ---- About ----
    about: {
      title: 'About Me',
      subtitle: '$ cat ~/about.md | less',
      terminalUser: 'omar',
      terminalHost: 'sahragty',
      whoami: 'whoami',
      npmInstall: 'npm install dream-projects --save',
      npmResult: 'added 42 packages, removed 0 bugs (yeah right), audited 1337 packages in 3.14s',
      npmNote: "found 0 vulnerabilities (we don't talk about the other ones)",
      terminalBio: `Computer Engineer from Alexandria, Egypt — building and shipping distributed systems since 2018. Currently a Software Engineer at Bazaarvoice, maintaining a multi-tenant SaaS platform that serves 3,000+ global brands across 20+ Scala microservices on AWS ECS, orchestrating async event pipelines over GCP Pub/Sub, and wrangling more GraphQL resolvers than any sane person should. Before that, I built the Affable.ai influencer analytics platform from the ground up — Elasticsearch-powered discovery across 10M+ social profiles, MongoDB Atlas clusters, and NestJS APIs at scale. I thrive at the intersection of backend architecture and developer experience. Stack of choice: Scala + NestJS + React. Preferred debugger: a rubber duck named Kevin. 🦆`,
      skills: {
        Frontend: 'Frontend',
        Backend: 'Backend',
        Databases: 'Databases',
        'DevOps & Cloud': 'DevOps & Cloud',
        Architecture: 'Architecture',
      },
    },

    // ---- Experience ----
    experience: {
      title: 'Experience',
      subtitle: '$ git log --oneline --graph',
      headBadge: 'HEAD',
    },

    // ---- Experience Items (localised content) ----
    // TODO: Add detailed bullet-point descriptions for each experience item
    experienceItems: [
      {
        role: 'Software Engineer',
        type: 'Full-time',
        duration: '2+ years',
        details: [],
      },
      {
        role: 'Software Engineer',
        type: 'Full-time',
        duration: '2 years 3 months',
        details: [],
      },
      {
        role: 'Software Engineer',
        type: 'Full-time',
        duration: '9 months',
        details: [],
      },
      {
        role: 'Frontend Developer',
        type: 'Full-time',
        duration: '4 months',
        details: [],
      },
      {
        role: 'Freelance Software Developer',
        type: 'Freelance',
        duration: '4 years 9 months',
        details: [],
      },
    ],

    // ---- Projects ----
    projects: {
      title: 'Projects',
      subtitle: '$ ls -la ~/projects/',
      caseStudy: 'Case Study',
      viewCode: 'Code',
    },

    // ---- Project Items (localised descriptions) ----
    projectItems: [
      {
        description:
          'A real-time live polling and audience engagement platform built for instant feedback at scale. Votes synchronize in under 50ms through WebSocket connections, with Redis Pub/Sub handling fanout distribution across server instances so every connected client sees results update simultaneously. PostgreSQL provides durable vote persistence with conflict-free counting, while the React frontend delivers animated result bars, countdown timers, and shareable poll links. Designed with a WebRTC-ready architecture for future live video integration during polling sessions.',
      },
      {
        description:
          'A social trading community platform purpose-built for the Saudi Arabian (Tadawul) stock market — Twitter meets StockTwits with a Middle Eastern focus. Traders share real-time market insights, follow specific tickers, post analysis threads, and react to price movements with sentiment-tagged posts. The real-time feed is powered by Firebase Firestore with optimistic UI updates for instant post visibility. Features include user profiles with trading track records, ticker watchlists with push alerts, threaded discussions, and a trending sentiment dashboard. Reached 1,000+ active beta users within two weeks of launch.',
      },
      {
        description:
          'A multi-vendor e-commerce administration dashboard designed to unify the management of 50+ independent vendor storefronts from a single React interface. The platform provides real-time order management with status tracking across vendors, inventory monitoring with low-stock alerts, vendor performance analytics with revenue breakdowns and fulfillment metrics, and a customer CRM with order history and communication logs. Built as a single-page application with zero page reloads, leveraging optimistic updates and client-side caching for a seamless operator experience.',
      },
      {
        description:
          'A comprehensive enterprise resource planning system built for multi-branch restaurant chains, replacing three disconnected spreadsheet workflows with a single real-time dashboard. Covers end-to-end operations: inventory tracking with cross-branch stock transfers and waste logging, a multi-terminal point-of-sale system with kitchen display integration, staff scheduling with shift management and overtime calculations, and detailed profit-and-loss reporting with per-branch breakdowns. Built with React and Redux on the frontend, Node.js REST APIs on the backend, and MongoDB for flexible document storage.',
      },
      {
        description:
          'A GPS-powered fleet management and passenger information system for public transit networks. Tracks live vehicle positions via Socket.IO WebSocket connections, calculates dynamic route ETAs using historical speed data, and broadcasts passenger-facing arrival estimates to mobile clients. The WebSocket layer efficiently handles 1,000+ concurrent connections with minimal server overhead through connection pooling and selective room-based broadcasting. Features a dispatcher dashboard with fleet overview, route deviation alerts, and historical route analytics.',
      },
    ],

    // ---- Certificates ----
    certificates: {
      title: 'Certificates',
      subtitle: 'Verified by Someone With a Fancy Letterhead™',
    },

    // ---- Contact ----
    contact: {
      title: 'Contact',
      subtitle: 'POST /api/v1/messages — Initiate Communication Protocol',
      directConnections: '// Direct connections',
      location: 'Alexandria, Egypt ❤️',
      formTitle: 'message.json',
      name: '"name"',
      email: '"email"',
      message: '"message"',
      namePlaceholder: '"Your Name"',
      emailPlaceholder: '"your@email.com"',
      messagePlaceholder: '"Your message here..."',
      submit: '$ npm run deploy-message',
      sending: 'Compiling... Bundling... Deploying... 🚀',
      success: "✅ 200 OK — Message received! I'll respond faster than a CI pipeline.",
      error: '❌ 500 Error — Failed to send. Try again or ping me directly.',
    },

    // ---- Footer ----
    footer: {
      tagline:
        'Designed & built by Omar Elsahragty from Alexandria — powered by Next.js, TypeScript & an unreasonable amount of caffeine.',
      copyright: 'Omar Elsahragty. All rights reserved.',
      quotes: [
        'It works on my machine ¯\\_(ツ)_/¯',
        'Turning coffee into code and bugs into undocumented features',
        "If it's stupid but it works, it's not stupid",
        'Rubber duck debugging champion 🏆',
        "console.log('Why isn\\'t it working?'); // [object Object]",
        '// TODO: Refactor this later (created 3 years ago)',
        'git commit -m "fixed it for real this time"',
        '404: Social life not found',
      ],
    },
  },

  ar: {
    // ---- Navbar ----
    nav: {
      home: 'الرئيسية',
      about: 'عني',
      experience: 'الخبرات',
      projects: 'المشاريع',
      contact: 'تواصل',
      toggleLang: 'EN',
    },

    // ---- Hero ----
    hero: {
      greeting: 'مرحباً، أنا عمر الصهراجتي.',
      tagline:
        'أحوّل القهوة إلى أنظمة موزّعة والأخطاء إلى ميزات غير موثّقة — خدمة مصغّرة في كل مرة.',
      role: 'مهندس برمجيات',
      company: 'Bazaarvoice',
      from: 'مهندس حاسوب من',
      location: 'الإسكندرية، مصر',
      available: 'متاح للفرص الوظيفية',
      ctaHire: '> وظّفني (Deploy Me)',
      ctaDocs: '$ اقرأ الملفات',
      duckCaption: 'بطل تصحيح الأخطاء بالبطة المطاطية',
    },

    // ---- About ----
    about: {
      title: 'عني',
      subtitle: '$ cat ~/about.md | less',
      terminalUser: 'omar',
      terminalHost: 'sahragty',
      whoami: 'whoami',
      npmInstall: 'npm install dream-projects --save',
      npmResult:
        'تمت إضافة ٤٢ حزمة، وإزالة ٠ أخطاء (نعم، بالتأكيد)، وتدقيق ١٣٣٧ حزمة في ٣.١٤ ثانية',
      npmNote: 'تم العثور على ٠ ثغرات (نتجاهل الأخرى طبعاً)',
      terminalBio: `مهندس حاسوب من الإسكندرية، مصر — أبني وأُشحن أنظمة موزّعة منذ عام ٢٠١٨. حالياً مهندس برمجيات في Bazaarvoice، أُحافظ على منصة SaaS متعددة المستأجرين تخدم أكثر من ٣٠٠٠ علامة تجارية عالمية عبر أكثر من ٢٠ خدمة مصغّرة Scala على AWS ECS، وأُنسّق خطوط أحداث غير متزامنة على GCP Pub/Sub. قبل ذلك، بنيت منصة تحليلات المؤثرين Affable.ai من الصفر — بحث مدعوم بـ Elasticsearch عبر أكثر من ١٠ ملايين ملف شخصي اجتماعي، وعناقيد MongoDB Atlas، وواجهات برمجية NestJS على نطاق واسع. أزدهر عند تقاطع هندسة الخلفيات وتجربة المطوّرين. الحزمة المفضّلة: Scala + NestJS + React. أداة التصحيح المفضّلة: بطة مطاطية اسمها كيفن. 🦆`,
      skills: {
        Frontend: 'الواجهة الأمامية',
        Backend: 'الواجهة الخلفية',
        Databases: 'قواعد البيانات',
        'DevOps & Cloud': 'DevOps والسحابة',
        Architecture: 'الهندسة المعمارية',
      },
    },

    // ---- Experience ----
    experience: {
      title: 'الخبرات',
      subtitle: '$ git log --oneline --graph',
      headBadge: 'HEAD',
    },

    // ---- Experience Items (localised content) ----
    // TODO: Add detailed bullet-point descriptions for each experience item (Arabic)
    experienceItems: [
      {
        role: 'مهندس برمجيات',
        type: 'دوام كامل',
        duration: 'أكثر من سنتين',
        details: [],
      },
      {
        role: 'مهندس برمجيات',
        type: 'دوام كامل',
        duration: 'سنتان و٣ أشهر',
        details: [],
      },
      {
        role: 'مهندس برمجيات',
        type: 'دوام كامل',
        duration: '٩ أشهر',
        details: [],
      },
      {
        role: 'مطوّر واجهات أمامية',
        type: 'دوام كامل',
        duration: '٤ أشهر',
        details: [],
      },
      {
        role: 'مطوّر برمجيات مستقل',
        type: 'عمل حر',
        duration: '٤ سنوات و٩ أشهر',
        details: [],
      },
    ],

    // ---- Projects ----
    projects: {
      title: 'المشاريع',
      subtitle: '$ ls -la ~/projects/',
      caseStudy: 'دراسة الحالة',
      viewCode: 'الكود',
    },

    // ---- Project Items (localised descriptions) ----
    projectItems: [
      {
        description:
          'منصة استطلاع مباشر وتفاعل مع الجمهور مبنية للحصول على ردود فعل فورية على نطاق واسع. تتزامن الأصوات في أقل من ٥٠ مللي ثانية عبر اتصالات WebSocket، مع Redis Pub/Sub الذي يتولى التوزيع عبر نسخ الخادم بحيث يرى كل عميل متصل تحديث النتائج في وقت واحد. يوفر PostgreSQL تخزيناً متيناً للأصوات دون تعارض، بينما تقدّم واجهة React أشرطة نتائج متحركة ومؤقتات تنازلية وروابط استطلاعات قابلة للمشاركة.',
      },
      {
        description:
          'منصة مجتمع تداول اجتماعي مبنية خصيصاً لسوق الأسهم السعودي (تداول) — تويتر يلتقي StockTwits بلمسة شرق أوسطية. يتشارك المتداولون رؤى السوق الفورية، ويتابعون رموز بعينها، وينشرون سلاسل تحليل، ويتفاعلون مع تحركات الأسعار. يعمل التغذية في الوقت الفعلي بواسطة Firebase Firestore مع تحديثات تفاؤلية. وصلت إلى أكثر من ١٠٠٠ مستخدم تجريبي نشط خلال أسبوعين من الإطلاق.',
      },
      {
        description:
          'لوحة إدارة تجارة إلكترونية متعددة البائعين مصمّمة لتوحيد إدارة أكثر من ٥٠ واجهة بائع مستقلة من خلال واجهة React واحدة. تقدّم المنصة إدارة الطلبات في الوقت الفعلي مع تتبع الحالة، ومراقبة المخزون مع تنبيهات انخفاض المخزون، وتحليلات أداء البائعين مع تفاصيل الإيرادات ومقاييس التنفيذ، ونظام CRM للعملاء مع تاريخ الطلبات وسجلات التواصل.',
      },
      {
        description:
          'نظام تخطيط موارد مؤسسية شامل مبني لسلاسل المطاعم متعددة الفروع، يحلّ محل ثلاثة سير عمل جداول بيانات منفصلة بلوحة تحكم واحدة في الوقت الفعلي. يغطي العمليات بالكامل: تتبع المخزون مع نقل المنتجات بين الفروع وتسجيل الهدر، ونظام نقاط بيع متعدد الطرفيات مع تكامل شاشة المطبخ، وإدارة جداول الموظفين مع احتساب الوقت الإضافي، وتقارير مفصّلة للأرباح والخسائر لكل فرع.',
      },
      {
        description:
          'نظام إدارة أسطول مدعوم بالـ GPS ومعلومات الركاب لشبكات النقل العام. يتتبع مواقع المركبات الحية عبر WebSocket بـ Socket.IO، ويحسب أوقات الوصول الديناميكية من بيانات السرعة التاريخية، ويبثّ تقديرات الوصول للعملاء. تتعامل طبقة WebSocket بكفاءة مع أكثر من ١٠٠٠ اتصال متزامن عبر تجميع الاتصالات والبث الانتقائي. يشمل لوحة تحكم المشرف مع نظرة عامة على الأسطول وتنبيهات انحراف المسار وتحليلات المسار التاريخية.',
      },
    ],

    // ---- Certificates ----
    certificates: {
      title: 'الشهادات',
      subtitle: 'موثّقة من جهة محترمة ذات ورق رسمي مميّز™',
    },

    // ---- Contact ----
    contact: {
      title: 'تواصل',
      subtitle: 'POST /api/v1/messages — ابدأ بروتوكول التواصل',
      directConnections: '// التواصل المباشر',
      location: 'الإسكندرية، مصر ❤️',
      formTitle: 'message.json',
      name: '"الاسم"',
      email: '"البريد الإلكتروني"',
      message: '"الرسالة"',
      namePlaceholder: '"اسمك"',
      emailPlaceholder: '"بريدك@الإلكتروني.com"',
      messagePlaceholder: '"رسالتك هنا..."',
      submit: '$ npm run deploy-message',
      sending: '...جارٍ الإرسال 🚀',
      success: '✅ ٢٠٠ OK — تم استلام الرسالة! سأردّ عليك أسرع من خط CI.',
      error: '❌ ٥٠٠ Error — فشل الإرسال. حاول مجدداً أو تواصل معي مباشرة.',
    },

    // ---- Footer ----
    footer: {
      tagline:
        'صُمّم وبُني بواسطة عمر الصهراجتي من الإسكندرية — مدعوم بـ Next.js وTypeScript وكمية غير معقولة من الكافيين.',
      copyright: 'عمر الصهراجتي. جميع الحقوق محفوظة.',
      quotes: [
        'يعمل على جهازي ¯\\_(ツ)_/¯',
        'أحوّل القهوة إلى كود والأخطاء إلى ميزات غير موثّقة',
        'إذا كان غبياً لكنه يعمل، فهو ليس غبياً',
        'بطل التصحيح بالبطة المطاطية 🏆',
        "console.log('لماذا لا يعمل؟'); // [object Object]",
        '// TODO: إعادة الهيكلة لاحقاً (تم إنشاؤه منذ ٣ سنوات)',
        'git commit -m "إصلاح حقيقي هذه المرة"',
        '٤٠٤: الحياة الاجتماعية غير موجودة',
      ],
    },
  },
} as const;

export type Translations = typeof translations.en;
