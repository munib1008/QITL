import { VerificationAdmin } from "@/components/admin/VerificationAdmin";
import { adminVerificationStrings } from "@/lib/i18n/modules/adminVerification";

/** Read-only verification console. The admin layout shows the designed not-configured, signed-out and no-role states before this. */
export default async function VerificationConsolePage({ params }: { params: Promise<{ locale: string }> }) {
  const t = adminVerificationStrings((await params).locale);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{t.pageTitle}</h1>
      <p className="zq-meta">{t.pageLead}</p>
      <VerificationAdmin />
    </div>
  );
}
