import { moduleStrings } from "./index";

/** The six navigation categories and their one-line purposes. Arabic and Urdu are drafts for a translator. */
export const NAV_GROUP_IDS = ["quran", "stories", "learn", "knowledge", "community"] as const;
export type NavGroupId = (typeof NAV_GROUP_IDS)[number];

interface Group {
  label: string;
  note: string;
}
type Groups = Record<NavGroupId, Group>;

const en: Groups = {
  quran: { label: "Quran", note: "Read, understand, compare and learn" },
  stories: { label: "Stories & History", note: "Explore the complete Quranic journey" },
  learn: { label: "Learn & Reflect", note: "Put authentic teachings into practice" },
  knowledge: { label: "Explore Knowledge", note: "Creation, science and deeper subjects" },
  community: { label: "Community", note: "Find guidance and learn with others" },
};

export const navGroupStrings = (locale: string) =>
  moduleStrings(locale, {
    en: { groups: en, all: "All sections" },
    ar: {
      groups: {
        quran: { label: "القرآن", note: "اقرأ وافهم وقارن وتعلَّم" },
        stories: { label: "القصص والتاريخ", note: "استكشف الرحلة القرآنية كاملة" },
        learn: { label: "تعلَّم وتأمَّل", note: "طبِّق التعاليم الصحيحة في حياتك" },
        knowledge: { label: "استكشف المعرفة", note: "الخلق والعلوم وموضوعات أعمق" },
        community: { label: "المجتمع", note: "اطلب الإرشاد وتعلَّم مع الآخرين" },
      },
      all: "كل الأقسام",
    },
    ur: {
      groups: {
        quran: { label: "قرآن", note: "پڑھیں، سمجھیں، موازنہ کریں اور سیکھیں" },
        stories: { label: "کہانیاں اور تاریخ", note: "مکمل قرآنی سفر دریافت کریں" },
        learn: { label: "سیکھیں اور غور کریں", note: "مستند تعلیمات پر عمل کریں" },
        knowledge: { label: "علم دریافت کریں", note: "تخلیق، سائنس اور گہرے موضوعات" },
        community: { label: "کمیونٹی", note: "رہنمائی حاصل کریں اور دوسروں کے ساتھ سیکھیں" },
      },
      all: "تمام حصے",
    },
  });
