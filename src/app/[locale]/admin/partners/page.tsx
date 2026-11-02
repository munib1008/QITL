import { AdminPartners } from "@/components/partners/AdminPartners";
import { PaymentsNotice, VerificationNotice } from "@/components/partners/shared";
import { partnersT } from "@/lib/i18n/modules/partners";

/** Learning Partners review console (inside the editorial shell, which gates on a staff role; the database decides every action). */
export default async function AdminPartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = partnersT(locale);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{t.admin.title}</h1>
      <AdminPartners locale={locale} />
      <div className="pt">
        <VerificationNotice t={t} />
        <PaymentsNotice t={t} />
      </div>
    </div>
  );
}
