/**
 * Life Guidance interface strings. English is the reviewed source; the Arabic is a first draft that still needs review
 * by a qualified translator (as for the rest of the Arabic interface). These are interface words only: lesson text,
 * verses and advice come from reviewed database rows, never from this file.
 */
import type { Locale } from "../dict";
import { resolveLocale } from "../locales";

const en = {
  nav: "Life Guidance",
  exploreNote: "What are you facing today?",
  title: "What are you facing today?",
  kicker: "Life Guidance",
  lead: "Short, reviewed lessons that connect a situation to what the Quran and authentic hadith say, how recognised scholars explain it, and an everyday application suggested by QITL.",
  notice: {
    title: "Educational, not a personal ruling or therapy",
    body: "These pages teach. They are not a fatwa for your situation and they are not counselling or medical care. For a ruling on your own circumstances, ask a qualified mufti.",
    noAi: "A reviewed lesson is written by editors from approved sources and published after scholarly review. Until a lesson is reviewed it may appear as a labelled AI-assisted draft written from the Quran only; it is never presented as reviewed.",
    draftLabels: { situation: "The situation", quran_says: "What the Quran says", prophet_experience: "A prophet's experience", everyday_application: "An everyday application (QITL's suggestion)", limits: "What this does not cover" },
  },
  askMufti: "Ask a Mufti for a personal ruling",
  askMuftiNote: "Questions are answered by verified muftis, not by this page.",
  safety: {
    title: "Your wellbeing comes first",
    body: "If what you are facing is affecting your health, sleep, safety or ability to cope, please speak to a doctor or a qualified mental-health professional.",
    crisis: "If you or someone else is in immediate danger, or you are thinking about harming yourself, contact your local emergency services now.",
    reviewedNotes: "Reviewed notes for this topic",
  },
  topicsHeading: "Topics",
  plannedHeading: "Topics in preparation",
  plannedNote: "These topics are planned. Each opens only after its lessons pass scholarly review; until then it has no lesson text.",
  inPreparation: "In preparation",
  emptyTitle: "No guidance is published yet.",
  emptyNotConnected: "Life Guidance is not connected yet.",
  emptyBody: "Each lesson is built from approved claims: the verses or authentic hadith, a named scholar's explanation, and a clearly labelled everyday suggestion. Nothing appears until a scholarly reviewer approves it.",
  topicEmptyTitle: "This topic has no published lessons yet.",
  topicEmptyBody: "Its lessons are being prepared and will appear only after scholarly review. In the meantime, the guidance below still applies.",
  backToTopics: "All topics",
  lessonsHeading: "Lessons",
  layers: {
    revelation: "What revelation says",
    revelationNote: "The Quran and authentic hadith, with their references.",
    scholarly: "How scholars explain it",
    scholarlyNote: "Explanations by named scholars, with the work they come from.",
    application: "Everyday application",
    applicationLabel: "QITL's educational suggestion — not a ruling",
    applicationNote: "A suggestion by QITL's editors for reflection. It is not part of revelation and not a scholar's ruling.",
  },
  scholarIn: "in",
  graded: "graded",
  by: "by",
  relatedHeading: "Related prophets and stories",
  relatedKinds: { person: "Prophet", event: "Event", story: "Story", creation: "Creation" },
  reviewed: "Reviewed",
  version: "Version",
} as const;

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type GuidanceStrings = Shape<typeof en>;

