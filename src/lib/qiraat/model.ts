/**
 * Qira'at & Ahruf Learning Centre: shared types and pure rules (no I/O). The database enforces the same rules again
 * (supabase/migrations/20261031002100..002120); these copies drive the UI and the unit tests.
 *
 * The reference list below holds NAMES ONLY (Arabic and transliteration) of the ten readers and their twenty
 * transmitters, the same rows the migration seeds as drafts. No dates, biographies, chains or readings.
 */

export const PERMISSION_STATUSES = ["APPROVED", "CONDITIONAL", "PERMISSION_REQUIRED", "BLOCKED"] as const;
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

export const ASSET_TYPES = ["text", "recording", "font", "image", "translation", "tafsir", "metadata", "api"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const TRISTATE = ["allowed", "conditional", "not_allowed", "unknown"] as const;
export type TriState = (typeof TRISTATE)[number];

export const VARIANT_KINDS = ["pronunciation", "vocalization", "morphology", "word_form", "meaning"] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

export interface PermissionLike {
  status: PermissionStatus;
  attribution_text: string | null;
}

/** Allowed for display: APPROVED, or CONDITIONAL with the attribution recorded (public.content_permission_allowed). */
export function permissionAllowed(p: PermissionLike | null | undefined): boolean {
  if (!p) return false;
  return p.status === "APPROVED" || (p.status === "CONDITIONAL" && Boolean(p.attribution_text?.trim()));
}

export interface ReaderRef {
  id: string;
  nameAr: string;
  name: string;
  riwayat: Array<{ id: string; nameAr: string; name: string }>;
}

export const READERS: ReaderRef[] = [
  { id: "nafi", nameAr: "نافع", name: "Nafi'", riwayat: [{ id: "qalun", nameAr: "قالون", name: "Qalun" }, { id: "warsh", nameAr: "ورش", name: "Warsh" }] },
  { id: "ibn_kathir", nameAr: "ابن كثير", name: "Ibn Kathir", riwayat: [{ id: "bazzi", nameAr: "البزي", name: "al-Bazzi" }, { id: "qunbul", nameAr: "قنبل", name: "Qunbul" }] },
  { id: "abu_amr", nameAr: "أبو عمرو", name: "Abu 'Amr", riwayat: [{ id: "duri_abu_amr", nameAr: "الدوري", name: "al-Duri" }, { id: "susi", nameAr: "السوسي", name: "al-Susi" }] },
  { id: "ibn_amir", nameAr: "ابن عامر", name: "Ibn 'Amir", riwayat: [{ id: "hisham", nameAr: "هشام", name: "Hisham" }, { id: "ibn_dhakwan", nameAr: "ابن ذكوان", name: "Ibn Dhakwan" }] },
  { id: "asim", nameAr: "عاصم", name: "'Asim", riwayat: [{ id: "shubah", nameAr: "شعبة", name: "Shu'bah" }, { id: "hafs", nameAr: "حفص", name: "Hafs" }] },
  { id: "hamzah", nameAr: "حمزة", name: "Hamzah", riwayat: [{ id: "khalaf", nameAr: "خلف", name: "Khalaf" }, { id: "khallad", nameAr: "خلاد", name: "Khallad" }] },
  { id: "kisai", nameAr: "الكسائي", name: "al-Kisa'i", riwayat: [{ id: "abu_al_harith", nameAr: "أبو الحارث", name: "Abu al-Harith" }, { id: "duri_kisai", nameAr: "الدوري", name: "al-Duri" }] },
  { id: "abu_jafar", nameAr: "أبو جعفر", name: "Abu Ja'far", riwayat: [{ id: "ibn_wardan", nameAr: "ابن وردان", name: "Ibn Wardan" }, { id: "ibn_jammaz", nameAr: "ابن جماز", name: "Ibn Jammaz" }] },
  { id: "yaqub", nameAr: "يعقوب", name: "Ya'qub", riwayat: [{ id: "ruways", nameAr: "رويس", name: "Ruways" }, { id: "rawh", nameAr: "روح", name: "Rawh" }] },
  { id: "khalaf_ashir", nameAr: "خلف العاشر", name: "Khalaf al-'Ashir", riwayat: [{ id: "ishaq", nameAr: "إسحاق", name: "Ishaq" }, { id: "idris", nameAr: "إدريس", name: "Idris" }] },
];

export const RIWAYAH_IDS = READERS.flatMap((r) => r.riwayat.map((w) => w.id));

/** "Hafs 'an 'Asim", "al-Duri 'an Abi 'Amr" style label from the reference list. */
export function riwayahLabel(id: string): string {
  for (const r of READERS)
    for (const w of r.riwayat) if (w.id === id) return `${w.name} 'an ${r.name === "Abu 'Amr" ? "Abi 'Amr" : r.name === "Abu Ja'far" ? "Abi Ja'far" : r.name}`;
  return id;
}

/** The one text edition QITL shows today (content/quran, seeded as quran_text_editions.is_default). */
export const CURRENT_EDITION = { riwayahId: "hafs", label: "Hafs 'an 'Asim", edition: "Tanzil Uthmani v1.1" } as const;

/** Authentic narrations on the seven ahruf, cited as references only: their text is never typed here. */
export const AHRUF_HADITH_REFS = [
  { collection: "bukhari", collectionName: "Sahih al-Bukhari", number: "4991", href: "/hadith/bukhari/4991" },
  { collection: "bukhari", collectionName: "Sahih al-Bukhari", number: "4992", href: "/hadith/bukhari/4992" },
  { collection: "muslim", collectionName: "Sahih Muslim", number: "818", href: "/hadith/muslim/818" },
] as const;

export interface VariantReading {
  riwayah_id: string;
  reading_text: string;
  edition_id: string;
  edition_title?: string | null;
  attribution?: string | null;
}

export interface Variant {
  id: string;
  surah: number;
  ayah: number;
  word_position: number;
  kind: VariantKind;
  readings: VariantReading[];
  claims: Array<{ id: string; statement: string; evidence: string }>;
}

/** What still blocks a variant from publishing (mirrors guard_qiraat_variant). Empty = publishable. */
export function variantPublishProblems(v: {
  readings: Array<{ riwayah_id: string; editionAllowed: boolean }>;
  claims: Array<{ status: string }>;
  reviewApproved: boolean;
}): string[] {
  const out: string[] = [];
  if (new Set(v.readings.map((r) => r.riwayah_id)).size < 2) out.push("needs readings from at least two riwayat");
  if (v.readings.some((r) => !r.editionAllowed)) out.push("every reading's edition must be APPROVED, or CONDITIONAL with attribution recorded");
  if (!v.claims.length) out.push("needs an explanation claim");
  else if (v.claims.some((c) => c.status !== "approved" && c.status !== "published")) out.push("every explanation claim must be approved");
  if (!v.reviewApproved) out.push("needs a scholarly approval");
  return out;
}

/** Text/audio riwayah rule (mirrors guard_audio_recording): a mismatch only as an explained comparison. */
export function recordingMatchesText(rec: { riwayah_id: string; is_comparison: boolean; comparison_note: string | null }, textRiwayah: string): boolean {
  return rec.riwayah_id === textRiwayah || (rec.is_comparison && (rec.comparison_note ?? "").trim().length >= 20);
}

/** Group readings by riwayah for the side-by-side view, in the reference order of the riwayat. */
export function comparisonColumns(variants: Variant[]): string[] {
  const used = new Set(variants.flatMap((v) => v.readings.map((r) => r.riwayah_id)));
  return RIWAYAH_IDS.filter((id) => used.has(id));
}
