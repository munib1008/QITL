/**
 * Pure rules for what the Study panel may show. No I/O: unit-tested in tests/unit/interpretation.test.tsx.
 */
import {
  MAX_TRANSLATIONS,
  type DifferenceItem,
  type DifferenceKind,
  type EarlyTafsirSlot,
  type EditionInfo,
  type RightsStatus,
  type SlotState,
  type TafsirFlag,
  type TafsirSlot,
  type TranslationSlot,
} from "./types";

export const CLEARED: ReadonlySet<RightsStatus> = new Set(["cleared", "public_domain"]);

/** An edition's text is shown only when the edition is verified, its licence is cleared, and the text exists. */
export function slotState(edition: Pick<EditionInfo, "registryStatus" | "licence">, hasText: boolean): SlotState {
  if (edition.registryStatus !== "verified") return "unverified";
  if (!edition.licence || !CLEARED.has(edition.licence.rightsStatus)) return "licence_pending";
  return hasText ? "shown" : "not_imported";
}

const byPosition = (a: EditionInfo, b: EditionInfo) => (a.position ?? 999) - (b.position ?? 999) || a.title.localeCompare(b.title);

/**
 * Up to ten translation editions, side by side, in registry order. Rejected editions never appear. Early tafsir is
 * never one of them: it is commentary and has its own slot.
 */
export function translationSlots(editions: EditionInfo[], texts: Map<string, string>): TranslationSlot[] {
  return editions
    .filter((e) => e.kind === "quran_translation" && e.registryStatus !== "rejected")
    .sort(byPosition)
    .slice(0, MAX_TRANSLATIONS)
    .map((edition) => {
      const state = slotState(edition, texts.has(edition.id));
      return { edition, state, text: state === "shown" ? (texts.get(edition.id) ?? null) : null };
    });
}

export interface TafsirRow {
  editionId: string;
  text: string;
  flags: TafsirFlag[];
  reviewNote: string | null;
  from: number;
  to: number;
}

export function earlyTafsirSlot(editions: EditionInfo[], rows: TafsirRow[]): EarlyTafsirSlot {
  const edition = editions.filter((e) => e.kind === "early_tafsir" && e.registryStatus !== "rejected").sort(byPosition)[0] ?? null;
  if (!edition) return { edition: null, state: "not_imported", text: null, flags: [], reviewNote: null };
  const row = rows.find((r) => r.editionId === edition.id);
  const state = slotState(edition, Boolean(row));
  return { edition, state, text: state === "shown" ? (row?.text ?? null) : null, flags: row?.flags ?? [], reviewNote: row?.reviewNote ?? null };
}

export function tafsirSlots(editions: EditionInfo[], rows: TafsirRow[]): TafsirSlot[] {
  return editions
    .filter((e) => e.kind === "tafsir" && e.registryStatus !== "rejected")
    .sort(byPosition)
    .map((edition) => {
      const row = rows.find((r) => r.editionId === edition.id);
      const state = slotState(edition, Boolean(row));
      return {
        edition,
        state,
        text: state === "shown" ? (row?.text ?? null) : null,
        flags: row?.flags ?? [],
        reviewNote: row?.reviewNote ?? null,
        range: row ? { from: row.from, to: row.to } : null,
      };
    });
}

export const DIFFERENCE_KINDS: DifferenceKind[] = ["translation_choice", "linguistic", "grammatical", "exegetical"];

/** Differences grouped by kind, in a fixed order. Nothing is merged across kinds; empty kinds are omitted. */
export function groupDifferences(items: DifferenceItem[]): Array<{ kind: DifferenceKind; items: DifferenceItem[] }> {
  return DIFFERENCE_KINDS.map((kind) => ({ kind, items: items.filter((d) => d.kind === kind) })).filter((g) => g.items.length);
}

/** "Translator · edition · year · licence" — every item names all four, with an explicit "not recorded". */
export function attributionParts(e: EditionInfo, unknown: string) {
  return {
    person: e.translator?.name ?? unknown,
    edition: [e.title, e.edition].filter(Boolean).join(", ") || unknown,
    year: e.year ? String(e.year) : unknown,
    licence: e.licence ? (CLEARED.has(e.licence.rightsStatus) ? (e.licence.text ?? e.licence.rightsStatus.replace("_", " ")) : e.licence.rightsStatus.replace("_", " ")) : unknown,
  };
}

/** "Ask a Mufti" about an ayah: the Mufti Q&A ask form, with the verse as the question's topic. */
export function askMuftiHref(surah: number, ayah: number): string {
  return `/community/questions/ask?topic=quran_verse&ref=${encodeURIComponent(`${surah}:${ayah}`)}`;
}
