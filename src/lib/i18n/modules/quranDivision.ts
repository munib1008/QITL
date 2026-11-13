import { moduleStrings } from "./index";

/** Mushaf page and juz views (/quran/page/[n], /quran/juz/[n]). Arabic and Urdu are drafts for a translator. */
export const quranDivisionStrings = (locale: string) =>
  moduleStrings(locale, {
    en: {
      pageTitle: (n: number) => `Quran, page ${n}`,
      juzTitle: (n: number) => `Quran, juz ${n}`,
      pageLead: (n: number) => `Page ${n} of 604. Page boundaries follow the reading-division data imported from Tanzil; line breaks of a printed mushaf are not reproduced.`,
      juzLead: (n: number) => `Juz ${n} of 30, from the reading-division data imported from Tanzil.`,
      range: (from: string, to: string) => `${from} to ${to}`,
      previous: "Previous",
      next: "Next",
      openSurah: "Open in the surah reader",
      pageNav: "Page navigation",
      juzNav: "Juz navigation",
      unavailable: "The reading divisions or the Quran text are not imported in this build.",
    },
    ar: {
      pageTitle: (n: number) => `القرآن، الصفحة ${n}`,
      juzTitle: (n: number) => `القرآن، الجزء ${n}`,
      pageLead: (n: number) => `الصفحة ${n} من 604. حدود الصفحات مأخوذة من بيانات تقسيم القراءة المستوردة من تنزيل، ولا يُحاكى فيها تقطيع الأسطر في المصحف المطبوع.`,
      juzLead: (n: number) => `الجزء ${n} من 30، من بيانات تقسيم القراءة المستوردة من تنزيل.`,
      range: (from: string, to: string) => `من ${from} إلى ${to}`,
      previous: "السابق",
      next: "التالي",
      openSurah: "افتح في قارئ السورة",
      pageNav: "التنقل بين الصفحات",
      juzNav: "التنقل بين الأجزاء",
      unavailable: "تقسيمات القراءة أو نص القرآن غير مستوردة في هذا الإصدار.",
    },
    ur: {
      pageTitle: (n: number) => `قرآن، صفحہ ${n}`,
      juzTitle: (n: number) => `قرآن، پارہ ${n}`,
      pageLead: (n: number) => `604 میں سے صفحہ ${n}۔ صفحوں کی حدیں تنزیل سے درآمد کردہ تقسیمِ قراءت کے ڈیٹا کے مطابق ہیں؛ چھپے ہوئے مصحف کی سطروں کی تقسیم نقل نہیں کی گئی۔`,
      juzLead: (n: number) => `30 میں سے پارہ ${n}، تنزیل سے درآمد کردہ تقسیمِ قراءت کے ڈیٹا سے۔`,
      range: (from: string, to: string) => `${from} سے ${to} تک`,
      previous: "پچھلا",
      next: "اگلا",
      openSurah: "سورت کے قاری میں کھولیں",
      pageNav: "صفحوں کے درمیان رہنمائی",
      juzNav: "پاروں کے درمیان رہنمائی",
      unavailable: "اس ورژن میں تقسیمِ قراءت یا قرآن کا متن درآمد نہیں ہے۔",
    },
  });
