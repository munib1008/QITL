/**
 * Quran reader interface strings (en, ar, ur): navigation, copy and share, reading progress, saved verses and reading
 * divisions. Interface text only: no Quran text, translation or tafsir is written here. Arabic and Urdu are first
 * drafts awaiting a qualified translator; any missing key falls back to English.
 */
import { moduleStrings } from "./index";

const en = {
  index: {
    findLabel: "Find a surah",
    findHelp: "Type a name in English, Arabic or transliteration, or a surah number.",
    placeholder: "e.g. Yusuf, يوسف, 12",
    results: (n: number) => (n === 1 ? "1 surah" : `${n} surahs`),
    none: "No surah matches that. Try another spelling or a number.",
    surahs: "Surahs",
    ayat: (n: number) => `${n} ayat`,
    byJuz: "Browse by juz",
    juzSource: "Juz, hizb and page divisions: Tanzil Quran Metadata (CC BY 3.0).",
  },
  jump: {
    title: "Go to an ayah",
    surah: "Surah",
    ayah: "Ayah",
    go: "Go",
    help: (max: number) => `1 to ${max}`,
    errSurah: "Choose a surah from 1 to 114.",
    errAyah: (max: number) => `This surah has ${max} ayat. Enter a number from 1 to ${max}.`,
  },
  keys: {
    title: "Keyboard",
    next: "Next ayah",
    prev: "Previous ayah",
  },
  actions: {
    copy: "Copy ayah",
    copied: "Copied with attribution",
    copyFailed: "Copy did not work here. Select the text to copy it.",
    share: "Share",
    shareTitle: (ref: string) => `${ref}, from QITL`,
  },
  markers: {
    juz: (n: number) => `Juz ${n}`,
    hizb: (n: number, q: 1 | 2 | 3 | 4) => (q === 1 ? `Hizb ${n}` : `${q === 2 ? "¼" : q === 3 ? "½" : "¾"} Hizb ${n}`),
    page: (n: number) => `Page ${n}`,
    label: "Reading divisions",
  },
  progress: {
    continue: "Continue reading",
    resumeAt: (surah: string, ref: string) => `${surah}, ${ref}`,
    resumeHere: (ref: string) => `You were reading ${ref}.`,
    resume: "Resume",
    device: "Kept on this device.",
    account: "Kept in your account.",
  },
  saved: {
    title: "Saved verses",
    empty: "No saved verses yet. Use Bookmark beside any ayah.",
    remove: "Remove",
    open: (ref: string) => `Open ${ref}`,
    loadError: "Saved verses could not be loaded. Refresh to try again.",
  },
};

export const quranReaderStrings = (locale: string) =>
  moduleStrings(locale, {
    en,
    ar: {
      index: {
        findLabel: "ابحث عن سورة",
        findHelp: "اكتب اسم السورة بالعربية أو الإنجليزية أو بالحروف اللاتينية، أو رقمها.",
        placeholder: "مثل: يوسف، Yusuf، 12",
        none: "لا توجد سورة بهذا الاسم. جرّب كتابة أخرى أو رقمًا.",
        surahs: "السور",
        byJuz: "تصفح حسب الجزء",
        juzSource: "تقسيم الأجزاء والأحزاب والصفحات: بيانات تنزيل الوصفية (CC BY 3.0).",
      },
      jump: { title: "انتقل إلى آية", surah: "السورة", ayah: "الآية", go: "انتقل", errSurah: "اختر سورة من 1 إلى 114." },
      keys: { title: "لوحة المفاتيح", next: "الآية التالية", prev: "الآية السابقة" },
      actions: { copy: "انسخ الآية", copied: "نُسخت مع الإسناد", copyFailed: "تعذّر النسخ هنا. حدّد النص لنسخه.", share: "مشاركة" },
      markers: { label: "تقسيمات القراءة" },
      progress: { continue: "تابع القراءة", resume: "استئناف", device: "محفوظ على هذا الجهاز.", account: "محفوظ في حسابك." },
      saved: { title: "الآيات المحفوظة", empty: "لا توجد آيات محفوظة بعد. استخدم زر الحفظ بجانب أي آية.", remove: "إزالة", loadError: "تعذّر تحميل الآيات المحفوظة. حدّث الصفحة للمحاولة مجددًا." },
    },
    ur: {
      index: {
        findLabel: "سورت تلاش کریں",
        findHelp: "سورت کا نام عربی، انگریزی یا رومن حروف میں، یا اس کا نمبر لکھیں۔",
        placeholder: "مثلاً یوسف، Yusuf، 12",
        none: "اس نام کی کوئی سورت نہیں ملی۔ دوسرا ہجّا یا نمبر آزمائیں۔",
        surahs: "سورتیں",
        byJuz: "پارے کے لحاظ سے دیکھیں",
        juzSource: "پارے، حزب اور صفحات کی تقسیم: تنزیل میٹا ڈیٹا (CC BY 3.0)۔",
      },
      jump: { title: "کسی آیت پر جائیں", surah: "سورت", ayah: "آیت", go: "جائیں", errSurah: "1 سے 114 تک کوئی سورت منتخب کریں۔" },
      keys: { title: "کی بورڈ", next: "اگلی آیت", prev: "پچھلی آیت" },
      actions: { copy: "آیت کاپی کریں", copied: "حوالے کے ساتھ کاپی ہو گئی", copyFailed: "یہاں کاپی نہیں ہو سکی۔ متن منتخب کر کے کاپی کریں۔", share: "شیئر کریں" },
      markers: { label: "تلاوت کی تقسیم" },
      progress: { continue: "پڑھنا جاری رکھیں", resume: "جاری رکھیں", device: "اس آلے پر محفوظ ہے۔", account: "آپ کے اکاؤنٹ میں محفوظ ہے۔" },
      saved: { title: "محفوظ آیات", empty: "ابھی کوئی آیت محفوظ نہیں۔ کسی بھی آیت کے ساتھ بک مارک استعمال کریں۔", remove: "ہٹائیں", loadError: "محفوظ آیات لوڈ نہیں ہو سکیں۔ دوبارہ کوشش کے لیے صفحہ ریفریش کریں۔" },
    },
  });

export type QuranReaderStrings = typeof en;
