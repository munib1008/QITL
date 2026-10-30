import { StoryEditor } from "@/components/admin/StoryEditor";
import { journeyStops } from "@/content/journey";

export default function StoryEditorPage() {
  const stops = journeyStops()
    .filter((s) => s.type === "prophet")
    .map((s) => ({ id: s.id, name: s.name, arabicName: s.arabicName, honorific: s.honorific }));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Story editor</h1>
      <p className="zq-meta">
        Every prophet and Quranic event uses the same sections, A to G, in three reading levels. Each section rests on a referenced claim and is published
        only after scholarly review. Use only the Quran and authentic narrations from Bukhari, Muslim, Tirmidhi and Ibn Majah, each with its named grading.
      </p>
      <StoryEditor stops={stops} />
    </div>
  );
}
