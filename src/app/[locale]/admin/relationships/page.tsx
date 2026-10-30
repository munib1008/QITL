import { RelationshipEditor } from "@/components/admin/tools";

export default function RelationshipsAdmin() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Genealogy edges</h1>
      <RelationshipEditor />
    </div>
  );
}
