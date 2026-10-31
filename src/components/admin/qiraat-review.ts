import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditorialState } from "@/components/ui/evidence";
import { riwayahLabel } from "@/lib/qiraat/model";

/** Qira'at rows in the shared review queue. Each kind is its own entity type in editorial_reviews and /api/admin/status. */
export type QiraatReviewKind = "transmission_route" | "qiraat_variant" | "qiraat_misconception" | "reciter" | "audio_recording";

export interface QiraatReviewable {
  id: string;
  status: EditorialState;
  label: string;
  kind: QiraatReviewKind;
  detail?: string;
}

const OPEN = ["draft", "in_review", "approved", "published", "correction", "rejected"];

export async function loadQiraatReviewables(c: SupabaseClient): Promise<QiraatReviewable[]> {
  const [routes, variants, mis, reciters, recs] = await Promise.all([
    c.from("transmission_routes").select("id, status, riwayah_id, name_translit, locator").in("status", OPEN).limit(100),
    c.from("qiraat_variants").select("id, status, surah, ayah, word_position, kind, qiraat_variant_readings(riwayah_id, reading_text)").in("status", OPEN).limit(100),
    c.from("qiraat_misconceptions").select("id, status, question, evidence_claims(statement)").in("status", OPEN).limit(100),
    c.from("reciters").select("id, status, name_translit").in("status", OPEN).limit(100),
    c.from("audio_recordings").select("id, status, riwayah_id, surah, is_comparison, comparison_note, reciters(name_translit)").in("status", OPEN).limit(100),
  ]);
  const out: QiraatReviewable[] = [];
  for (const r of (routes.data ?? []) as Array<{ id: string; status: EditorialState; riwayah_id: string; name_translit: string; locator: string | null }>)
    out.push({ id: r.id, status: r.status, kind: "transmission_route", label: `Route: ${riwayahLabel(r.riwayah_id)} · ${r.name_translit}`, detail: r.locator ? `Citation: ${r.locator}` : "Cited by an evidence claim" });
  for (const v of (variants.data ?? []) as unknown as Array<{ id: string; status: EditorialState; surah: number; ayah: number; word_position: number; kind: string; qiraat_variant_readings: Array<{ riwayah_id: string; reading_text: string }> }>)
    out.push({
      id: v.id,
      status: v.status,
      kind: "qiraat_variant",
      label: `Variant Q ${v.surah}:${v.ayah}, word ${v.word_position} (${v.kind.replace("_", " ")})`,
      detail: v.qiraat_variant_readings.map((r) => `${riwayahLabel(r.riwayah_id)}: ${r.reading_text}`).join(" · ") || "No readings yet",
    });
  for (const m of (mis.data ?? []) as unknown as Array<{ id: string; status: EditorialState; question: string; evidence_claims: { statement: string } | null }>)
    out.push({ id: m.id, status: m.status, kind: "qiraat_misconception", label: `Misconception: ${m.question}`, detail: m.evidence_claims?.statement.slice(0, 240) });
  for (const r of (reciters.data ?? []) as Array<{ id: string; status: EditorialState; name_translit: string }>)
    out.push({ id: r.id, status: r.status, kind: "reciter", label: `Reciter: ${r.name_translit}`, detail: "Name only: check the spelling" });
  for (const r of (recs.data ?? []) as unknown as Array<{ id: string; status: EditorialState; riwayah_id: string; surah: number | null; is_comparison: boolean; comparison_note: string | null; reciters: { name_translit: string } | null }>)
    out.push({
      id: r.id,
      status: r.status,
      kind: "audio_recording",
      label: `Recording: ${r.reciters?.name_translit ?? "Reciter"} · ${riwayahLabel(r.riwayah_id)} · ${r.surah ? `Surah ${r.surah}` : "whole Quran"}`,
      detail: r.is_comparison ? `Educational comparison: ${r.comparison_note ?? ""}` : "Check that the recitation is this riwayah. Publishing also needs an allowing licence.",
    });
  return out;
}
