import { SourcesRegister } from "@/components/admin/tools";

export default function SourcesPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Sources and licences</h1>
      <p className="zq-meta">Nothing from a source is shown to readers until its rights are cleared or public domain.</p>
      <SourcesRegister />
    </div>
  );
}
