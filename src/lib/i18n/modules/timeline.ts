/**
 * The Complete Timeline & Event Universe interface strings (en, ar, ur). Interface text only: no Quran text, no
 * narrative, no date. Arabic and Urdu are DRAFTS that need a qualified translator; any key left out falls back to English.
 */
import { moduleStrings, type DeepPartial } from "./index";

const en = {
  view: { label: "Timeline view", journey: "The Journey (guided)", complete: "The Complete Timeline" },
  draft: "Draft translation: awaiting a qualified translator.",
  complete: {
    title: "The Complete Timeline",
    lead: "A research atlas of every identified Quranic narrative event, person and community. Items appear only after scholarly review. Where the order or the date is not established, it says so; nothing is dated by guesswork.",
    scale: "Not to scale. Order is shown only where a cited basis exists.",
    synthetic: "These are synthetic test items for the automated browser tests. They are not real events.",
    jumpLabel: "Jump to a lane",
    count: "{n} items shown",
    countOne: "1 item shown",
    noneShown: "No track is selected. Turn a track on to see its items.",
    notConnected: "The atlas is not connected to its database on this deployment yet.",
    loadError: "The atlas could not be loaded. Please try again later.",
  },
  filters: {
    legend: "Tracks",
    hint: "Choose which tracks to show. Every track is on by default.",
    all: "All tracks",
    none: "Clear",
    apply: "Apply",
    summary: "{shown} of {total} tracks shown",
    status: "Showing {shown} of {total} tracks.",
  },
  tracks: {
    prophets: { name: "Prophets & Messengers", note: "The prophets and messengers the Quran names or describes." },
    people: { name: "People & Families", note: "Individuals and families who are not prophets." },
    communities: { name: "Communities", note: "Peoples and groups: 'Ad, Thamud, Madyan, Banu Isra'il and others." },
    events: { name: "Major Events", note: "Events the Quran narrates or refers to." },
    parables: { name: "Parables", note: "Examples the Quran sets forth. Never given a date." },
    seerah: { name: "Revelation & Seerah", note: "The revelation and the life of the Prophet." },
  },
  lanes: {
    relative: { title: "Relative order", note: "Ordering only: which comes before which, with a cited basis. No years are claimed." },
    dated: { title: "Historians' estimates", note: "Dates here are historians' estimates from a named publication and method. They are not statements of the Quran." },
    disputed: { title: "Order disputed", note: "Scholars place these differently. Each view is listed with its source." },
    not_established: { title: "Order not established", note: "No ordering is established for these items yet. They are listed without any order or date." },
    parable: { title: "Parables", note: "No historical date assigned. A parable is an example, not an event in time." },
  },
  eras: {
    sacred_history: "Sacred history",
    prophetic_life: "The life of the Prophet ﷺ",
    islamic_history: "Islamic history",
  },
  order: {
    relative: "Relative order only. No date",
    disputed: "Order disputed",
    disputedViews: "Order disputed: {n} views",
    notEstablished: "Order not established",
    parable: "No historical date assigned",
    estimate: "Historians' estimate",
    method: "Method",
    position: "Position {n} in this track (ordering only)",
  },
  name: {
    later: "Named in later tradition, not in the Quranic text",
    laterShort: "Name from later tradition",
  },
  card: {
    verses: "Verses",
    status: "Reviewed",
    open: "Read about this event",
    atlas: "Show on the atlas",
    genealogy: "See in the genealogy",
    showMore: "Show {n} more",
    track: "Track",
    ordering: "Order and date",
  },
  empty: {
    title: "No items in the Complete Timeline are published yet.",
    body: "Every item is checked against the Quran text and reviewed by a scholar before it appears here. Nothing is shown until then, and nothing is dated by guesswork.",
    underReview: "{n} inventory items are under review.",
    underReviewOne: "1 inventory item is under review.",
    perTrack: "Under review by track",
    counts: "Counts only: titles are not shown before review.",
  },
  event: {
    verses: "Verses",
    versesNote: "References to the Quran text. The passage is read in the Quran reader.",
    identifications: "Identifications and traditions",
    identificationsNote: "These are claims from later sources, not statements of the Quran. Where scholars differ, every view is listed.",
    subjectViews: "Views on: {subject}",
    standing: { disputed: "Disputed", widely_held: "Widely held", minority: "Minority view", later_tradition: "Later tradition" },
    kinds: { identification: "Identification", name: "Name", ordering: "Order", dating: "Dating" },
    connections: "Connections",
    connectionKinds: { involves: "Involves", takes_place_at: "Takes place at", same_community: "Same community", related: "Related", lineage: "Lineage" },
    stories: "Related stories",
    track: "Track",
    order: "Order and date",
    noConnections: "No connections are published for this item yet.",
  },
};

export type TimelineStrings = typeof en;

