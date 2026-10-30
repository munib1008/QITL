import { AuditTrail } from "@/components/admin/tools";

export default function AuditPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Audit trail</h1>
      <AuditTrail />
    </div>
  );
}
