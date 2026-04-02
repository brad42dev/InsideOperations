/**
 * WorkspaceView — renders a Console workspace.
 *
 * Used in two contexts:
 *   - Normal:   /console/:workspace_id  (within AppShell — no title bar here)
 *   - Detached: /detached/console/:workspaceId  (standalone window — thin title bar, no AppShell chrome)
 *
 * Spec: console-implementation-spec.md §12 Detached Window Support
 */
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { consoleApi } from "../../api/console";
import WorkspaceGrid from "./WorkspaceGrid";
import type { WorkspaceLayout } from "./types";

// ---------------------------------------------------------------------------
// Live clock
// ---------------------------------------------------------------------------

function useClock(): string {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(
      () => setTime(new Date().toLocaleTimeString()),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  return time;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** When true, rendered in a detached window — thin title bar, no AppShell chrome. */
  detached?: boolean;
}

// ---------------------------------------------------------------------------
// WorkspaceNotFound — shown when the workspace ID is unknown
// ---------------------------------------------------------------------------

function WorkspaceNotFound({
  workspaceId,
}: {
  workspaceId: string | undefined;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
        color: "var(--io-text-muted)",
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={0.4}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: "var(--io-text-primary)",
        }}
      >
        Workspace not found
      </p>
      {workspaceId && (
        <p style={{ margin: 0, fontSize: 12 }}>ID: {workspaceId}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceView
// ---------------------------------------------------------------------------

export default function WorkspaceView({ detached = false }: Props) {
  // Both route params use different names — handle both
  const { workspaceId: workspaceIdDetached, workspace_id: workspaceIdMain } =
    useParams<{
      workspaceId?: string;
      workspace_id?: string;
    }>();
  const workspaceId = workspaceIdDetached ?? workspaceIdMain;

  const clock = useClock();

  // ---- Fetch workspace ------------------------------------------------------

  const {
    data: workspace,
    isLoading,
    isError,
  } = useQuery<WorkspaceLayout | null>({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const result = await consoleApi.getWorkspace(workspaceId);
      if (result.success) return result.data ?? null;
      return null;
    },
    enabled: !!workspaceId,
    retry: 1,
  });

  // ---- Connection status (derive from WebSocket store if available) ---------
  // Use a simple heuristic: if not loaded yet show connecting, else connected
  const connectedDot = {
    color: isLoading ? "#EAB308" : isError ? "#EF4444" : "#22C55E",
    label: isLoading ? "Connecting" : isError ? "Disconnected" : "Connected",
  };

  // ---- Fullscreen ----------------------------------------------------------

  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
    setIsFullscreen((v) => !v);
  }, [isFullscreen]);

  // ---- Not-found / error state ---------------------------------------------

  const notFound = !isLoading && (isError || !workspace);

  // ---- Render — detached mode ----------------------------------------------

  if (detached) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          background: "var(--io-bg)",
          overflow: "hidden",
        }}
      >
        {/* Thin title bar — spec §12.2 */}
        <div
          style={{
            height: 32,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            background: "var(--io-surface)",
            borderBottom: "1px solid var(--io-border)",
            userSelect: "none",
          }}
        >
          {/* Connection status dot */}
          <span
            title={connectedDot.label}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connectedDot.color,
              flexShrink: 0,
            }}
          />

          {/* Workspace name */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--io-text-primary)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {isLoading ? "Loading…" : (workspace?.name ?? workspaceId ?? "")}
          </span>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            style={{
              background: "transparent",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 11,
              color: "var(--io-text-muted)",
              flexShrink: 0,
            }}
          >
            {isFullscreen ? "⤡" : "⤢"}
          </button>

          {/* Live clock */}
          <span
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              flexShrink: 0,
              fontFamily: "monospace",
            }}
          >
            {clock}
          </span>
        </div>

        {/* Workspace content */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {isLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--io-text-muted)",
                fontSize: 13,
              }}
            >
              <div
                className="io-skeleton"
                style={{ width: "80%", height: "80%", borderRadius: 8 }}
              />
            </div>
          )}

          {notFound && !isLoading && (
            <WorkspaceNotFound workspaceId={workspaceId} />
          )}

          {!isLoading && workspace && (
            <WorkspaceGrid
              workspace={workspace}
              locked={true}
              onConfigurePane={() => undefined}
              onRemovePane={() => undefined}
            />
          )}
        </div>
      </div>
    );
  }

  // ---- Render — normal (in-AppShell) mode ----------------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {isLoading && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
          }}
        >
          <div
            className="io-skeleton"
            style={{ width: "80%", height: "80%", borderRadius: 8 }}
          />
        </div>
      )}

      {notFound && !isLoading && (
        <WorkspaceNotFound workspaceId={workspaceId} />
      )}

      {!isLoading && workspace && (
        <WorkspaceGrid
          workspace={workspace}
          locked={true}
          onConfigurePane={() => undefined}
          onRemovePane={() => undefined}
        />
      )}
    </div>
  );
}
