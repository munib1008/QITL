/**
 * Creation Atlas (عالم الخلق) interface strings. These are interface words only: no religious statement is written
 * here. Every fact the module shows comes from a published, reviewed database row with its evidence class and
 * citation. English is the reviewed source; the Arabic strings are a first draft pending a qualified translator's
 * review, like the rest of the Arabic interface (src/lib/i18n/dict.ts).
 */
import type { Locale } from "../dict";

const en = {
  nav: { label: "Creation Atlas", note: "Humans, jinn, angels and more, with evidence" },
  title: "Creation Atlas",
  titleAr: "عالم الخلق",
  lead: "What the Quran and authentic hadith establish about created beings and the created world, each statement labelled by the kind of evidence it rests on.",
  intro: {
    heading: "About this atlas",
    body: [
      "Each entry here was written from a cited source, checked by a scholarly reviewer and published only after that review. Every entry shows its evidence class and its citation.",
      "Where the selected authentic sources say nothing, the atlas says so plainly. It never fills a gap with a guess, a story or a popular belief.",
    ],
    kids: "This page shows what the Quran and trusted hadith teach about the things Allah created. If the sources do not tell us something, we say “we do not know”.",
    visualCaption: "A decorative abstract pattern of orbits.",
  },
  notEstablished: "Not established by the selected authentic sources.",
  evidence: {
    revelation: "Revelation (Quran)",
    authentic_hadith: "Authentic hadith",
    scholarly_interpretation: "Scholarly interpretation",
    not_established: "Not established",
  },
  evidenceLegend: "Evidence classes",
  evidenceHelp: {
    revelation: "Stated in the Quran.",
    authentic_hadith: "Added by a narration graded authentic by a named grader.",
    scholarly_interpretation: "How scholars explain the texts; not itself revelation.",
    not_established: "The selected authentic sources do not establish it.",
  },
  sections: {
    categories: "Six areas of creation",
    compare: "Compare: humans, jinn and angels",
    graph: "How they relate",
    stories: "Story library",
    misconceptions: "What we know — and what we do not know",
    sources: "Verified sources",
  },
  jump: "On this page",
  kids: { label: "Kids mode", on: "Kids mode is on: simpler words and calmer visuals. The evidence stays the same.", off: "Kids mode" },
  categories: {
    profiles: (n: number) => (n === 1 ? "1 published profile" : `${n} published profiles`),
    none: "No profiles published yet.",
  },
  compare: {
    help: "Each cell shows a published, reviewed entry with its evidence class and citation. An empty cell means the selected authentic sources do not establish it — it is never filled with an assumption.",
    aspect: "Aspect",
    more: (n: number) => `+${n} more on the profile`,
    openProfile: "Open profile",
    rows: {
      origin: "Origin",
      nature: "Nature",
      purpose: "Purpose",
      abilities: "Abilities",
      limitations: "Limitations",
      relationship_with_humans: "Relationship with humans",
    },
    kidsRows: {
      origin: "Where they came from",
      nature: "What they are like",
      purpose: "Why they were created",
      abilities: "What they can do",
      limitations: "What they cannot do",
      relationship_with_humans: "How they relate to people",
    },
  },
  graph: {
    help: "Each line is one relationship that rests on a reviewed claim. The list after the diagram gives the same relationships as text.",
    diagramLabel: (n: number) => `Diagram of ${n} relationships. The same relationships are listed after it.`,
    truncated: (n: number) => `The diagram shows the first ${n} relationships; the list has all of them.`,
    list: "Relationships as a list",
    empty: "No relationships are published yet.",
    kinds: { creation: "creation", person: "person", event: "event", command: "command", community: "community", concept: "concept" },
  },
  stories: {
    help: "Stories are told through the story engine from reviewed claims.",
    empty: "No stories are published yet.",
    about: "About",
  },
  misconceptions: {
    help: "Common questions, answered only from the selected authentic sources. Where they are silent, the answer says so.",
    caution:
      "Never read anxiety, nightmares, low mood or any medical symptom as a sign of jinn activity. These are health matters: speak to a doctor or a qualified mental-health professional, and in an emergency contact your local emergency services.",
    cautionTitle: "Please read",
    empty: "No questions are published yet.",
    all: "All",
    filter: "Show questions about",
  },
  sources: {
    help: "Every citation used by a published entry in this atlas. Quran references open the verified text.",
    empty: "No sources yet: nothing is shown here until a scholarly reviewer approves it.",
  },
  empty: {
    notConfigured: "The Creation Atlas is not connected yet.",
    notConfiguredBody: "It reads reviewed entries from the database. Until it is connected, nothing is shown — no placeholder facts.",
    error: "The Creation Atlas could not be loaded.",
    nothingPublished: "Nothing is published yet.",
    nothingPublishedBody: "Entries appear only after their evidence is cited and a scholarly reviewer approves them.",
  },
  visual: {
    play: "Play",
    pause: "Pause",
    replay: "Replay",
    note: "Abstract illustration: it depicts no prophet, angel, jinn or anything unseen.",
  },
  profile: {
    crumb: "Profile",
    fields: {
      name: "Name",
      classification: "Classification",
      origin: "Origin",
      purpose: "Purpose",
      nature: "Nature",
      abilities: "Abilities",
      limitations: "Limitations",
      relationship_with_humans: "Relationship with humans",
      quranic_events: "Quranic events",
      related_hadith: "Related hadith",
      chronological_position: "Chronological position",
      location: "Location",
      misconceptions: "Misconceptions",
      lessons: "Lessons",
      vocabulary: "Vocabulary",
      sources: "Sources",
      review_status: "Review status",
    },
    kidsFields: {
      origin: "Where they came from",
      purpose: "Why they were created",
      nature: "What they are like",
      abilities: "What they can do",
      limitations: "What they cannot do",
      relationship_with_humans: "How they relate to people",
      lessons: "What we can learn",
      vocabulary: "New words",
    },
    everyday: "In everyday life",
    reviewed: (v: number, date: string) => `Published after scholarly review · version ${v} · updated ${date}`,
    reviewedField: "Reviewed profile field",
    contents: "Profile contents",
    notFound: "This profile is not published.",
  },
};

