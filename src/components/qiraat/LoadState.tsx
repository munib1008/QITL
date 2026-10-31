import { EmptyState } from "@/components/ui/misc";

interface Texts {
  emptyTitle: string;
  emptyBody: string | readonly string[];
  notConfigured: string;
  loadError: string;
}

/** The designed empty / unavailable state for a load result with nothing published. */
export function LoadState({ state, t }: { state: "ok" | "error" | "not_configured"; t: Texts }) {
  const body = typeof t.emptyBody === "string" ? [t.emptyBody] : t.emptyBody;
  return (
    <EmptyState title={state === "error" ? t.loadError : t.emptyTitle}>
      {body.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {state === "not_configured" ? <p>{t.notConfigured}</p> : null}
    </EmptyState>
  );
}
