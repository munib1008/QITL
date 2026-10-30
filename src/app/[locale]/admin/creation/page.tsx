import { CreationEditor } from "@/components/admin/CreationEditor";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function CreationAdmin() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Creation Atlas</h1>
      <p className="zq-meta">
        Profiles and their entries move from draft to scholarly review to published. Reviewers approve each row in the review queue; the database refuses to
        publish an entry without an approved claim and an approval, and a profile until it has a published entry.
      </p>
      <CreationEditor canEdit={roles.includes("admin") || roles.includes("editor")} />
    </div>
  );
}