export type CreationStrings = typeof en;

const ar: CreationStrings = {
  nav: { label: "عالم الخلق", note: "الإنس والجن والملائكة وغيرها، مع الدليل" },
  title: "عالم الخلق",
  titleAr: "عالم الخلق",
  lead: "ما يثبته القرآن والحديث الصحيح عن المخلوقات وعالم الخلق، وكل عبارة موسومة بنوع الدليل الذي تقوم عليه.",
  intro: {
    heading: "عن هذا الأطلس",
    body: [
      "كُتب كل مدخل هنا من مصدر موثَّق، وراجعه مراجع شرعي، ولم يُنشر إلا بعد تلك المراجعة. ويُظهر كل مدخل نوع دليله وإحالته.",
      "وحيث تسكت المصادر الصحيحة المختارة يقول الأطلس ذلك صراحة، ولا يملأ الفراغ بظنٍّ ولا قصة ولا اعتقاد شائع.",
    ],
    kids: "تعرض هذه الصفحة ما يعلّمنا القرآن والحديث الصحيح عن مخلوقات الله. وإذا لم تخبرنا المصادر بشيء قلنا: «لا نعلم».",
    visualCaption: "نقش تجريدي زخرفي من المدارات.",
  },
  notEstablished: "لم يثبت في المصادر الصحيحة المختارة.",
  evidence: {
    revelation: "الوحي (القرآن)",
    authentic_hadith: "حديث صحيح",
    scholarly_interpretation: "تفسير العلماء",
    not_established: "لم يثبت",
  },
  evidenceLegend: "أنواع الدليل",
  evidenceHelp: {
    revelation: "منصوص عليه في القرآن.",
    authentic_hadith: "أضافته رواية صحّحها محدّث مسمّى.",
    scholarly_interpretation: "شرح العلماء للنصوص، وليس وحيًا بذاته.",
    not_established: "لا تثبته المصادر الصحيحة المختارة.",
  },
  sections: {
    categories: "ستة مجالات من الخلق",
    compare: "مقارنة: الإنس والجن والملائكة",
    graph: "العلاقات بينها",
    stories: "مكتبة القصص",
    misconceptions: "ما نعلمه وما لا نعلمه",
    sources: "المصادر الموثَّقة",
  },
  jump: "في هذه الصفحة",
  kids: { label: "وضع الأطفال", on: "وضع الأطفال مفعَّل: كلمات أبسط ورسوم أهدأ. والدليل لا يتغيّر.", off: "وضع الأطفال" },
  categories: {
    profiles: (n: number) => (n === 1 ? "ملف واحد منشور" : `${n} ملفات منشورة`),
    none: "لا ملفات منشورة بعد.",
  },
  compare: {
    help: "تعرض كل خانة مدخلًا منشورًا مراجَعًا مع نوع دليله وإحالته. والخانة الفارغة تعني أن المصادر الصحيحة المختارة لا تثبته، ولا تُملأ أبدًا بافتراض.",
    aspect: "الجانب",
    more: (n: number) => `+${n} في الملف`,
    openProfile: "افتح الملف",
    rows: {
      origin: "الأصل",
      nature: "الطبيعة",
      purpose: "الغاية",
      abilities: "القدرات",
      limitations: "الحدود",
      relationship_with_humans: "العلاقة بالإنسان",
    },
    kidsRows: {
      origin: "من أين جاؤوا",
      nature: "كيف هم",
      purpose: "لماذا خُلقوا",
      abilities: "ماذا يستطيعون",
      limitations: "ماذا لا يستطيعون",
      relationship_with_humans: "علاقتهم بالناس",
    },
  },
  graph: {
    help: "كل خط علاقة واحدة تقوم على دعوى مراجَعة. والقائمة بعد الرسم تعرض العلاقات نفسها نصًّا.",
    diagramLabel: (n: number) => `رسم يضم ${n} علاقة. والعلاقات نفسها مسرودة بعده.`,
    truncated: (n: number) => `يعرض الرسم أول ${n} علاقة، والقائمة تضمها كلها.`,
    list: "العلاقات في قائمة",
    empty: "لا علاقات منشورة بعد.",
    kinds: { creation: "مخلوق", person: "شخص", event: "حدث", command: "أمر", community: "قوم", concept: "مفهوم" },
  },
  stories: {
    help: "تُروى القصص عبر محرك القصص من دعاوى مراجَعة.",
    empty: "لا قصص منشورة بعد.",
    about: "عن",
  },
  misconceptions: {
    help: "أسئلة شائعة لا يُجاب عنها إلا من المصادر الصحيحة المختارة، وحيث تسكت يقول الجواب ذلك.",
    caution:
      "لا تفسّر القلق أو الكوابيس أو الحزن أو أي عرض صحي على أنه من فعل الجن. هذه أمور صحية: استشر طبيبًا أو مختصًّا مؤهلًا في الصحة النفسية، وفي الطوارئ اتصل بخدمات الطوارئ المحلية.",
    cautionTitle: "يُرجى القراءة",
    empty: "لا أسئلة منشورة بعد.",
    all: "الكل",
    filter: "اعرض الأسئلة عن",
  },
  sources: {
    help: "كل إحالة يستعملها مدخل منشور في هذا الأطلس. وإحالات القرآن تفتح النص الموثَّق.",
    empty: "لا مصادر بعد: لا يظهر هنا شيء حتى يعتمده مراجع شرعي.",
  },
  empty: {
    notConfigured: "عالم الخلق غير متصل بعد.",
    notConfiguredBody: "يقرأ المداخل المراجَعة من قاعدة البيانات. وإلى أن يتصل لا يظهر شيء، ولا حقائق بديلة.",
    error: "تعذّر تحميل عالم الخلق.",
    nothingPublished: "لم يُنشر شيء بعد.",
    nothingPublishedBody: "لا تظهر المداخل إلا بعد توثيق دليلها واعتماد مراجع شرعي لها.",
  },
  visual: {
    play: "تشغيل",
    pause: "إيقاف مؤقت",
    replay: "إعادة",
    note: "رسم تجريدي: لا يصوّر نبيًّا ولا مَلَكًا ولا جنيًّا ولا شيئًا من الغيب.",
  },
  profile: {
    crumb: "ملف",
    fields: {
      name: "الاسم",
      classification: "التصنيف",
      origin: "الأصل",
      purpose: "الغاية",
      nature: "الطبيعة",
      abilities: "القدرات",
      limitations: "الحدود",
      relationship_with_humans: "العلاقة بالإنسان",
      quranic_events: "أحداث قرآنية",
      related_hadith: "أحاديث ذات صلة",
      chronological_position: "الموضع الزمني",
      location: "المكان",
      misconceptions: "مفاهيم خاطئة",
      lessons: "الدروس",
      vocabulary: "المفردات",
      sources: "المصادر",
      review_status: "حالة المراجعة",
    },
    kidsFields: {
      origin: "من أين جاؤوا",
      purpose: "لماذا خُلقوا",
      nature: "كيف هم",
      abilities: "ماذا يستطيعون",
      limitations: "ماذا لا يستطيعون",
      relationship_with_humans: "علاقتهم بالناس",
      lessons: "ماذا نتعلم",
      vocabulary: "كلمات جديدة",
    },
    everyday: "في الحياة اليومية",
    reviewed: (v: number, date: string) => `نُشر بعد مراجعة شرعية · الإصدار ${v} · حُدّث ${date}`,
    reviewedField: "حقل مراجَع في الملف",
    contents: "محتويات الملف",
    notFound: "هذا الملف غير منشور.",
  },
};

export const creation: Record<"en" | "ar", CreationStrings> = { en, ar }; // Urdu falls back to English until reviewed Urdu strings exist

export function creationStrings(locale: string): CreationStrings {
  return locale === "ar" ? ar : en;
}
