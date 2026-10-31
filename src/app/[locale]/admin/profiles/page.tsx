import { FullScreenEditor } from "@/components/admin/FullScreenEditor";
import { StoryEditor } from "@/components/admin/StoryEditor";
import { journeyStops } from "@/content/journey";
import { adminStrings } from "@/lib/i18n/modules/admin";

export default async function StoryEditorPage({ params }: { params: Promise<{ locale: string }> }) {
  const a = adminStrings((await params).locale).pages["profiles"]!;
  const stops = journeyStops()
    .filter((s) => s.type === "prophet")
    .map((s) => ({ id: s.id, name: s.name, arabicName: s.arabicName, honorific: s.honorific }));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{a.title}</h1>
      <p className="zq-meta">{a.lead}</p>
      <FullScreenEditor title={a.title}>
        <StoryEditor stops={stops} />
      </FullScreenEditor>
    </div>
  );
}