const ar: DeepPartial<TimelineStrings> = {
  view: { label: "عرض الخط الزمني", journey: "الرحلة (موجَّهة)", complete: "الخط الزمني الكامل" },
  draft: "ترجمة أولية بانتظار مترجم مؤهل.",
  complete: {
    title: "الخط الزمني الكامل",
    lead: "أطلس بحثي لكل حدث وشخص وجماعة وردت في السرد القرآني وتم تحديدها. لا يظهر أي عنصر إلا بعد المراجعة العلمية. وحيث لا يثبت الترتيب أو التاريخ يُذكر ذلك صراحة، ولا يُؤرَّخ شيء بالتخمين.",
    scale: "ليس بمقياس رسم. لا يُعرض الترتيب إلا حيث يوجد سند موثّق.",
    count: "{n} عنصرًا معروضًا",
    countOne: "عنصر واحد معروض",
    noneShown: "لم يُحدَّد أي مسار. فعّل مسارًا لعرض عناصره.",
  },
  filters: {
    legend: "المسارات",
    hint: "اختر المسارات التي تريد عرضها. جميع المسارات مفعّلة افتراضيًا.",
    all: "كل المسارات",
    none: "مسح",
    apply: "تطبيق",
    summary: "{shown} من {total} مسارات معروضة",
    status: "عُرض {shown} من {total} مسارات.",
  },
  tracks: {
    prophets: { name: "الأنبياء والمرسلون" },
    people: { name: "أشخاص وأسر" },
    communities: { name: "الأقوام والجماعات" },
    events: { name: "الأحداث الكبرى" },
    parables: { name: "الأمثال" },
    seerah: { name: "الوحي والسيرة" },
  },
  lanes: {
    relative: { title: "ترتيب نسبي" },
    dated: { title: "تقديرات المؤرخين" },
    disputed: { title: "ترتيب مختلف فيه" },
    not_established: { title: "الترتيب غير ثابت" },
    parable: { title: "الأمثال" },
  },
  order: {
    relative: "ترتيب نسبي فقط، بلا تاريخ",
    disputed: "الترتيب مختلف فيه",
    notEstablished: "الترتيب غير ثابت",
    parable: "لا تاريخ تاريخي مُحدَّد",
    estimate: "تقدير المؤرخين",
  },
  name: { later: "اسم ورد في المرويات المتأخرة، وليس في النص القرآني", laterShort: "اسم من المرويات المتأخرة" },
  card: { verses: "الآيات", status: "تمت مراجعته", open: "اقرأ عن هذا الحدث", atlas: "اعرضه على الأطلس", genealogy: "انظر في شجرة النسب", showMore: "اعرض {n} أخرى" },
  empty: {
    title: "لم يُنشر بعدُ أي عنصر في الخط الزمني الكامل.",
    underReview: "{n} عنصرًا في الجرد قيد المراجعة.",
    underReviewOne: "عنصر واحد في الجرد قيد المراجعة.",
  },
  event: {
    verses: "الآيات",
    identifications: "التعيينات والمرويات",
    identificationsNote: "هذه أقوال من مصادر متأخرة وليست من نص القرآن. وحيث يختلف العلماء تُعرض كل الأقوال.",
    connections: "الصلات",
    stories: "قصص ذات صلة",
  },
};

const ur: DeepPartial<TimelineStrings> = {
  view: { label: "ٹائم لائن کا منظر", journey: "سفر (رہنمائی کے ساتھ)", complete: "مکمل ٹائم لائن" },
  draft: "ابتدائی ترجمہ، مستند مترجم کا منتظر۔",
  complete: {
    title: "مکمل ٹائم لائن",
    lead: "قرآنی بیان کے ہر شناخت شدہ واقعے، شخصیت اور جماعت کا تحقیقی اٹلس۔ کوئی چیز علمی جائزے کے بعد ہی ظاہر ہوتی ہے۔ جہاں ترتیب یا تاریخ ثابت نہیں وہاں صاف لکھا ہے؛ اندازے سے کوئی تاریخ نہیں دی جاتی۔",
    scale: "پیمانے کے مطابق نہیں۔ ترتیب صرف وہیں دکھائی جاتی ہے جہاں حوالہ موجود ہو۔",
    noneShown: "کوئی ٹریک منتخب نہیں۔ اس کی چیزیں دیکھنے کے لیے ٹریک آن کریں۔",
  },
  filters: { legend: "ٹریک", hint: "منتخب کریں کہ کون سے ٹریک دکھائے جائیں۔ سب ٹریک پہلے سے آن ہیں۔", all: "تمام ٹریک", none: "صاف کریں", apply: "لاگو کریں" },
  tracks: {
    prophets: { name: "انبیاء و رسل" },
    people: { name: "شخصیات اور خاندان" },
    communities: { name: "اقوام و جماعتیں" },
    events: { name: "بڑے واقعات" },
    parables: { name: "امثال" },
    seerah: { name: "وحی اور سیرت" },
  },
  lanes: {
    relative: { title: "اضافی ترتیب" },
    dated: { title: "مؤرخین کے اندازے" },
    disputed: { title: "ترتیب میں اختلاف" },
    not_established: { title: "ترتیب ثابت نہیں" },
    parable: { title: "امثال" },
  },
  order: {
    relative: "صرف اضافی ترتیب، کوئی تاریخ نہیں",
    disputed: "ترتیب میں اختلاف",
    notEstablished: "ترتیب ثابت نہیں",
    parable: "کوئی تاریخی تاریخ مقرر نہیں",
    estimate: "مؤرخین کا اندازہ",
  },
  name: { later: "نام بعد کی روایت میں آیا ہے، قرآنی متن میں نہیں", laterShort: "بعد کی روایت کا نام" },
  card: { verses: "آیات", status: "جائزہ شدہ", open: "اس واقعے کے بارے میں پڑھیں", atlas: "اٹلس پر دکھائیں", genealogy: "شجرۂ نسب میں دیکھیں" },
  empty: { title: "مکمل ٹائم لائن میں ابھی کچھ شائع نہیں ہوا۔" },
  event: { verses: "آیات", identifications: "شناختیں اور روایات", connections: "تعلقات", stories: "متعلقہ کہانیاں" },
};

export const timeline = { en, ar, ur };

export const timelineStrings = (locale: string): TimelineStrings => moduleStrings<TimelineStrings>(locale, { en, ar, ur });

/** "Showing {n}" style templates. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}
