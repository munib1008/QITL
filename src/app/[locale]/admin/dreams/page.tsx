import { AdminDreams } from "@/components/dreams/AdminDreams";
import { dreamsT } from "@/lib/i18n/modules/dreams";

/** Dream request administration: assignment from metadata only (inside the editorial shell). */
export default async function AdminDreamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = dreamsT(locale);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{t.admin.title}</h1>
      <AdminDreams locale={locale} />
    </div>
  );
}
