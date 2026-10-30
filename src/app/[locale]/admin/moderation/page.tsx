import { ModerationQueue } from "@/components/admin/tools";

export default function ModerationPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Moderation</h1>
      <p className="zq-meta">Open reports, oldest first. Each decision is logged with its reason; the log keeps ids, not copies of what was written.</p>
      <ModerationQueue />
    </div>
  );
}
