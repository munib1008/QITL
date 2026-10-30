import { ProfileEditor } from "@/components/admin/ProfileEditor";
import { journeyStops } from "@/content/journey";

export default function ProfilesAdmin() {
  const stops = journeyStops()
    .filter((s) => s.type === "prophet")
    .map((s) => ({ id: s.id, name: s.name, arabicName: s.arabicName, honorific: s.honorific }));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Prophet profiles</h1>
      <p className="zq-meta">
        Every prophet uses the same structure: four facts and three reading depths. Each section rests on a referenced claim and is published only after
        scholarly review. Write facts the sources do not establish as &ldquo;not established&rdquo;; never substitute an estimate.
      </p>
      <ProfileEditor stops={stops} />
    </div>
  );
}
