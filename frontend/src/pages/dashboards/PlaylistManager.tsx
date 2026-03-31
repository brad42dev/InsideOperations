import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  dashboardsApi,
  type Playlist,
  type PlaylistItem,
  type Dashboard,
} from "../../api/dashboards";

// ---------------------------------------------------------------------------
// Sortable playlist item row
// ---------------------------------------------------------------------------

function SortablePlaylistRow({
  item,
  dashboards,
  onUpdate,
  onRemove,
}: {
  item: Omit<PlaylistItem, "id"> & { id: string };
  dashboards: Dashboard[];
  onUpdate: (updates: Partial<PlaylistItem>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 10px",
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        ...style,
      }}
    >
      <span
        {...attributes}
        {...listeners}
        style={{
          color: "var(--io-text-muted)",
          cursor: "grab",
          fontSize: "14px",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        ⠿
      </span>

      <select
        value={item.dashboard_id}
        onChange={(e) => onUpdate({ dashboard_id: e.target.value })}
        style={{
          flex: 1,
          padding: "5px 8px",
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          color: "var(--io-text-primary)",
          fontSize: "12px",
          outline: "none",
        }}
      >
        <option value="">Select dashboard...</option>
        {dashboards.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flexShrink: 0,
        }}
      >
        <input
          type="number"
          min={5}
          max={3600}
          value={item.dwell_seconds}
          onChange={(e) =>
            onUpdate({ dwell_seconds: parseInt(e.target.value) || 30 })
          }
          style={{
            width: "56px",
            padding: "5px 6px",
            background: "var(--io-surface-secondary)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-primary)",
            fontSize: "12px",
            outline: "none",
            textAlign: "right",
          }}
        />
        <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
          s
        </span>
      </label>

      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color: "var(--io-text-muted)",
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
          flexShrink: 0,
          padding: "2px 4px",
        }}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New playlist form
// ---------------------------------------------------------------------------

interface NewPlaylistItem {
  id: string;
  dashboard_id: string;
  position: number;
  dwell_seconds: number;
  variable_overrides: Record<string, unknown>;
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function NewPlaylistForm({
  dashboards,
  onSave,
  onCancel,
}: {
  dashboards: Dashboard[];
  onSave: (name: string, items: Omit<PlaylistItem, "id">[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<NewPlaylistItem[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        dashboard_id: dashboards[0]?.id ?? "",
        position: prev.length,
        dwell_seconds: 30,
        variable_overrides: {},
      },
    ]);
  }

  function updateItem(id: string, updates: Partial<NewPlaylistItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, oldIndex, newIndex).map((item, idx) => ({
          ...item,
          position: idx,
        }));
      });
    }
  }

  function handleSave() {
    if (!name.trim()) return;
    const playlistItems: Omit<PlaylistItem, "id">[] = items.map(
      (item, idx) => ({
        dashboard_id: item.dashboard_id,
        position: idx,
        dwell_seconds: item.dwell_seconds,
        variable_overrides: item.variable_overrides,
      }),
    );
    onSave(name, playlistItems);
  }

  return (
    <div
      style={{
        background: "var(--io-surface-secondary)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <input
        type="text"
        placeholder="Playlist name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        style={{
          padding: "7px 10px",
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          color: "var(--io-text-primary)",
          fontSize: "13px",
          outline: "none",
        }}
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {items.map((item) => (
              <SortablePlaylistRow
                key={item.id}
                item={item}
                dashboards={dashboards}
                onUpdate={(updates) =>
                  updateItem(item.id, updates as Partial<NewPlaylistItem>)
                }
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={addItem}
        style={{
          padding: "7px",
          background: "none",
          border: "1px dashed var(--io-border)",
          borderRadius: "var(--io-radius)",
          color: "var(--io-text-muted)",
          cursor: "pointer",
          fontSize: "12px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--io-accent)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--io-accent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--io-border)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--io-text-muted)";
        }}
      >
        + Add Dashboard
      </button>

      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 14px",
            background: "none",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-secondary)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || items.length === 0}
          style={{
            padding: "6px 14px",
            background: "var(--io-accent)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: "var(--io-btn-text)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            opacity: !name.trim() || items.length === 0 ? 0.5 : 1,
          }}
        >
          Create Playlist
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaylistManager modal
// ---------------------------------------------------------------------------

interface Props {
  onClose: () => void;
}

export default function PlaylistManager({ onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);

  const playlistsQuery = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const result = await dashboardsApi.listPlaylists();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const dashboardsQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const result = await dashboardsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({
      name,
      items,
    }: {
      name: string;
      items: Omit<PlaylistItem, "id">[];
    }) => {
      const result = await dashboardsApi.createPlaylist({ name, items });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["playlists"] });
      setShowNewForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await dashboardsApi.deletePlaylist(id);
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });

  const playlists: Playlist[] = playlistsQuery.data ?? [];
  const dashboards: Dashboard[] = dashboardsQuery.data ?? [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--io-modal-backdrop)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          width: "560px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--io-shadow-lg)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Playlists
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--io-text-muted)",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {playlistsQuery.isLoading && (
            <div
              style={{
                color: "var(--io-text-muted)",
                fontSize: "13px",
                textAlign: "center",
                padding: "20px",
              }}
            >
              Loading playlists...
            </div>
          )}

          {!playlistsQuery.isLoading &&
            playlists.map((playlist) => (
              <div
                key={playlist.id}
                style={{
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--io-text-primary)",
                      marginBottom: "2px",
                    }}
                  >
                    {playlist.name}
                  </div>
                  <div
                    style={{ fontSize: "12px", color: "var(--io-text-muted)" }}
                  >
                    {playlist.items.length} dashboard
                    {playlist.items.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      onClose();
                      navigate(
                        `/dashboards/playlist/${playlist.id}?kiosk=true`,
                      );
                    }}
                    style={{
                      padding: "5px 10px",
                      background: "var(--io-accent)",
                      border: "none",
                      borderRadius: "var(--io-radius)",
                      color: "var(--io-btn-text)",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    ▶ Play
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(`Delete playlist "${playlist.name}"?`)
                      ) {
                        deleteMutation.mutate(playlist.id);
                      }
                    }}
                    style={{
                      padding: "5px 8px",
                      background: "none",
                      border: "1px solid var(--io-border)",
                      borderRadius: "var(--io-radius)",
                      color: "var(--io-danger)",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

          {!playlistsQuery.isLoading &&
            playlists.length === 0 &&
            !showNewForm && (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px",
                  color: "var(--io-text-muted)",
                  fontSize: "13px",
                }}
              >
                No playlists yet. Create one to auto-advance dashboards in kiosk
                mode.
              </div>
            )}

          {showNewForm ? (
            <NewPlaylistForm
              dashboards={dashboards}
              onSave={(name, items) => createMutation.mutate({ name, items })}
              onCancel={() => setShowNewForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowNewForm(true)}
              style={{
                padding: "9px",
                background: "none",
                border: "1px dashed var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: "13px",
                transition: "border-color 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--io-accent)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--io-accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--io-border)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--io-text-muted)";
              }}
            >
              + New Playlist
            </button>
          )}
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--io-border)",
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px",
              background: "none",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
