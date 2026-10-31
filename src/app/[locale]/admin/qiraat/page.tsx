import { QiraatAdmin } from "@/components/admin/QiraatAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function QiraatAdminPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Qira&apos;at</h1>
      <p className="zq-meta">
        Variants, transmission routes, misconceptions, reciters and recordings. Drafts only: scholarly reviewers approve them in the review queue, and the database refuses to publish without the
        evidence, the review and an allowing licence.
      </p>
      <QiraatAdmin canEdit={roles.includes("admin") || roles.includes("editor")} canReview={roles.includes("admin") || roles.includes("scholarly_reviewer")} />
    </div>
  );
}
