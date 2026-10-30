import { RolesManager } from "@/components/admin/tools";

export default function UsersPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>Users and roles</h1>
      <p className="zq-meta">Verify identity, and for scholarly reviewers their credentials, by hand before granting a role. Every grant and revocation is audited.</p>
      <RolesManager />
    </div>
  );
}
