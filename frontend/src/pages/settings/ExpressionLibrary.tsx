import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { btnSecondary, btnDanger } from "./settingsStyles";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  expressionsApi,
  type SavedExpression,
  type CreateExpressionBody,
} from "../../api/expressions";
import type {
  ExpressionAst,
  ExpressionContext,
} from "../../shared/types/expression";
import { ExpressionBuilder } from "../../shared/components/expression/ExpressionBuilder";
import { useAuthStore } from "../../store/auth";
import DataTable from "../../shared/components/DataTable";
import type { ColumnDef } from "../../shared/components/DataTable";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

// ---------------------------------------------------------------------------
// Context display names
// ---------------------------------------------------------------------------

const CONTEXT_LABELS: Record<ExpressionContext, string> = {
  point_config: "Point Config",
  alarm_definition: "Alarm",
  rounds_checkpoint: "Rounds Checkpoint",
  log_segment: "Log Segment",
  widget: "Widget",
  forensics: "Forensics",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Edit dialog (wraps ExpressionBuilder without Radix Dialog — uses Portal)
// ---------------------------------------------------------------------------

function EditExpressionDialog({
  expression,
  open,
  onOpenChange,
  onSave,
}: {
  expression: SavedExpression | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (id: string, ast: ExpressionAst) => void;
}) {
  if (!expression) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.5))",
            zIndex: 200,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px",
            padding: "24px",
            width: "min(900px, 96vw)",
            maxHeight: "92vh",
            overflowY: "auto",
            zIndex: 201,
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
          aria-describedby={undefined}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              Edit Expression — {expression.name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          <ExpressionBuilder
            context={expression.context}
            contextLabel={
              CONTEXT_LABELS[expression.context] ?? expression.context
            }
            initialExpression={expression.ast}
            onApply={(ast) => {
              onSave(expression.id, ast);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Confirm delete dialog
// ---------------------------------------------------------------------------

function ConfirmDeleteDialog({
  expression,
  open,
  onOpenChange,
  onConfirm,
}: {
  expression: SavedExpression | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  if (!expression) return null;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.5))",
            zIndex: 200,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px",
            padding: "24px",
            width: "420px",
            maxWidth: "95vw",
            zIndex: 201,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
          aria-describedby={undefined}
        >
          <Dialog.Title
            style={{
              margin: "0 0 12px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Delete Expression
          </Dialog.Title>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "14px",
              color: "var(--io-text-secondary)",
            }}
          >
            Are you sure you want to delete <strong>"{expression.name}"</strong>
            ? This cannot be undone.
          </p>
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          >
            <Dialog.Close asChild>
              <button style={btnSecondary}>Cancel</button>
            </Dialog.Close>
            <button
              style={btnDanger}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Create expression dialog
// ---------------------------------------------------------------------------

function CreateExpressionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [context, setContext] = useState<ExpressionContext>("point_config");

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.5))",
            zIndex: 200,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px",
            padding: "24px",
            width: "min(960px, 96vw)",
            maxHeight: "92vh",
            overflowY: "auto",
            zIndex: 201,
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
          aria-describedby={undefined}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              New Expression
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label
              style={{
                fontSize: "13px",
                color: "var(--io-text-secondary)",
                fontWeight: 500,
              }}
            >
              Context:
            </label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value as ExpressionContext)}
              style={{
                padding: "6px 10px",
                background: "var(--io-surface-sunken)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-primary)",
                fontSize: "13px",
              }}
            >
              {Object.entries(CONTEXT_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <ExpressionBuilder
            context={context}
            contextLabel={CONTEXT_LABELS[context] ?? context}
            onApply={() => {
              onCreated();
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "var(--io-danger-subtle)",
        border: "1px solid var(--io-danger)",
        borderRadius: "var(--io-radius)",
        padding: "10px 14px",
        color: "var(--io-danger)",
        fontSize: "13px",
        marginBottom: "16px",
      }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpressionLibrary page
// ---------------------------------------------------------------------------

export default function ExpressionLibrary() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage =
    user?.permissions.includes("system:expression_manage") ?? false;
  const isAdmin = user?.permissions.includes("system:expression_manage") ?? false;

  const [createOpen, setCreateOpen] = useState(false);
  const [editExpr, setEditExpr] = useState<SavedExpression | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteExpr, setDeleteExpr] = useState<SavedExpression | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [contextFilter, setContextFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<SavedExpression>();

  const query = useQuery({
    queryKey: ["expressions", contextFilter],
    queryFn: async () => {
      if (contextFilter) {
        const result = await expressionsApi.listByContext(contextFilter);
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      }
      const result = await expressionsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data as SavedExpression[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ast }: { id: string; ast: ExpressionAst }) =>
      expressionsApi.update(id, { ast }),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["expressions"] });
    },
    onError: (err) => {
      setBannerError(err instanceof Error ? err.message : "Update failed");
    },
  });

  const shareMutation = useMutation({
    mutationFn: ({ id, is_shared }: { id: string; is_shared: boolean }) =>
      expressionsApi.update(id, { is_shared }),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["expressions"] });
    },
    onError: (err) => {
      setBannerError(err instanceof Error ? err.message : "Share toggle failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expressionsApi.delete(id),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["expressions"] });
    },
    onError: (err) => {
      setBannerError(err instanceof Error ? err.message : "Delete failed");
    },
  });

  const expressions = query.data ?? [];

  function handleExport() {
    const toExport = expressions.filter((e) => selectedIds.has(e.id));
    if (toExport.length === 0) return;
    const blob = new Blob([JSON.stringify(toExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expressions.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    setImportProgress("Importing…");
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setBannerError("Import file must be a JSON array of expressions.");
        setImportProgress(null);
        return;
      }
      let ok = 0;
      let fail = 0;
      for (const item of parsed as Record<string, unknown>[]) {
        const body: CreateExpressionBody = {
          name: String(item.name ?? "Imported Expression"),
          context: (item.context as ExpressionContext) ?? "point_config",
          ast: item.ast as ExpressionAst,
          description:
            item.description != null ? String(item.description) : undefined,
          is_shared: Boolean(item.is_shared),
        };
        const result = await expressionsApi.create(body);
        if (result.success) {
          ok++;
        } else {
          fail++;
        }
      }
      setImportProgress(
        `Import complete: ${ok} imported, ${fail} failed.`,
      );
      queryClient.invalidateQueries({ queryKey: ["expressions"] });
    } catch {
      setBannerError("Failed to parse import file.");
      setImportProgress(null);
    }
  }

  const columns: ColumnDef<SavedExpression>[] = [
    {
      id: "select",
      header: "",
      cell: (_val, row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={(e) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (e.target.checked) {
                next.add(row.id);
              } else {
                next.delete(row.id);
              }
              return next;
            });
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.name}`}
        />
      ),
      width: 36,
    },
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sortable: true,
      minWidth: 160,
    },
    {
      id: "description",
      header: "Description",
      cell: (_val, row) => (
        <span style={{ color: "var(--io-text-muted)", fontSize: "12px" }}>
          {row.description ?? "—"}
        </span>
      ),
      minWidth: 180,
    },
    {
      id: "context",
      header: "Context",
      cell: (_val, row) => (
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "100px",
            fontSize: "11px",
            fontWeight: 600,
            background: "var(--io-accent-subtle)",
            color: "var(--io-accent)",
          }}
        >
          {CONTEXT_LABELS[row.context] ?? row.context}
        </span>
      ),
      width: 140,
    },
    {
      id: "is_shared",
      header: "Shared",
      cell: (_val, row) => (
        <span
          style={{
            fontSize: "12px",
            color: row.is_shared ? "var(--io-success)" : "var(--io-text-muted)",
          }}
        >
          {row.is_shared ? "Yes" : "No"}
        </span>
      ),
      width: 70,
    },
    {
      id: "created_by",
      header: "Created By",
      accessorKey: "created_by",
      width: 120,
    },
    {
      id: "updated_at",
      header: "Updated",
      cell: (_val, row) => (
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          {formatDate(row.updated_at)}
        </span>
      ),
      width: 110,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (_val, row) => {
        const isOwner = row.created_by === user?.username;
        const canToggleShare = isOwner || isAdmin;
        return (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {canManage && canToggleShare && (
              <button
                title={
                  row.is_shared
                    ? "Unshare (visible to all users)"
                    : "Share (make visible to all users)"
                }
                style={{
                  padding: "4px 8px",
                  background: row.is_shared
                    ? "var(--io-accent-subtle)"
                    : "transparent",
                  border: `1px solid ${row.is_shared ? "var(--io-accent)" : "var(--io-border)"}`,
                  borderRadius: "var(--io-radius)",
                  color: row.is_shared
                    ? "var(--io-accent)"
                    : "var(--io-text-muted)",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  shareMutation.mutate({
                    id: row.id,
                    is_shared: !row.is_shared,
                  });
                }}
              >
                {row.is_shared ? "Shared" : "Share"}
              </button>
            )}
            {canManage && (
              <>
                <button
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    color: "var(--io-text-secondary)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditExpr(row);
                    setEditOpen(true);
                  }}
                >
                  Edit
                </button>
                <button
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    border: "1px solid var(--io-danger)",
                    borderRadius: "var(--io-radius)",
                    color: "var(--io-danger)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteExpr(row);
                    setDeleteOpen(true);
                  }}
                >
                  Delete
                </button>
              </>
            )}
            {!canManage && (
              <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
                View only
              </span>
            )}
          </div>
        );
      },
      width: 220,
    },
  ];

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Expression Library
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Saved expressions for reuse across points, alarms, reports, and
            widgets
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          {canManage && selectedIds.size > 0 && (
            <button
              onClick={handleExport}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Export ({selectedIds.size})
            </button>
          )}
          {canManage && (
            <>
              <button
                onClick={() => importFileRef.current?.click()}
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-secondary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Import
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => setCreateOpen(true)}
                style={{
                  padding: "8px 16px",
                  background: "var(--io-accent)",
                  border: "none",
                  borderRadius: "var(--io-radius)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Add Expression
              </button>
            </>
          )}
        </div>
      </div>

      {bannerError && <ErrorBanner message={bannerError} />}

      {importProgress && (
        <div
          style={{
            background: "var(--io-accent-subtle)",
            border: "1px solid var(--io-accent)",
            borderRadius: "var(--io-radius)",
            padding: "10px 14px",
            color: "var(--io-accent)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {importProgress}
        </div>
      )}

      {query.isError && (
        <ErrorBanner
          message={
            query.error instanceof Error
              ? query.error.message
              : "Failed to load expressions"
          }
        />
      )}

      {/* Context filter */}
      <div style={{ marginBottom: "12px" }}>
        <select
          value={contextFilter}
          onChange={(e) => setContextFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            background: "var(--io-surface-sunken)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-primary)",
            fontSize: "13px",
          }}
        >
          <option value="">All Contexts</option>
          {Object.entries(CONTEXT_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <DataTable<SavedExpression>
        data={expressions}
        columns={columns}
        height={520}
        rowHeight={40}
        loading={query.isLoading}
        emptyMessage="No saved expressions yet. Expressions are saved from the Expression Builder."
        onRowContextMenu={(e, row) => handleContextMenu(e, row)}
      />

      {/* Create dialog */}
      <CreateExpressionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["expressions"] })
        }
      />

      {/* Edit dialog */}
      <EditExpressionDialog
        expression={editExpr}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(id, ast) => {
          updateMutation.mutate({ id, ast });
        }}
      />

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        expression={deleteExpr}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          if (deleteExpr) deleteMutation.mutate(deleteExpr.id);
        }}
      />
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: "Edit", permission: "system:expression_manage", onClick: () => { setEditExpr(menuState.data!); setEditOpen(true); closeMenu(); } },
            { label: "Duplicate", permission: "system:expression_manage", onClick: () => { closeMenu(); } },
            { label: "Export", onClick: () => { closeMenu(); } },
            { label: "Delete", danger: true, divider: true, permission: "system:expression_manage", onClick: () => { setDeleteExpr(menuState.data!); setDeleteOpen(true); closeMenu(); } },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
