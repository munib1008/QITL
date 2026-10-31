/**
 * Qira'at & Ahruf Learning Centre interface strings (en, ar, ur). Interface text only: no Quran text, no reading, no
 * hadith text and no scholarly ruling is written here. The distinction panel is a neutral draft pending scholarly
 * review and says so. Arabic and Urdu are first drafts awaiting a qualified translator; Urdu falls back to English.
 */
import { moduleStrings, type DeepPartial } from "./index";

const en = {
  nav: "Qira'at & Ahruf",
  navNote: "The seven ahruf, the ten readings and what QITL can show",
  title: "Seven Ahruf and the ten Qira'at",
  lead: "What the authentic narrations say about the seven ahruf, how they differ from the canonical readings (qira'at), and which readings QITL can show today.",
  draft: "Draft — pending scholarly review",
  tabs: { hub: "Overview", compare: "Compare readings" },
  hadith: {
    title: "The seven ahruf in the authentic narrations",
    lead: "These narrations are referenced here and not quoted. Their text and translation appear only from a licensed edition, after the numbering has been checked against it.",
    licencePending: "Text unavailable — licence pending",
    numbering:
      "Numbering differs between editions; it is checked against the licensed edition before any text is shown.",
  },
  distinction: {
    title: "Ahruf and qira'at are not the same thing",
    points: [
      "The seven ahruf are modes in which the Quran was revealed, as the narrations above state. Their exact nature is debated among scholars.",
      "The seven ahruf are not the same as the seven or ten canonical qira'at, which are later named readings, each transmitted through its own narrators.",
      "The seven ahruf are not simply seven tribal dialects.",
    ],
    note: "This panel is a short neutral summary. It will be replaced by reviewed explanations with their sources.",
  },
  readers: {
    title: "The ten readers and their twenty transmitters",
    lead: "Each reader (qari') is followed by his two transmitters (rawi). Names only; dates and chains are added only with sources after review.",
    reader: "Reader",
    transmitters: "Transmitters",
    emptyTitle: "The readers' table is not published yet.",
    emptyBody:
      "The ten readers and twenty transmitters are entered as drafts and appear here after a scholarly reviewer approves them.",
    notConfigured: "The database is not connected on this deployment.",
    loadError: "The table could not be loaded. Please try again later.",
  },
  available: {
    title: "What is available now",
    now: "Available",
    nowItem:
      "Hafs 'an 'Asim — the Arabic text from Tanzil (Uthmani, version 1.1), shown in the Quran reader with its attribution.",
    notYet: "Not yet licensed",
    notYetBody:
      "No other riwayah's text or recitation is licensed for QITL yet. Each needs a text edition and a written permission or published licence before anything is shown.",
    audio: "No recitation audio is approved yet.",
    licences: "How each source is licensed",
    openReader: "Open the Quran reader",
  },
  misconceptions: {
    title: "Common misconceptions",
    lead: "Each misconception is answered only by a reviewed explanation with its sources.",
    empty: "No reviewed explanation has been published yet.",
  },
  compare: {
    title: "Compare readings",
    lead: "Side-by-side readings of one word, each copied from a licensed text edition of its riwayah, with a reviewed explanation.",
    emptyTitle: "No comparison can be shown yet.",
    emptyBody: [
      "A comparison appears only when both readings come from text editions whose licences allow display, the difference is explained by approved evidence, and a scholarly reviewer has approved it.",
      "Today QITL holds one licensed text, Hafs 'an 'Asim from Tanzil. No other riwayah's text is licensed, so there is nothing to compare against.",
    ],
    notConfigured: "The database is not connected on this deployment.",
    loadError: "The comparisons could not be loaded. Please try again later.",
    word: "word",
    kind: {
      pronunciation: "Pronunciation",
      vocalization: "Vocalisation",
      morphology: "Morphology",
      word_form: "Word form",
      meaning: "Meaning",
    },
    explanation: "Explanation",
    ref: (s: number, a: number, w: number) => `Q ${s}:${a}, word ${w}`,
  },
  riwayah: {
    label: "Riwayah",
    current: "Hafs 'an 'Asim — Tanzil Uthmani v1.1",
    choose: "Other riwayat",
    unavailable: "not available: edition and licence not secured",
    help: "Only the Hafs 'an 'Asim text is licensed for QITL. Other riwayat appear here once a text edition and its licence are secured.",
    learn: "About the qira'at",
    audioNone: "No approved recitation for this riwayah yet.",
    audioTitle: "Recitation",
    reciter: "Reciter",
  },
};

export type QiraatStrings = typeof en;

