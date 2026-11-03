/**
 * Era titles and notes of the home journey, in Arabic and Urdu. DRAFTS for a qualified translator (listed in
 * docs/translation/README.md): the journey content file itself stays English-only and unchanged. Keyed by the exact English
 * text; a title or note with no entry here is shown in English and marked as English content, as before.
 */
const ERA: Record<string, { ar: string; ur: string }> = {
  "Early humanity": { ar: "الإنسانية المبكرة", ur: "ابتدائی انسانیت" },
  "Nuh and the ancient nations": { ar: "نوح والأمم القديمة", ur: "نوح اور قدیم قومیں" },
  "Ibrahim and his family": { ar: "إبراهيم وأسرته", ur: "ابراہیم اور ان کا خاندان" },
  "Between Yusuf and Isa": { ar: "بين يوسف وعيسى", ur: "یوسف اور عیسیٰ کے درمیان" },
  "The time of Isa": { ar: "زمن عيسى", ur: "عیسیٰ کا زمانہ" },
  "The final Messenger ﷺ": { ar: "خاتم الرسل ﷺ", ur: "آخری رسول ﷺ" },
  "Chronological position only — no dates are known.": { ar: "الترتيب الزمني فقط — لا تُعرف تواريخ.", ur: "صرف زمانی ترتیب — کوئی تاریخ معلوم نہیں۔" },
  "Chronological position — historians' dates vary widely and are not used.": {
    ar: "الترتيب الزمني — تختلف تواريخ المؤرخين اختلافًا واسعًا ولا تُستعمل.",
    ur: "زمانی ترتیب — مؤرخین کی تاریخیں بہت مختلف ہیں اور استعمال نہیں کی گئیں۔",
  },
  "Order of several prophets here is not stated in the Quran and is disputed.": {
    ar: "ترتيب عدد من الأنبياء هنا لم يرد في القرآن وهو محل خلاف.",
    ur: "یہاں کئی انبیاء کی ترتیب قرآن میں مذکور نہیں اور اختلافی ہے۔",
  },
  "Zakariya, Yahya and Isa were contemporaries.": { ar: "كان زكريا ويحيى وعيسى متعاصرين.", ur: "زکریا، یحییٰ اور عیسیٰ ہم عصر تھے۔" },
  "Dated history — CE and AH shown with how certain each date is.": {
    ar: "تاريخ مؤرَّخ — تُعرض السنة الميلادية والهجرية مع درجة يقين كل تاريخ.",
    ur: "تاریخ وار — عیسوی اور ہجری سال ہر تاریخ کے یقین کے درجے کے ساتھ دکھائے گئے ہیں۔",
  },
};

/** The text to show and whether it is still English content (so the caller keeps its lang="en" marking). */
export function eraText(locale: string, english: string): { text: string; english: boolean } {
  const hit = locale === "ar" || locale === "ur" ? ERA[english]?.[locale] : undefined;
  return hit ? { text: hit, english: false } : { text: english, english: true };
}
