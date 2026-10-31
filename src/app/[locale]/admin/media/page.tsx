import { MediaAdmin } from "@/components/admin/MediaAdmin";
import { getUser } from "@/lib/supabase/server";
import { rolesOf } from "@/lib/admin";

/**
 * Media Library: upload, validate, scan, confirm non-figurative, religious review, approve, publish, replace and
 * clean up images. The admin layout shows the designed not-configured / signed-out / no-role states before this.
 */
export default async function MediaPage() {
  const { sb, user } = await getUser();
  const roles = sb && user ? await rolesOf(sb, user.id) : [];
  const isAdmin = roles.includes("admin");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Media Library</h1>
      <p className="zq-meta" style={{ margin: 0 }}>
        Non-figurative images only: no prophet, Companion or member of the Ahl al-Bayt, no angels, jinn or the unseen, and no human figures in religious scenes. Every file version is scanned (or its skipped scan acknowledged by an admin), confirmed non-figurative, reviewed by a scholarly reviewer, approved and only then published. Images render on the site only while published and licensed.
      </p>
      <MediaAdmin
        isEditor={isAdmin || roles.includes("editor")}
        isReviewer={isAdmin || roles.includes("scholarly_reviewer")}
        isAdmin={isAdmin}
        scannerConfigured={Boolean(process.env.MALWARE_SCAN_URL?.trim())}
        serviceConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
      />
    </div>
  );
}
