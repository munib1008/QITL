import type {
  CommunityListItem,
  CommunityPage,
  EncyclopediaCounts,
  PersonListItem,
  PersonPage,
  StoryDetail,
  StoryListItem,
} from "./model";
import { personGroup } from "./model";

/**
 * Synthetic records for the automated browser tests (active only with QITL_E2E_FIXTURES=1 and no Supabase; see
 * src/lib/e2e-fixtures.ts). Every title says "Test", no narration text or grading is present, the verse references are
 * real references so the deep links work, and nothing here is a real story, person, community or relationship.
 */
const n = (en: string | null, ar: string | null = null, ur: string | null = null) => ({ en, ar, ur });

const rawStories: StoryDetail[] = [
  {
    slug: "fixture-story-a",
    title: n("Test story A", "قصة اختبار أ", "ٹیسٹ کہانی الف"),
    narrator: n("Test narrator", "راوٍ للاختبار", "ٹیسٹ راوی"),
    kind: "clarifies_quranic_story",
    summary: n("A synthetic summary for automated tests. It is not a real story.", "ملخص اصطناعي للاختبار الآلي.", "خودکار جانچ کے لیے مصنوعی خلاصہ۔"),
    people: [{ slug: "fixture-person-a", name_en: "Test person A", name_ar: "شخص اختبار أ" }],
    communities: [{ slug: "fixture-community-a", name_en: "Test community A", name_ar: null }],
    themes: [{ slug: "fixture-theme", title_en: "Test theme", title_ar: "موضوع اختبار" }],
    primary: { collection: "Sahih al-Bukhari", number: "1" },
    context: n(null),
    version: 1,
    narrations: [
      { id: "n1", primary: true, variantNote: null, collection: "bukhari", number: "1", numbering: "Test numbering", arabic: null, translation: null, textAllowed: false, attribution: null, gradings: [], relied: null },
      { id: "n2", primary: false, variantNote: "Test variant label", collection: "muslim", number: "1", numbering: "Test numbering", arabic: null, translation: null, textAllowed: false, attribution: null, gradings: [], relied: null },
    ],
    quran: [{ claimId: "c1", statement: "A synthetic claim for testing only.", refs: [{ surah: 12, from: 4, to: 5 }] }],
    lessons: [
      { kind: "lesson", body: n("A synthetic lesson for automated tests."), position: 1 },
      { kind: "modern_application", body: n("A synthetic application for automated tests."), position: 1 },
    ],
    events: [{ slug: "fixture-event-a", title: "Test event A", title_ar: null }],
  },
  {
    slug: "fixture-story-b",
    title: n("Test story B"),
    narrator: n("Another test narrator"),
    kind: "independent_lesson",
    summary: n("A second synthetic summary for automated tests."),
    people: [],
    communities: [],
    themes: [{ slug: "fixture-theme", title_en: "Test theme", title_ar: "موضوع اختبار" }],
    primary: { collection: "Sahih Muslim", number: "2" },
    context: n(null),
    version: 1,
    narrations: [{ id: "n3", primary: true, variantNote: null, collection: "muslim", number: "2", numbering: "Test numbering", arabic: null, translation: null, textAllowed: false, attribution: null, gradings: [], relied: null }],
    quran: [],
    lessons: [],
    events: [],
  },
];

export const fixtureStories = (): StoryListItem[] => rawStories.map(({ context: _c, version: _v, narrations: _n, quran: _q, lessons: _l, events: _e, ...list }) => list);
export const fixtureStory = (slug: string): StoryDetail | undefined => rawStories.find((s) => s.slug === slug);

const evidence = [{ claimId: "c1", statement: "A synthetic claim for testing only.", evidence: "scholar", verses: [{ surah: 12, from: 4, to: 5 }] }];
const subject = { slug: "fixture-person-a", title: "Test item: person a", track: "people", name_source: "later_tradition" as const, verses: [{ surah: 12, from: 4, to: 5 }], identifications: [{ kind: "name", subject: "Test name", view: "A synthetic name from later tradition, for testing only.", standing: "later_tradition" }] };

const rawPeople: PersonPage[] = [
  { slug: "fixture-person-a", name_en: "Test person A", name_ar: "شخص اختبار أ", honorific: null, summary: "A synthetic person for automated tests.", kind: "other", encyclopedia_kind: "ruler", group: "ruler", aliases: [{ alias: "Test alias", language: "en" }], evidence, subject, family: [{ kind: "parent_of", direction: "out", other: { slug: "fixture-person-b", name_en: "Test person B", name_ar: null }, confidence: "scholar", statement: "A synthetic relationship for testing only.", competing: false }], events: [{ slug: "fixture-event-a", title: "Test event A", title_ar: null, role: null }], hadithStories: fixtureStories().slice(0, 1), lifespan: null, journeyHref: null },
  { slug: "fixture-person-b", name_en: "Test person B", name_ar: null, honorific: null, summary: null, kind: "other", encyclopedia_kind: "unnamed", group: "unnamed", aliases: [], evidence, subject: null, family: [], events: [], hadithStories: [], lifespan: null, journeyHref: null },
  { slug: "fixture-prophet-a", name_en: "Test prophet A", name_ar: "نبي اختبار أ", honorific: null, summary: null, kind: "prophet", encyclopedia_kind: "prophet", group: "prophet", aliases: [], evidence, subject: { ...subject, slug: "fixture-prophet-a", track: "prophets", name_source: "quran", identifications: [] }, family: [], events: [], hadithStories: [], lifespan: null, journeyHref: null },
  { slug: "fixture-person-c", name_en: "Test person C", name_ar: null, honorific: null, summary: null, kind: "companion", encyclopedia_kind: null, group: "individual", aliases: [], evidence: [], subject: null, family: [], events: [], hadithStories: [], lifespan: null, journeyHref: null },
];
export const fixturePeople = (): PersonListItem[] =>
  rawPeople.map((p) => ({ slug: p.slug, name_en: p.name_en, name_ar: p.name_ar, honorific: p.honorific, kind: p.kind, encyclopedia_kind: p.encyclopedia_kind, group: personGroup(p), name_source: p.subject?.name_source ?? null }));
export const fixturePerson = (slug: string): PersonPage | undefined => rawPeople.find((p) => p.slug === slug);

const rawCommunities: CommunityPage[] = [
  { slug: "fixture-community-a", name_en: "Test community A", name_ar: "جماعة اختبار أ", summary: "A synthetic community for automated tests.", era: null, place: null, evidence, subject: { ...subject, slug: "fixture-community-a", track: "communities", name_source: "quran", identifications: [] }, events: [{ slug: "fixture-event-a", title: "Test event A", title_ar: null, role: null }], hadithStories: fixtureStories().slice(0, 1) },
  { slug: "fixture-community-b", name_en: "Test community B", name_ar: null, summary: null, era: null, place: null, evidence: [], subject: null, events: [], hadithStories: [] },
];
export const fixtureCommunities = (): CommunityListItem[] => rawCommunities.map((c) => ({ slug: c.slug, name_en: c.name_en, name_ar: c.name_ar, name_source: c.subject?.name_source ?? null }));
export const fixtureCommunity = (slug: string): CommunityPage | undefined => rawCommunities.find((c) => c.slug === slug);

export function fixtureCounts(kind: "hadith_story" | "person" | "community"): EncyclopediaCounts {
  const published = kind === "hadith_story" ? rawStories.length : kind === "person" ? rawPeople.length : rawCommunities.length;
  return { published, under_review: 5 };
}
