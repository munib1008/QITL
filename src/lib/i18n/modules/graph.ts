import { moduleStrings } from "./index";

/** The Related Knowledge panel. Arabic and Urdu are drafts for a translator. */
export const graphStrings = (locale: string) =>
  moduleStrings(locale, {
    en: {
      title: "Pages that cite the same verses",
      note: "Linked only because both cite the same ayat. This is a pointer to read more, not a claim that the pages agree or that one explains the other.",
      kinds: { story: "Story draft", creation: "Creation Atlas profile", guidance: "Life Guidance lesson", lifestyle: "How they lived" } as Record<string, string>,
      shares: (n: number) => (n === 1 ? "shares 1 ayah" : `shares ${n} ayat`),
    },
    ar: {
      title: "صفحات تستشهد بالآيات نفسها",
      note: "رُبطت لأن كلتيهما تستشهد بالآيات نفسها فقط. هذا إرشاد إلى مزيد من القراءة، لا ادعاء بأن الصفحتين متفقتان أو بأن إحداهما تشرح الأخرى.",
      kinds: { story: "مسودة قصة", creation: "ملف في أطلس الخلق", guidance: "درس في الإرشاد الحياتي", lifestyle: "كيف عاشوا" } as Record<string, string>,
      shares: (n: number) => `تشترك في ${n} آية`,
    },
    ur: {
      title: "وہی آیات نقل کرنے والے صفحات",
      note: "یہ صرف اس لیے جڑے ہیں کہ دونوں ایک ہی آیات کا حوالہ دیتے ہیں۔ یہ مزید پڑھنے کی طرف اشارہ ہے، یہ دعویٰ نہیں کہ صفحات متفق ہیں یا ایک دوسرے کی وضاحت کرتا ہے۔",
      kinds: { story: "کہانی کا مسودہ", creation: "تخلیق اٹلس کا خاکہ", guidance: "رہنمائی کا سبق", lifestyle: "وہ کیسے رہتے تھے" } as Record<string, string>,
      shares: (n: number) => `${n} آیات مشترک`,
    },
  });
