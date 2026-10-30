import { AudioDesk } from "@/components/admin/studio/AudioDesk";
import { getPlayerStrings } from "@/lib/i18n/modules/player";

export default async function AudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = getPlayerStrings(locale).studio;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{s.audioQa}</h1>
      <AudioDesk locale={locale} />
    </div>
  );
}
