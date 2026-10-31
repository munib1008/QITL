import { ModerationQueue } from "@/components/admin/tools";
import { adminStrings } from "@/lib/i18n/modules/admin";

export default async function ModerationPage({ params }: { params: Promise<{ locale: string }> }) {
  const a = adminStrings((await params).locale).pages["moderation"]!;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{a.title}</h1>
      <p className="zq-meta">{a.lead}</p>
      <ModerationQueue />
    </div>
  );
}
