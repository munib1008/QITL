import { RelationshipEditor } from "@/components/admin/tools";
import { LineageAdmin } from "@/components/admin/LineageAdmin";
import { adminStrings } from "@/lib/i18n/modules/admin";

export default async function RelationshipsAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const a = adminStrings((await params).locale).pages["relationships"]!;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{a.title}</h1>
      <RelationshipEditor />
      <LineageAdmin />
    </div>
  );
}
