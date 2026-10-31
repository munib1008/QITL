import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { EditorialStatus } from "@/components/ui/evidence";
import { adminStrings } from "@/lib/i18n/modules/admin";

async function count(table: string, status: string) {
  const sb = await getServerSupabase();
  if (!sb) return 0;
  const { count: n } = await sb.from(table).select("*", { count: "exact", head: true }).eq("status", status);
  return n ?? 0;
}

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const a = adminStrings((await params).locale);
  const [claims, events, stories, reports, corrections] = await Promise.all([
    count("evidence_claims", "in_review"),
    count("historical_events", "in_review"),
    count("stories", "in_review"),
    count("reports", "open"),
    count("correction_requests", "open"),
  ]);
  const tiles: Array<[string, number, string]> = [
    [a.tiles.claims, claims, "/admin/review"],
    [a.tiles.events, events, "/admin/review"],
    [a.tiles.stories, stories, "/admin/review"],
    [a.tiles.reports, reports, "/admin/moderation"],
    [a.tiles.corrections, corrections, "/admin/corrections"],
  ];
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{a.overview}</h1>
      <div className="zq-grid">
        {tiles.map(([label, n, href]) => (
          <Link key={label} href={href} className="zq-card" style={{ textDecoration: "none", color: "var(--ink)", maxWidth: "none" }}>
            <p className="zq-eyebrow">{label}</p>
            <b style={{ font: "600 32px/1 var(--font-display)" }}>{n}</b>
          </Link>
        ))}
      </div>
      <section className="pp-card">
        <h3>{a.workflow}</h3>
        <p style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: 0 }}>
          <EditorialStatus status="draft" /> → <EditorialStatus status="in_review" /> → <EditorialStatus status="approved" /> → <EditorialStatus status="published" />
        </p>
        <p className="zq-meta" style={{ margin: 0 }}>
          {a.workflowNote}
        </p>
      </section>
    </div>
  );
}
