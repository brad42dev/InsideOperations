import { useParams } from "react-router-dom";

export default function WorkspaceEditor() {
  const { workspace_id } = useParams<{ workspace_id: string }>();
  return (
    <div style={{ padding: "var(--io-space-6)" }}>
      <h2 style={{ color: "var(--io-text-primary)" }}>Edit Workspace</h2>
      <p style={{ color: "var(--io-text-secondary)" }}>
        Workspace ID: {workspace_id} — workspace configuration (Phase 7)
      </p>
    </div>
  );
}
