import { ReviewQueue } from "@/components/admin/tools";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function ReviewPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Review queue</h1>
      <p className="zq-meta">Drafts, items in scholarly review and corrections. Approving records a review; publishing is refused by the database until the evidence and reviews are in place.</p>
      <ReviewQueue canReview={admin || roles.includes("scholarly_reviewer")} canEdit={admin || roles.includes("editor")} />
    </div>
  );
}
