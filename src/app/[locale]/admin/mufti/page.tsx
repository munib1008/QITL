import { AdminMufti } from "@/components/mufti/AdminMufti";
import { AdminApplications } from "@/components/mufti/AdminApplications";
import { muftiT } from "@/lib/i18n/modules/mufti";

/** Mufti Q&A administration (inside the editorial shell, which gates on a staff role). */
export default async function AdminMuftiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = muftiT(locale);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{t.admin.title}</h1>
      <div className="qa">
        <AdminApplications locale={locale} />
      </div>
      <AdminMufti locale={locale} />
    </div>
  );
}
