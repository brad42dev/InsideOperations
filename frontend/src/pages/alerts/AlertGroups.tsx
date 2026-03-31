import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  notificationsApi,
  type GroupType,
  type CreateGroupPayload,
} from "../../api/notifications";

const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  static: "Static",
  role_based: "Role-Based",
  on_shift: "On Shift",
  on_site: "On Site",
  all_users: "All Users",
};

const GROUP_TYPE_COLOR: Record<GroupType, string> = {
  static: "var(--io-accent)",
  role_based: "#a855f7",
  on_shift: "#22c55e",
  on_site: "#f97316",
  all_users: "#fbbf24",
};

const GROUP_TYPES: GroupType[] = [
  "static",
  "role_based",
  "on_shift",
  "on_site",
  "all_users",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--io-border)",
  background: "var(--io-bg)",
  color: "var(--io-text-primary)",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "var(--io-text-secondary)",
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
};

export default function AlertGroups() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("static");
  const [formError, setFormError] = useState("");

  const {
    data: groupsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["notifications", "groups"],
    queryFn: async () => {
      const result = await notificationsApi.listGroups();
      if (!result.success) throw new Error(result.error.message);
      // list_groups returns a PagedResponse envelope — unwrap the inner array
      const d = result.data as unknown;
      if (Array.isArray(d))
        return d as import("../../api/notifications").NotificationGroup[];
      const paged = d as { data?: unknown };
      return (
        Array.isArray(paged?.data) ? paged.data : []
      ) as import("../../api/notifications").NotificationGroup[];
    },
  });
  const groups = groupsData ?? [];

  const createMutation = useMutation({
    mutationFn: async (payload: CreateGroupPayload) => {
      const result = await notificationsApi.createGroup(payload);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "groups"] });
      setShowCreate(false);
      setName("");
      setDescription("");
      setGroupType("static");
      setFormError("");
    },
    onError: (err) => {
      setFormError(
        err instanceof Error ? err.message : "Failed to create group",
      );
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    setFormError("");
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      group_type: groupType,
    });
  }

  return (
    <div style={{ padding: "var(--io-space-6)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              color: "var(--io-text-primary)",
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            Alert Groups
          </h2>
          <p
            style={{
              color: "var(--io-text-secondary)",
              margin: "4px 0 0",
              fontSize: 14,
            }}
          >
            Recipient groups for emergency alerts
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "var(--io-accent)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {showCreate ? "Cancel" : "+ New Group"}
        </button>
      </div>

      {showCreate && (
        <div
          style={{
            border: "1px solid var(--io-border)",
            borderRadius: 8,
            background: "var(--io-surface)",
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              color: "var(--io-text-primary)",
              fontWeight: 600,
              fontSize: 15,
              marginBottom: 16,
            }}
          >
            Create Group
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Group name"
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Group Type</label>
                <select
                  value={groupType}
                  onChange={(e) => setGroupType(e.target.value as GroupType)}
                  style={inputStyle}
                >
                  {GROUP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {GROUP_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              {formError && (
                <div style={{ color: "#ef4444", fontSize: 13 }}>
                  {formError}
                </div>
              )}
              <div>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--io-accent)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: createMutation.isPending
                      ? "not-allowed"
                      : "pointer",
                    opacity: createMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {createMutation.isPending ? "Creating…" : "Create Group"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div
        style={{
          border: "1px solid var(--io-border)",
          borderRadius: 8,
          background: "var(--io-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr 140px 80px",
            gap: 12,
            padding: "8px 16px",
            borderBottom: "1px solid var(--io-border)",
            background: "var(--io-surface-secondary)",
          }}
        >
          {["Name", "Description", "Type", "Members"].map((h) => (
            <div
              key={h}
              style={{
                color: "var(--io-text-muted)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {isLoading && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--io-text-muted)",
            }}
          >
            Loading…
          </div>
        )}
        {isError && (
          <div style={{ padding: 32, textAlign: "center", color: "#ef4444" }}>
            Failed to load groups.
          </div>
        )}
        {groups && groups.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--io-text-muted)",
            }}
          >
            No groups found. Create one to get started.
          </div>
        )}
        {groups?.map((group) => (
          <div
            key={group.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr 140px 80px",
              gap: 12,
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid var(--io-border)",
            }}
          >
            <div
              style={{
                color: "var(--io-text-primary)",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              {group.name}
            </div>
            <div style={{ color: "var(--io-text-secondary)", fontSize: 13 }}>
              {group.description ?? "—"}
            </div>
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  color: GROUP_TYPE_COLOR[group.group_type],
                  background: `${GROUP_TYPE_COLOR[group.group_type]}22`,
                }}
              >
                {GROUP_TYPE_LABEL[group.group_type]}
              </span>
            </div>
            <div style={{ color: "var(--io-text-secondary)", fontSize: 13 }}>
              {group.member_count ?? "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
