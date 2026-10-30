import { GuidanceEditor } from "@/components/admin/GuidanceEditor";

export default function GuidanceAdmin() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Life Guidance</h1>
      <GuidanceEditor />
    </div>
  );
}
