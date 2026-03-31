import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  importApi,
  SupplementalConnector,
  CreateSupplementalConnectorData,
} from "../../api/import";

// ---------------------------------------------------------------------------
// Styles (matching OpcSources.tsx conventions)
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--io-surface-sunken)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--io-text-secondary)",
  marginBottom: "5px",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px",
  background: "var(--io-accent)",
  color: "#09090b",
  border: "none",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--io-text-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  fontSize: "13px",
  cursor: "pointer",
};

const btnSmall: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-secondary)",
  fontSize: "12px",
  cursor: "pointer",
};

const btnSmallDanger: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-danger)",
  fontSize: "12px",
  cursor: "pointer",
};

// ---------------------------------------------------------------------------
// Connector type options
// ---------------------------------------------------------------------------

const CONNECTOR_TYPES: { label: string; value: string }[] = [
  { label: "PI Web API", value: "pi_web_api" },
  { label: "Honeywell Experion EPDOC", value: "experion_rest" },
  { label: "Siemens Process Historian REST", value: "siemens_sph_rest" },
  { label: "Siemens WinCC OA REST", value: "wincc_oa_rest" },
  { label: "ABB Information Manager REST", value: "s800xa_rest" },
  { label: "Kepware KEPServerEX REST", value: "kepware_rest" },
  { label: "Canary Labs REST", value: "canary_rest" },
  { label: "DeltaV / ABB / Yokogawa (SQL Server)", value: "mssql" },
];

const AUTH_TYPES: { label: string; value: string }[] = [
  { label: "None", value: "none" },
  { label: "Basic (Username / Password)", value: "basic" },
  { label: "API Key Header", value: "api_key_header" },
  { label: "Bearer Token", value: "bearer_token" },
];