const ar: GuidanceStrings = {
  nav: "إرشاد الحياة",
  exploreNote: "ماذا تواجه اليوم؟",
  title: "ماذا تواجه اليوم؟",
  kicker: "إرشاد الحياة",
  lead: "دروس قصيرة مراجَعة تربط الموقف بما يقوله القرآن والحديث الصحيح، وبشرح العلماء المعتبرين، وبتطبيق يومي يقترحه فريق QITL.",
  notice: {
    title: "محتوى تعليمي، وليس فتوى شخصية ولا علاجًا",
    body: "هذه الصفحات للتعلّم. ليست فتوى لحالتك، وليست استشارة نفسية أو رعاية طبية. للحكم في ظروفك الخاصة اسأل مفتيًا مؤهلًا.",
    noAi: "تُكتب الدروس المراجَعة بيد محررين من مصادر معتمدة وتُنشر بعد المراجعة العلمية. وإلى أن يُراجَع الدرس قد يظهر مسودةً موسومةً بمساعدة الذكاء الاصطناعي مكتوبةً من القرآن وحده، ولا تُقدَّم قط على أنها مراجَعة.",
    draftLabels: { situation: "الحال", quran_says: "ماذا يقول القرآن", prophet_experience: "تجربة نبي", everyday_application: "تطبيق يومي (اقتراح QITL)", limits: "ما لا يشمله هذا" },
  },
  askMufti: "اسأل مفتيًا عن حكم يخصّك",
  askMuftiNote: "يجيب عن الأسئلة مفتون موثّقون، لا هذه الصفحة.",
  safety: {
    title: "صحتك أولًا",
    body: "إن كان ما تمرّ به يؤثر في صحتك أو نومك أو سلامتك أو قدرتك على التحمّل، فتحدّث إلى طبيب أو مختص مؤهل في الصحة النفسية.",
    crisis: "إن كنت أنت أو غيرك في خطر مباشر، أو تفكّر في إيذاء نفسك، فاتصل بخدمات الطوارئ المحلية الآن.",
    reviewedNotes: "ملاحظات مراجَعة لهذا الموضوع",
  },
  topicsHeading: "الموضوعات",
  plannedHeading: "موضوعات قيد الإعداد",
  plannedNote: "هذه موضوعات مخطط لها. لا يُفتح أي منها إلا بعد أن تجتاز دروسه المراجعة العلمية، وحتى ذلك الحين لا نص فيه.",
  inPreparation: "قيد الإعداد",
  emptyTitle: "لم يُنشر أي إرشاد بعد.",
  emptyNotConnected: "إرشاد الحياة غير متصل بعد.",
  emptyBody: "يُبنى كل درس من ادعاءات معتمدة: الآيات أو الأحاديث الصحيحة، وشرح عالم مسمّى، واقتراح يومي موسوم بوضوح. لا يظهر شيء قبل موافقة مراجع علمي.",
  topicEmptyTitle: "لا توجد دروس منشورة لهذا الموضوع بعد.",
  topicEmptyBody: "تُعدّ دروسه الآن ولن تظهر إلا بعد المراجعة العلمية. وحتى ذلك الحين يبقى الإرشاد أدناه قائمًا.",
  backToTopics: "كل الموضوعات",
  lessonsHeading: "الدروس",
  layers: {
    revelation: "ما يقوله الوحي",
    revelationNote: "القرآن والحديث الصحيح مع مراجعهما.",
    scholarly: "كيف يشرحه العلماء",
    scholarlyNote: "شروح لعلماء مسمَّين مع الكتاب الذي وردت فيه.",
    application: "التطبيق اليومي",
    applicationLabel: "اقتراح تعليمي من QITL — ليس حكمًا شرعيًا",
    applicationNote: "اقتراح من محرري QITL للتأمل. ليس من الوحي وليس فتوى عالم.",
  },
  scholarIn: "في",
  graded: "درجته",
  by: "عند",
  relatedHeading: "أنبياء وقصص ذات صلة",
  relatedKinds: { person: "نبي", event: "حدث", story: "قصة", creation: "خلق" },
  reviewed: "روجِع",
  version: "الإصدار",
};

