import { moduleStrings } from "./index";

/** Strings for the Quran reader's and Story Player's language notes. Non-English: draft, needs translator review. */
export const readerStrings = (locale: string) =>
  moduleStrings(locale, {
    en: {
      translation: "Translation",
      narration: "Narration",
      arabicOnly: "Arabic text only, as you chose.",
      unavailable: "unavailable — licence pending",
      noNarration: "no reviewed narration yet",
      change: "Change language preferences",
    },
    ar: {
      translation: "الترجمة",
      narration: "السرد الصوتي",
      arabicOnly: "النص العربي فقط، كما اخترت.",
      unavailable: "غير متاحة — الترخيص قيد الانتظار",
      noNarration: "لا يوجد سرد مراجَع بعد",
      change: "تغيير تفضيلات اللغة",
    },
    ur: {
      translation: "ترجمہ",
      narration: "صوتی بیان",
      arabicOnly: "آپ کے انتخاب کے مطابق صرف عربی متن۔",
      unavailable: "دستیاب نہیں — لائسنس زیرِ التوا",
      noNarration: "ابھی کوئی نظرِثانی شدہ صوتی بیان نہیں",
      change: "زبان کی ترجیحات بدلیں",
    },
  });
