/**
 * The gate every translation / commentary / hadith import passes first: the edition must be registered in
 * translation_editions, verified by an editor (translator, edition, year and origin checked), linked to a source whose
 * licence is cleared, and come from the provider being imported. Nothing is fetched for an edition that fails.
 */
import { CLEARED, ImportRefused, type RightsStatus } from "./common";

export interface EditionGateRow {
  id: string;
  kind: "quran_translation" | "tafsir" | "early_tafsir" | "hadith_translation" | "hadith_commentary";
  language: string;
  title: string;
  edition: string | null;
  origin: string;
  origin_ref: string | null;
  registry_status: "candidate" | "verified" | "rejected";
  translator: string | null;
  source: { id: string; type: string; rights_status: RightsStatus; work: string } | null;
}

export function assertEditionImportable(e: EditionGateRow | null, expect: { origin: string | string[]; kind: EditionGateRow["kind"] | Array<EditionGateRow["kind"]>; originRef?: string }) {
  if (!e) throw new ImportRefused("edition_not_registered", "No translation_editions row for this provider reference. Register the edition in /admin/editions first.");
  const origins = Array.isArray(expect.origin) ? expect.origin : [expect.origin];
  const kinds = Array.isArray(expect.kind) ? expect.kind : [expect.kind];
  if (!origins.includes(e.origin)) throw new ImportRefused("wrong_origin", `Edition "${e.title}" is registered with origin ${e.origin}, not ${origins.join("/")}.`);
  if (!kinds.includes(e.kind)) throw new ImportRefused("wrong_kind", `Edition "${e.title}" is a ${e.kind}, not ${kinds.join("/")}.`);
  if (expect.originRef && e.origin_ref !== expect.originRef) throw new ImportRefused("wrong_ref", `Edition "${e.title}" has provider reference ${e.origin_ref}, not ${expect.originRef}.`);
  if (e.registry_status !== "verified") throw new ImportRefused("edition_not_verified", `Edition "${e.title}" is ${e.registry_status}: an editor must verify translator, edition, year and origin first.`);
  if (!e.source) throw new ImportRefused("no_source", `Edition "${e.title}" has no source record.`);
  if (!CLEARED.has(e.source.rights_status)) throw new ImportRefused("licence_not_cleared", `The licence for "${e.source.work}" is ${e.source.rights_status}: only cleared or public-domain sources are imported.`);
  if (!e.translator) throw new ImportRefused("no_translator", `Edition "${e.title}" names no translator or scholar: attribution is required.`);
  return e as EditionGateRow & { source: NonNullable<EditionGateRow["source"]>; translator: string };
}
