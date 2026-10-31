import { HadithStoriesAdmin } from "@/components/admin/HadithStoriesAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

export default async function HadithStoriesAdminPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const admin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Hadith stories</h1>
      <p className="zq-meta">
        Draft stories that point at authentic narrations (Sahih al-Bukhari, Sahih Muslim, or an individually graded sahih narration of Tirmidhi or Ibn Majah), and the
        scholarly review of their authenticity. Publishing is refused by the database until the evidence is in place and a scholarly reviewer other than the author has
        approved the current version.
      </p>
      <HadithStoriesAdmin canEdit={admin || roles.includes("editor")} canReview={admin || roles.includes("scholarly_reviewer")} />
    </div>
  );
}