const ar: DeepPartial<QiraatStrings> = {
  nav: "القراءات والأحرف",
  navNote: "الأحرف السبعة والقراءات العشر وما يعرضه الموقع",
  title: "الأحرف السبعة والقراءات العشر",
  lead: "ما ورد في الأحاديث الصحيحة عن الأحرف السبعة، وكيف تختلف عن القراءات المتواترة، وأي القراءات يعرضها الموقع اليوم.",
  draft: "مسودة — بانتظار المراجعة العلمية",
  tabs: { hub: "نظرة عامة", compare: "مقارنة القراءات" },
  hadith: {
    title: "الأحرف السبعة في الأحاديث الصحيحة",
    lead: "هذه الأحاديث مشار إليها هنا دون نقل نصها. يظهر النص والترجمة من طبعة مرخصة فقط بعد مطابقة الترقيم.",
    licencePending: "النص غير متاح — الترخيص قيد الانتظار",
    numbering: "يختلف الترقيم بين الطبعات، ويُطابَق مع الطبعة المرخصة قبل عرض أي نص.",
  },
  distinction: {
    title: "الأحرف ليست هي القراءات",
    points: [
      "الأحرف السبعة أوجه نزل بها القرآن كما في الأحاديث أعلاه، واختلف العلماء في تحديد معناها.",
      "الأحرف السبعة ليست هي القراءات السبع أو العشر المتواترة، وهي قراءات منسوبة إلى أئمتها نقلها رواتها.",
      "الأحرف السبعة ليست مجرد سبع لهجات قبلية.",
    ],
    note: "هذه خلاصة محايدة قصيرة، وستُستبدل بشروح مراجَعة مع مصادرها.",
  },
  readers: {
    title: "القراء العشرة ورواتهم العشرون",
    lead: "يلي كل قارئ راوياه. الأسماء فقط؛ ولا تضاف التواريخ والأسانيد إلا بمصادر بعد المراجعة.",
    reader: "القارئ",
    transmitters: "الراويان",
    emptyTitle: "جدول القراء لم يُنشر بعد.",
    emptyBody: "أُدخل القراء العشرة والرواة العشرون مسودات، ويظهرون هنا بعد موافقة المراجع العلمي.",
    notConfigured: "قاعدة البيانات غير متصلة في هذا النشر.",
    loadError: "تعذر تحميل الجدول. حاول لاحقاً.",
  },
  available: {
    title: "المتاح الآن",
    now: "متاح",
    nowItem: "رواية حفص عن عاصم — النص العربي من تنزيل (الرسم العثماني، الإصدار 1.1) في قارئ القرآن مع بيان المصدر.",
    notYet: "غير مرخص بعد",
    notYetBody:
      "لا يوجد بعد ترخيص لنص أو تلاوة أي رواية أخرى. تحتاج كل رواية إلى طبعة نصية وإذن مكتوب أو ترخيص منشور قبل عرض أي شيء.",
    audio: "لا توجد تلاوة صوتية معتمدة بعد.",
    licences: "ترخيص كل مصدر",
    openReader: "افتح قارئ القرآن",
  },
  misconceptions: {
    title: "مفاهيم خاطئة شائعة",
    lead: "لا يُجاب عن أي مفهوم إلا بشرح مراجَع مع مصادره.",
    empty: "لم يُنشر أي شرح مراجَع بعد.",
  },
  compare: {
    title: "مقارنة القراءات",
    lead: "قراءات كلمة واحدة جنباً إلى جنب، كل منها منقولة من طبعة نصية مرخصة لروايتها، مع شرح مراجَع.",
    emptyTitle: "لا يمكن عرض أي مقارنة بعد.",
    emptyBody: [
      "تظهر المقارنة فقط عندما تأتي القراءتان من طبعتين يسمح ترخيصهما بالعرض، ويُشرح الفرق بأدلة معتمدة، ويوافق عليها مراجع علمي.",
      "لدى الموقع اليوم نص مرخص واحد هو رواية حفص عن عاصم من تنزيل، ولا يوجد نص مرخص لرواية أخرى للمقارنة.",
    ],
    notConfigured: "قاعدة البيانات غير متصلة في هذا النشر.",
    loadError: "تعذر تحميل المقارنات. حاول لاحقاً.",
    word: "الكلمة",
    kind: {
      pronunciation: "النطق",
      vocalization: "الضبط",
      morphology: "الصرف",
      word_form: "صورة الكلمة",
      meaning: "المعنى",
    },
    explanation: "الشرح",
  },
  riwayah: {
    label: "الرواية",
    current: "حفص عن عاصم — تنزيل، الرسم العثماني 1.1",
    choose: "روايات أخرى",
    unavailable: "غير متاحة: لم تُؤمَّن الطبعة والترخيص",
    help: "نص رواية حفص عن عاصم هو الوحيد المرخص للموقع. تظهر الروايات الأخرى هنا بعد تأمين طبعة نصية وترخيصها.",
    learn: "عن القراءات",
    audioNone: "لا توجد تلاوة معتمدة لهذه الرواية بعد.",
    audioTitle: "التلاوة",
    reciter: "القارئ",
  },
};

const ur: DeepPartial<QiraatStrings> = {
  nav: "قراءات و احرف",
  title: "سات احرف اور دس قراءات",
  draft: "مسودہ — علمی جائزے کا منتظر",
  riwayah: {
    label: "روایت",
    current: "حفص عن عاصم — تنزیل عثمانی 1.1",
    unavailable: "دستیاب نہیں: ایڈیشن اور لائسنس حاصل نہیں",
  },
};

export const qiraat = { en, ar, ur };

export const qiraatStrings = (locale: string): QiraatStrings => moduleStrings<QiraatStrings>(locale, { en, ar, ur });
