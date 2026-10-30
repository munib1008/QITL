import { ExplanationEditor } from "@/components/admin/interpretation";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function ExplanationsPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Explanations and checks</h1>
      <p className="zq-meta">
        QITL Explanatory Summaries, human or AI-assisted. An explanation is never a translation. It publishes only after all eight checks pass on its current version, each signed by its role, and a scholarly approval.
      </p>
      <ExplanationEditor roles={roles} />
    </div>
  );
}
