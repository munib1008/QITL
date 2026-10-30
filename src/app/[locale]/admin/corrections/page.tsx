import { CorrectionsQueue } from "@/components/admin/tools";

export default function CorrectionsPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Corrections</h1>
      <CorrectionsQueue />
    </div>
  );
}