function connectorTypeLabel(value: string): string {
  return CONNECTOR_TYPES.find((t) => t.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string | null }) {
  let color = "var(--io-text-muted)";
  if (status === "ok" || status === "connected") color = "var(--io-success)";
  else if (status === "error" || status === "failed")
    color = "var(--io-danger)";
  else if (status === "pending") color = "var(--io-warning)";
  return (
    <span
      title={status ?? "untested"}
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Add connector modal
// ---------------------------------------------------------------------------

interface AddConnectorForm {
  name: string;
  connection_type: string;
  auth_type: string;
  base_url: string;
  username: string;
  password: string;
  api_key: string;
  bearer_token: string;
}

const EMPTY_FORM: AddConnectorForm = {
  name: "",
  connection_type: "pi_web_api",
  auth_type: "none",
  base_url: "",
  username: "",
  password: "",
  api_key: "",
  bearer_token: "",
};

const REST_TYPES = new Set([
  "pi_web_api",
  "experion_rest",
  "siemens_sph_rest",
  "wincc_oa_rest",
  "s800xa_rest",
  "kepware_rest",
  "canary_rest",
]);

function isRestType(ct: string) {
  return REST_TYPES.has(ct);
}

function AddConnectorDialog({
  open,
  onOpenChange,
  pointSourceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pointSourceId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AddConnectorForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: CreateSupplementalConnectorData) =>
      importApi.createSupplementalConnector(data),
    onSuccess: (result) => {
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      qc.invalidateQueries({
        queryKey: ["supplemental-connectors", pointSourceId],
      });
      onOpenChange(false);
      setForm(EMPTY_FORM);
      setError(null);
    },
  });

  function buildAuthConfig(): Record<string, unknown> {
    if (form.auth_type === "basic") {
      return { username: form.username, password: form.password };
    }
    if (form.auth_type === "api_key_header") {
      return { api_key: form.api_key };
    }
    if (form.auth_type === "bearer_token") {
      return { token: form.bearer_token };
    }
    return {};
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const data: CreateSupplementalConnectorData = {
      name: form.name,
      connection_type: form.connection_type,
      point_source_id: pointSourceId,
      is_supplemental_connector: true,
      auth_type: form.auth_type,
      config: isRestType(form.connection_type)
        ? { base_url: form.base_url }
        : {},
      auth_config: buildAuthConfig(),
    };
    mutation.mutate(data);
  }

  const patch = (p: Partial<AddConnectorForm>) =>
    setForm((f) => ({ ...f, ...p }));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px",
            padding: "24px",
            width: "520px",
            maxWidth: "95vw",
            maxHeight: "90vh",
            overflowY: "auto",
            zIndex: 201,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
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
              Add Supplemental Point Data Connector
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
              >
                &#x2715;
              </button>
            </Dialog.Close>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "var(--io-radius)",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "var(--io-danger)",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              {/* Name */}
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="e.g. PI-Unit3-Supplemental"
                  required
                  autoComplete="off"
                />
              </div>

              {/* Connector type */}
              <div>
                <label style={labelStyle}>Connector Type *</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={form.connection_type}
                  onChange={(e) => patch({ connection_type: e.target.value })}
                >
                  {CONNECTOR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base URL (REST types only) */}
              {isRestType(form.connection_type) && (
                <div>
                  <label style={labelStyle}>Base URL *</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={form.base_url}
                    onChange={(e) => patch({ base_url: e.target.value })}
                    placeholder="https://pi-server.example.com/piwebapi"
                    required
                    autoComplete="off"
                  />
                </div>
              )}

              {/* Auth type */}
              <div>
                <label style={labelStyle}>Auth Type</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={form.auth_type}
                  onChange={(e) => patch({ auth_type: e.target.value })}
                >
                  {AUTH_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Basic auth fields */}
              {form.auth_type === "basic" && (
                <>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input
                      type="text"
                      style={inputStyle}
                      value={form.username}
                      onChange={(e) => patch({ username: e.target.value })}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Password</label>
                    <input
                      type="password"
                      style={inputStyle}
                      value={form.password}
                      onChange={(e) => patch({ password: e.target.value })}
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}

              {/* API key field */}
              {form.auth_type === "api_key_header" && (
                <div>
                  <label style={labelStyle}>API Key</label>
                  <input
                    type="password"
                    style={inputStyle}
                    value={form.api_key}
                    onChange={(e) => patch({ api_key: e.target.value })}
                    autoComplete="off"
                  />
                </div>
              )}

              {/* Bearer token field */}
              {form.auth_type === "bearer_token" && (
                <div>
                  <label style={labelStyle}>Bearer Token</label>
                  <input
                    type="password"
                    style={inputStyle}
                    value={form.bearer_token}
                    onChange={(e) => patch({ bearer_token: e.target.value })}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "24px",
              }}
            >
              <Dialog.Close asChild>
                <button type="button" style={btnSecondary}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                style={btnPrimary}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Saving…" : "Save Connector"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Connector card
// ---------------------------------------------------------------------------

function ConnectorCard({
  connector,
  pointSourceId,
}: {
  connector: SupplementalConnector;
  pointSourceId: string;
}) {
  const qc = useQueryClient();
  const [testError, setTestError] = useState<string | null>(null);

  const testMutation = useMutation({
    mutationFn: () => importApi.testSupplementalConnector(connector.id),
    onSuccess: (result) => {
      if (!result.success) {
        setTestError(result.error.message ?? "Test failed");
      } else {
        setTestError(null);
        qc.invalidateQueries({
          queryKey: ["supplemental-connectors", pointSourceId],
        });
      }
    },
    onError: (err) => {
      setTestError(err instanceof Error ? err.message : "Test failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => importApi.deleteSupplementalConnector(connector.id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["supplemental-connectors", pointSourceId],
      });
    },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "12px 14px",
        background: "var(--io-surface-secondary)",
        border: "1px solid var(--io-border)",
        borderRadius: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Status dot */}
        <StatusDot status={connector.last_test_status} />

        {/* Type badge */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            background: "var(--io-surface-sunken)",
            color: "var(--io-text-secondary)",
            border: "1px solid var(--io-border)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {connectorTypeLabel(connector.connection_type)}
        </span>

        {/* Name + last info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              fontSize: "13px",
              color: "var(--io-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {connector.name}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--io-text-muted)",
              marginTop: "2px",
            }}
          >
            {connector.last_test_message
              ? connector.last_test_message
              : connector.last_tested_at
                ? `Last tested ${new Date(connector.last_tested_at).toLocaleString()}`
                : "Not yet tested"}
            {!connector.enabled && (
              <span
                style={{ marginLeft: "6px", color: "var(--io-text-muted)" }}
              >
                (disabled)
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button
            style={btnSmall}
            onClick={() => {
              setTestError(null);
              testMutation.mutate();
            }}
            disabled={testMutation.isPending}
            title="Test connection"
          >
            {testMutation.isPending ? "Testing…" : "Test"}
          </button>
          <button
            style={btnSmallDanger}
            onClick={() => {
              if (
                confirm(`Delete supplemental connector "${connector.name}"?`)
              ) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            title="Delete connector"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Test error */}
      {testError && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--io-danger)",
            paddingLeft: "20px",
          }}
        >
          {testError}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tab component
// ---------------------------------------------------------------------------

interface Props {
  pointSourceId: string;
  pointSourceName: string;
}

export default function SupplementalConnectorsTab({
  pointSourceId,
  pointSourceName,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);

  const connectorsQuery = useQuery({
    queryKey: ["supplemental-connectors", pointSourceId],
    queryFn: async () => {
      const result = await importApi.listSupplementalConnectors(pointSourceId);
      if (!result.success) throw new Error(result.error.message);
      return result.data as SupplementalConnector[];
    },
  });

  const connectors = connectorsQuery.data ?? [];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "16px",
          gap: "12px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            Supplemental point data connectors fill historical or metadata gaps
            from{" "}
            <strong style={{ color: "var(--io-text-primary)" }}>
              {pointSourceName}
            </strong>{" "}
            using additional data sources. These are not general-purpose import
            connectors.
          </p>
        </div>
        <button
          style={{ ...btnPrimary, whiteSpace: "nowrap" }}
          onClick={() => setAddOpen(true)}
        >
          + Add Connector
        </button>
      </div>

      {/* Loading */}
      {connectorsQuery.isLoading && (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: "13px",
          }}
        >
          Loading…
        </div>
      )}

      {/* Error */}
      {connectorsQuery.isError && (
        <div
          style={{
            padding: "12px",
            borderRadius: "var(--io-radius)",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "var(--io-danger)",
            fontSize: "13px",
          }}
        >
          Failed to load supplemental connectors.
        </div>
      )}

      {/* Empty state */}
      {!connectorsQuery.isLoading &&
        !connectorsQuery.isError &&
        connectors.length === 0 && (
          <div
            style={{
              padding: "36px 24px",
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: "13px",
              background: "var(--io-surface-secondary)",
              border: "1px solid var(--io-border)",
              borderRadius: "8px",
            }}
          >
            <p
              style={{
                margin: "0 0 4px",
                color: "var(--io-text-secondary)",
                fontWeight: 500,
              }}
            >
              No supplemental connectors configured
            </p>
            <p style={{ margin: 0 }}>
              Add a connector to pull additional point data that is not
              available directly from the OPC UA source.
            </p>
          </div>
        )}

      {/* Connector list */}
      {connectors.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {connectors.map((c) => (
            <ConnectorCard
              key={c.id}
              connector={c}
              pointSourceId={pointSourceId}
            />
          ))}
        </div>
      )}

      <AddConnectorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        pointSourceId={pointSourceId}
      />
    </div>
  );
}