/** Draft Urdu (written by hand from the English): needs review by a qualified translator, like the Arabic. */
const ur: GuidanceStrings = {
  nav: "زندگی کی رہنمائی",
  exploreNote: "آج آپ کو کیا درپیش ہے؟",
  title: "آج آپ کو کیا درپیش ہے؟",
  kicker: "زندگی کی رہنمائی",
  lead: "مختصر، جائزہ شدہ اسباق جو کسی صورتِ حال کو اس سے جوڑتے ہیں جو قرآن اور صحیح احادیث کہتی ہیں، مستند علماء اس کی وضاحت کیسے کرتے ہیں، اور QITL کی تجویز کردہ روزمرہ عملی صورت۔",
  notice: {
    title: "تعلیمی مواد، ذاتی فتویٰ یا علاج نہیں",
    body: "یہ صفحات تعلیم دیتے ہیں۔ یہ آپ کی صورتِ حال کے لیے فتویٰ نہیں، اور نہ ہی مشاورت یا طبی نگہداشت ہیں۔ اپنے حالات پر شرعی حکم کے لیے کسی مستند مفتی سے پوچھیں۔",
    noAi: "جائزہ شدہ سبق مدیران منظور شدہ مآخذ سے لکھتے ہیں اور علمی جائزے کے بعد شائع ہوتا ہے۔ جائزے سے پہلے سبق AI کی مدد سے لکھے گئے، صرف قرآن پر مبنی، واضح لیبل والے مسودے کے طور پر ظاہر ہو سکتا ہے؛ اسے کبھی جائزہ شدہ کے طور پر پیش نہیں کیا جاتا۔",
    draftLabels: { situation: "صورتِ حال", quran_says: "قرآن کیا کہتا ہے", prophet_experience: "ایک نبی کا تجربہ", everyday_application: "روزمرہ اطلاق (QITL کی تجویز)", limits: "یہ کیا شامل نہیں کرتا" },
  },
  askMufti: "ذاتی شرعی حکم کے لیے مفتی سے پوچھیں",
  askMuftiNote: "سوالات کے جواب تصدیق شدہ مفتیان دیتے ہیں، یہ صفحہ نہیں۔",
  safety: {
    title: "آپ کی خیریت سب سے پہلے",
    body: "اگر آپ کو درپیش معاملہ آپ کی صحت، نیند، حفاظت یا برداشت کی صلاحیت کو متاثر کر رہا ہے تو براہِ کرم کسی ڈاکٹر یا ذہنی صحت کے مستند ماہر سے بات کریں۔",
    crisis: "اگر آپ یا کوئی اور فوری خطرے میں ہے، یا آپ خود کو نقصان پہنچانے کا سوچ رہے ہیں، تو ابھی اپنی مقامی ہنگامی سروس سے رابطہ کریں۔",
    reviewedNotes: "اس موضوع کے جائزہ شدہ نوٹس",
  },
  topicsHeading: "موضوعات",
  plannedHeading: "زیرِ تیاری موضوعات",
  plannedNote: "یہ موضوعات منصوبے میں ہیں۔ ہر موضوع اپنے اسباق کے علمی جائزے سے گزرنے کے بعد ہی کھلتا ہے؛ تب تک اس میں کوئی سبق نہیں۔",
  inPreparation: "زیرِ تیاری",
  emptyTitle: "ابھی کوئی رہنمائی شائع نہیں ہوئی۔",
  emptyNotConnected: "زندگی کی رہنمائی ابھی منسلک نہیں ہوئی۔",
  emptyBody: "ہر سبق منظور شدہ دعووں سے بنتا ہے: آیات یا صحیح احادیث، کسی نامزد عالم کی وضاحت، اور واضح نشان والی روزمرہ تجویز۔ جب تک کوئی علمی جائزہ کار منظوری نہ دے، کچھ ظاہر نہیں ہوتا۔",
  topicEmptyTitle: "اس موضوع کا ابھی کوئی سبق شائع نہیں ہوا۔",
  topicEmptyBody: "اس کے اسباق تیار ہو رہے ہیں اور علمی جائزے کے بعد ہی ظاہر ہوں گے۔ اس دوران نیچے دی گئی رہنمائی بدستور لاگو ہے۔",
  backToTopics: "تمام موضوعات",
  lessonsHeading: "اسباق",
  layers: {
    revelation: "وحی کیا کہتی ہے",
    revelationNote: "قرآن اور صحیح احادیث، ان کے حوالوں کے ساتھ۔",
    scholarly: "علماء اس کی وضاحت کیسے کرتے ہیں",
    scholarlyNote: "نامزد علماء کی وضاحتیں، اس کتاب کے ساتھ جس سے وہ لی گئی ہیں۔",
    application: "روزمرہ عملی صورت",
    applicationLabel: "QITL کی تعلیمی تجویز — شرعی حکم نہیں",
    applicationNote: "غور و فکر کے لیے QITL کے مدیران کی ایک تجویز۔ یہ نہ وحی کا حصہ ہے نہ کسی عالم کا فتویٰ۔",
  },
  scholarIn: "در",
  graded: "درجہ",
  by: "از",
  relatedHeading: "متعلقہ انبیاء اور قصے",
  relatedKinds: { person: "نبی", event: "واقعہ", story: "قصہ", creation: "مخلوق" },
  reviewed: "جائزہ شدہ",
  version: "ورژن",
};

export const guidanceStrings: Record<Locale, GuidanceStrings> = { en, ar, ur };

export function guidanceT(locale: string): GuidanceStrings {
  return guidanceStrings[resolveLocale(locale)];
}
