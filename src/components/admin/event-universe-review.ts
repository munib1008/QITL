import type { SupabaseClient } from "@supabase/supabase-js";
import type { EditorialState } from "@/components/ui/evidence";

/** Identification, name, ordering and dating claims and connections of the Event Universe, in the shared review queue. */
export type EventUniverseReviewKind = "event_identification" | "event_connection";

export interface EventUniverseReviewable {
  id: string;
  status: EditorialState;
  label: string;
  kind: EventUniverseReviewKind;
  detail?: string;
}

const OPEN = ["draft", "in_review", "approved", "published", "correction", "rejected"];

export async function loadEventUniverseReviewables(c: SupabaseClient): Promise<EventUniverseReviewable[]> {
  const [ids, conns] = await Promise.all([
    c.from("event_identifications").select("id, status, kind, subject, view, standing, historical_events(title, track)").in("status", OPEN).limit(200),
    c.from("event_connections").select("id, status, kind, target_kind, historical_events!event_connections_event_id_fkey(title)").in("status", OPEN).limit(200),
  ]);
  const out: EventUniverseReviewable[] = [];
  for (const r of (ids.data ?? []) as unknown as Array<{ id: string; status: EditorialState; kind: string; subject: string; view: string; standing: string; historical_events: { title: string; track: string | null } | null }>)
    out.push({
      id: r.id,
      status: r.status,
      kind: "event_identification",
      label: `${r.historical_events?.title ?? "Event"} · ${r.kind}: ${r.subject}`,
      detail: `${r.standing.replace(/_/g, " ")}: ${r.view}`,
    });
  for (const r of (conns.data ?? []) as unknown as Array<{ id: string; status: EditorialState; kind: string; target_kind: string; historical_events: { title: string } | null }>)
    out.push({ id: r.id, status: r.status, kind: "event_connection", label: `${r.historical_events?.title ?? "Event"} · ${r.kind.replace(/_/g, " ")} (${r.target_kind})`, detail: "A cited connection to an event, person, community or place" });
  return out;
}
