/**
 * Interface strings. English is the reviewed source. The Arabic interface strings are a first draft that
 * still needs review by a qualified translator (design/README.md, "Open design items"); the UI says so.
 * Urdu slots in as another key with the same shape.
 */
export type Locale = "en" | "ar";

const en = {
  skip: "Skip to content",
  brandTagline: "Quran in Timeline",
  nav: {
    journey: "The Journey",
    explore: "Explore",
    methodology: "Methodology",
    prophets: "Prophets",
    timeline: "Timeline",
    atlas: "Atlas",
    quran: "Quran",
    hadith: "Hadith",
    stories: "Stories",
    events: "Events",
    genealogy: "Genealogy",
    lastHour: "Last Hour",
    community: "Community",
    search: "Search",
    signIn: "Sign in",
    account: "My library",
    begin: "Begin exploring",
  },
  theme: { label: "Theme", light: "Light", dark: "Dark", system: "System" },
  lang: { label: "Language", switchTo: "العربية" },
  footer: {
    principles: "Respecting evidence · Preserving uncertainty · Learning together",
    corrections: "Found an error? Accepted corrections are published with a revision note.",
  },
  bottom: {
    home: "Home",
    timeline: "Timeline",
    quran: "Quran",
    explore: "Explore",
    profile: "Profile",
    close: "Close",
    exploreTitle: "Explore QITL",
    soon: "Coming soon",
  },
  exploreNotes: {
    prophets: "29 chapters, Adam to Muhammad ﷺ",
    stories: "Story readings with sources",
    events: "Quranic events encyclopedia",
    hadith: "Authenticated collections",
    atlas: "Places, with their certainty",
    genealogy: "Cited family relationships",
    lastHour: "Signs, without dates",
    community: "Moderated discussion",
    learn: "Quranic Arabic lessons",
    search: "Everything, in English or Arabic",
  },
  learnArabic: "Learn Quranic Arabic",
  draftArabicUi: "",
};

const ar: typeof en = {
  skip: "تخطَّ إلى المحتوى",
  brandTagline: "القرآن عبر الزمن",
  nav: {
    journey: "الرحلة",
    explore: "استكشف",
    methodology: "المنهجية",
    prophets: "الأنبياء",
    timeline: "الخط الزمني",
    atlas: "الأطلس",
    quran: "القرآن",
    hadith: "الحديث",
    stories: "القصص",
    events: "الأحداث",
    genealogy: "الأنساب",
    lastHour: "أشراط الساعة",
    community: "المجتمع",
    search: "بحث",
    signIn: "تسجيل الدخول",
    account: "مكتبتي",
    begin: "ابدأ الاستكشاف",
  },
  theme: { label: "المظهر", light: "فاتح", dark: "داكن", system: "النظام" },
  lang: { label: "اللغة", switchTo: "English" },
  footer: {
    principles: "احترام الدليل · حفظ مواضع عدم اليقين · نتعلم معًا",
    corrections: "وجدت خطأ؟ تُنشر التصحيحات المقبولة مع ملاحظة مراجعة.",
  },
  bottom: {
    home: "الرئيسية",
    timeline: "الخط الزمني",
    quran: "القرآن",
    explore: "استكشف",
    profile: "حسابي",
    close: "إغلاق",
    exploreTitle: "استكشف QITL",
    soon: "قريبًا",
  },
  exploreNotes: {
    prophets: "٢٩ فصلًا، من آدم إلى محمد ﷺ",
    stories: "قراءات القصص مع المصادر",
    events: "موسوعة الأحداث القرآنية",
    hadith: "المجموعات الموثقة",
    atlas: "الأماكن مع درجة اليقين",
    genealogy: "علاقات النسب الموثقة",
    lastHour: "العلامات بلا تواريخ",
    community: "نقاش خاضع للإشراف",
    learn: "دروس العربية القرآنية",
    search: "كل شيء بالعربية أو الإنجليزية",
  },
  learnArabic: "تعلّم العربية القرآنية",
  draftArabicUi: "واجهة عربية تجريبية — الترجمة قيد المراجعة",
};

export const dict = { en, ar };
export type Dict = typeof en;
