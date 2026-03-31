import { useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  roundsApi,
  type RoundTemplate,
  type Checkpoint,
  type RoundResponse,
} from "../../api/rounds";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PrintMode = "blank" | "current_results";
type PageSize = "letter" | "a4";

interface PrintDialogProps {
  /** If provided, pre-selects this template and skips the template selector */
  preselectedTemplateId?: string;
  trigger: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExpectedRange(cp: Checkpoint): string {
  if (cp.data_type === "numeric" && cp.validation) {
    const v = cp.validation;
    if (v.mode === "alarm") {
      const parts: string[] = [];
      if (v.hh !== undefined) parts.push(`HH:${v.hh}`);
      if (v.h !== undefined) parts.push(`H:${v.h}`);
      if (v.l !== undefined) parts.push(`L:${v.l}`);
      if (v.ll !== undefined) parts.push(`LL:${v.ll}`);
      const rangeStr = parts.length > 0 ? parts.join(" ") : "";
      const unitStr = cp.unit ? ` ${cp.unit}` : "";
      return rangeStr + unitStr;
    } else {
      // limit mode
      const min = v.min !== undefined ? v.min : "—";
      const max = v.max !== undefined ? v.max : "—";
      const unitStr = cp.unit ? ` ${cp.unit}` : "";
      return `${min}–${max}${unitStr}`;
    }
  }
  if (cp.data_type === "dropdown" && cp.options && cp.options.length > 0) {
    return cp.options.join(" / ");
  }
  if (cp.data_type === "boolean") {
    return "Pass / Fail";
  }
  return "";
}

function getResponseValue(
  responses: RoundResponse[],
  checkpointIndex: number,
  fieldName?: string,
): string {
  const resp = responses.find((r) => r.checkpoint_index === checkpointIndex);
  if (!resp) return "";
  if (fieldName) {
    // multi_field: response_value is an object keyed by field name
    const obj = resp.response_value as Record<string, unknown>;
    const val = obj?.[fieldName];
    return val !== undefined && val !== null ? String(val) : "";
  }
  if (resp.response_value === null || resp.response_value === undefined)
    return "";
  return String(resp.response_value);
}

function getPassFail(
  responses: RoundResponse[],
  checkpointIndex: number,
): string {
  const resp = responses.find((r) => r.checkpoint_index === checkpointIndex);
  if (!resp) return "";
  if (resp.is_out_of_range) return "FAIL";
  if (resp.response_value !== null && resp.response_value !== undefined)
    return "Pass";
  return "";
}

// ---------------------------------------------------------------------------
// Print area styles (injected into head on mount)
// ---------------------------------------------------------------------------

const PRINT_STYLES = `
@media print {
  body > * { display: none !important; }
  #rounds-print-area {
    display: block !important;
    background: white !important;
    color: black !important;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    margin: 0;
    padding: 0;
  }
}
@page {
  margin: 15mm;
}
`;

function ensurePrintStyles() {
  if (document.getElementById("rounds-print-styles")) return;
  const style = document.createElement("style");
  style.id = "rounds-print-styles";
  style.textContent = PRINT_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Print area component (hidden on screen, visible when printing)
// ---------------------------------------------------------------------------

interface PrintAreaProps {
  template: RoundTemplate;
  mode: PrintMode;
  pageSize: PageSize;
  responses: RoundResponse[];
  printDate: string;
}

function PrintArea({
  template,
  mode,
  pageSize: _pageSize,
  responses,
}: PrintAreaProps) {
  const printDate = new Date().toLocaleString();

  // Build rows: for multi_field checkpoints expand to one row per sub-field
  interface PrintRow {
    num: string;
    equipmentId: string;
    location: string;
    description: string;
    expectedRange: string;
    reading: string;
    passFail: string;
    notes: string;
    groupStart?: boolean;
    groupEnd?: boolean;
  }

  const rows: PrintRow[] = [];
  let rowNum = 1;

  for (const cp of template.checkpoints) {
    if (cp.data_type === "multi_field" && cp.fields && cp.fields.length > 0) {
      cp.fields.forEach((field, fi) => {
        const reading =
          mode === "current_results"
            ? getResponseValue(responses, cp.index, field.name)
            : "";
        rows.push({
          num: fi === 0 ? String(rowNum) : "",
          equipmentId: fi === 0 ? (cp.opc_point_id ?? "") : "",
          location: "",
          description: `${cp.title} — ${field.name}`,
          expectedRange: fi === 0 ? formatExpectedRange(cp) : "",
          reading,
          passFail:
            fi === 0 && mode === "current_results"
              ? getPassFail(responses, cp.index)
              : "",
          notes: "",
          groupStart: fi === 0,
          groupEnd: fi === cp.fields!.length - 1,
        });
      });
    } else {
      const reading =
        mode === "current_results" ? getResponseValue(responses, cp.index) : "";
      rows.push({
        num: String(rowNum),
        equipmentId: cp.opc_point_id ?? "",
        location: "",
        description: cp.title + (cp.description ? ` — ${cp.description}` : ""),
        expectedRange: formatExpectedRange(cp),
        reading,
        passFail:
          mode === "current_results" ? getPassFail(responses, cp.index) : "",
        notes: "",
      });
    }
    rowNum++;
  }

  const cellStyle: React.CSSProperties = {
    border: "1px solid #888",
    padding: "4px 6px",
    verticalAlign: "top",
    fontSize: "9pt",
    color: "#000",
    background: "#fff",
  };

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    background: "#e8e8e8",
    fontWeight: 700,
    fontSize: "9pt",
  };

  return (
    <div
      id="rounds-print-area"
      style={{
        display: "none",
        background: "white",
        color: "black",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "10pt",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: "12px",
          borderBottom: "2px solid #333",
          paddingBottom: "8px",
        }}
      >
        <div
          style={{
            fontSize: "14pt",
            fontWeight: 700,
            color: "#000",
            marginBottom: "4px",
          }}
        >
          {template.name}
        </div>
        <div style={{ fontSize: "9pt", color: "#333", marginBottom: "2px" }}>
          Printed: {printDate}
          {mode === "current_results" && (
            <span style={{ marginLeft: "16px", fontStyle: "italic" }}>
              Mode: Current Results
            </span>
          )}
          {mode === "blank" && (
            <span style={{ marginLeft: "16px", fontStyle: "italic" }}>
              Mode: Blank Checklist
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "8px",
            fontSize: "10pt",
          }}
        >
          <span>Operator: ___________________________</span>
          <span>Shift: ___________________________</span>
          <span>Date: ___________________________</span>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: "4%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={headerCellStyle}>#</th>
            <th style={headerCellStyle}>Equipment ID</th>
            <th style={headerCellStyle}>Location</th>
            <th style={headerCellStyle}>Description</th>
            <th style={headerCellStyle}>Expected Range</th>
            <th style={headerCellStyle}>Reading</th>
            <th style={headerCellStyle}>Pass/Fail</th>
            <th style={headerCellStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td
                style={{
                  ...cellStyle,
                  borderTop: row.groupStart
                    ? "2px solid #555"
                    : cellStyle.border,
                  borderBottom: row.groupEnd
                    ? "2px solid #555"
                    : cellStyle.border,
                }}
              >
                {row.num}
              </td>
              <td
                style={{
                  ...cellStyle,
                  borderTop: row.groupStart
                    ? "2px solid #555"
                    : cellStyle.border,
                  borderBottom: row.groupEnd
                    ? "2px solid #555"
                    : cellStyle.border,
                  fontSize: "8pt",
                  wordBreak: "break-all",
                }}
              >
                {row.equipmentId}
              </td>
              <td
                style={{
                  ...cellStyle,
                  borderTop: row.groupStart
                    ? "2px solid #555"
                    : cellStyle.border,
                  borderBottom: row.groupEnd
                    ? "2px solid #555"
                    : cellStyle.border,
                }}
              >
                {row.location}
              </td>
              <td
                style={{
                  ...cellStyle,
                  borderTop: row.groupStart
                    ? "2px solid #555"
                    : cellStyle.border,
                  borderBottom: row.groupEnd
                    ? "2px solid #555"
                    : cellStyle.border,
                }}
              >
                {row.description}
              </td>
              <td
                style={{
                  ...cellStyle,
                  borderTop: row.groupStart
                    ? "2px solid #555"
                    : cellStyle.border,
                  borderBottom: row.groupEnd
                    ? "2px solid #555"
                    : cellStyle.border,
                  fontSize: "8pt",
                }}
              >
                {row.expectedRange}
              </td>
              <td
                style={{
                  ...cellStyle,
                  borderTop: row.groupStart
                    ? "2px solid #555"
                    : cellStyle.border,
                  borderBottom: row.groupEnd
                    ? "2px solid #555"
                    : cellStyle.border,
                  background:
                    mode === "current_results" && row.reading
                      ? "#fff"
                      : "#f9f9f9",
                }}
              >
                {row.reading}
              </td>
              <td
                style={{
                  ...cellStyle,
                  borderTop: row.groupStart
                    ? "2px solid #555"
                    : cellStyle.border,
                  borderBottom: row.groupEnd
                    ? "2px solid #555"
                    : cellStyle.border,
                  color: row.passFail === "FAIL" ? "#c00" : "#000",
                  fontWeight: row.passFail === "FAIL" ? 700 : 400,
                }}
              >
                {row.passFail}
              </td>
              <td
                style={{
                  ...cellStyle,
                  borderTop: row.groupStart
                    ? "2px solid #555"
                    : cellStyle.border,
                  borderBottom: row.groupEnd
                    ? "2px solid #555"
                    : cellStyle.border,
                }}
              >
                {row.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div
        style={{
          marginTop: "16px",
          borderTop: "1px solid #888",
          paddingTop: "6px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "8pt",
          color: "#555",
        }}
      >
        <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>
          UNCONTROLLED COPY
        </span>
        <span>Page 1</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner dialog content (uses hooks, so must be a component)
// ---------------------------------------------------------------------------

interface PrintDialogContentProps {
  preselectedTemplateId?: string;
  onClose: () => void;
}

function PrintDialogContent({
  preselectedTemplateId,
  onClose,
}: PrintDialogContentProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    preselectedTemplateId ?? "",
  );
  const [mode, setMode] = useState<PrintMode>("blank");
  const [pageSize, setPageSize] = useState<PageSize>("letter");
  const [isPrinting, setIsPrinting] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Load templates list (for the selector)
  const { data: templatesResult, isLoading: loadingTemplates } = useQuery({
    queryKey: ["rounds", "templates"],
    queryFn: () => roundsApi.listTemplates(),
  });

  const templates =
    templatesResult?.success && Array.isArray(templatesResult.data)
      ? templatesResult.data
      : [];

  // Load the selected template detail
  const { data: templateResult, isLoading: loadingTemplate } = useQuery({
    queryKey: ["rounds", "template", selectedTemplateId],
    queryFn: () => roundsApi.getTemplate(selectedTemplateId),
    enabled: !!selectedTemplateId,
  });

  const template = templateResult?.success ? templateResult.data : null;

  // Load history to find the most recent completed instance for current_results mode
  const { data: historyResult, isLoading: loadingHistory } = useQuery({
    queryKey: ["rounds", "history", selectedTemplateId],
    queryFn: () => roundsApi.getHistory({ template_id: selectedTemplateId }),
    enabled: !!selectedTemplateId && mode === "current_results",
  });

  const historyEntries =
    historyResult?.success && Array.isArray(historyResult.data)
      ? historyResult.data
      : [];
  const latestCompleted = historyEntries
    .filter((e) => e.status === "completed")
    .sort((a, b) => {
      const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return tb - ta;
    })[0];

  // Load the latest completed instance detail (responses)
  const { data: instanceResult, isLoading: loadingInstance } = useQuery({
    queryKey: ["rounds", "instance", latestCompleted?.id],
    queryFn: () => roundsApi.getInstance(latestCompleted!.id),
    enabled: !!latestCompleted?.id && mode === "current_results",
  });

  const responses =
    instanceResult?.success && Array.isArray(instanceResult.data?.responses)
      ? instanceResult.data.responses
      : [];

  const isLoading =
    loadingTemplates ||
    loadingTemplate ||
    (mode === "current_results" && (loadingHistory || loadingInstance));

  function handlePrint() {
    if (!template) return;
    ensurePrintStyles();
    setIsPrinting(true);

    // Give React one tick to flush the print area render before calling window.print
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "var(--io-text-secondary)",
    fontWeight: 500,
    marginBottom: "6px",
    display: "block",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: "6px",
    color: "var(--io-text-primary)",
    fontSize: "13px",
    cursor: "pointer",
  };

  const radioGroupStyle: React.CSSProperties = {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  };

  const radioOptionStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    border: `1px solid ${active ? "var(--io-accent, #4A9EFF)" : "var(--io-border)"}`,
    borderRadius: "6px",
    background: active
      ? "var(--io-accent-subtle, rgba(74,158,255,0.1))"
      : "var(--io-surface)",
    cursor: "pointer",
    fontSize: "13px",
    color: active ? "var(--io-accent, #4A9EFF)" : "var(--io-text-secondary)",
    fontWeight: active ? 600 : 400,
    userSelect: "none",
  });

  return (
    <>
      <Dialog.Title
        style={{
          margin: "0 0 4px",
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--io-text-primary)",
        }}
      >
        Print Checklist
      </Dialog.Title>
      <Dialog.Description
        style={{
          margin: "0 0 20px",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
        }}
      >
        Generate a printable paper checklist from a round template.
      </Dialog.Description>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Template selector (hidden if preselected) */}
        {!preselectedTemplateId && (
          <div>
            <label style={labelStyle} htmlFor="print-template-select">
              Template
            </label>
            <select
              id="print-template-select"
              style={selectStyle}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={loadingTemplates}
            >
              <option value="">— Select a template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (v{t.version})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mode selector */}
        <div>
          <label style={labelStyle}>Mode</label>
          <div style={radioGroupStyle}>
            <div
              style={radioOptionStyle(mode === "blank")}
              role="radio"
              aria-checked={mode === "blank"}
              tabIndex={0}
              onClick={() => setMode("blank")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setMode("blank");
              }}
            >
              <span>Blank checklist</span>
            </div>
            <div
              style={radioOptionStyle(mode === "current_results")}
              role="radio"
              aria-checked={mode === "current_results"}
              tabIndex={0}
              onClick={() => setMode("current_results")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  setMode("current_results");
              }}
            >
              <span>Current results</span>
            </div>
          </div>
          {mode === "current_results" && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-text-muted)",
                marginTop: "6px",
              }}
            >
              {loadingHistory || loadingInstance
                ? "Loading latest completed round…"
                : latestCompleted
                  ? `Using results from: ${latestCompleted.completed_at ? new Date(latestCompleted.completed_at).toLocaleString() : "most recent"}`
                  : selectedTemplateId
                    ? "No completed rounds found for this template — blank values will be used."
                    : "Select a template to load results."}
            </div>
          )}
        </div>

        {/* Page size selector */}
        <div>
          <label style={labelStyle}>Page size</label>
          <div style={radioGroupStyle}>
            <div
              style={radioOptionStyle(pageSize === "letter")}
              role="radio"
              aria-checked={pageSize === "letter"}
              tabIndex={0}
              onClick={() => setPageSize("letter")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setPageSize("letter");
              }}
            >
              Letter (8.5 × 11)
            </div>
            <div
              style={radioOptionStyle(pageSize === "a4")}
              role="radio"
              aria-checked={pageSize === "a4"}
              tabIndex={0}
              onClick={() => setPageSize("a4")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setPageSize("a4");
              }}
            >
              A4 (210 × 297 mm)
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "4px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "1px solid var(--io-border)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={
              !selectedTemplateId || !template || isLoading || isPrinting
            }
            style={{
              padding: "8px 20px",
              background: "var(--io-accent, #4A9EFF)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor:
                !selectedTemplateId || !template || isLoading || isPrinting
                  ? "not-allowed"
                  : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              opacity:
                !selectedTemplateId || !template || isLoading || isPrinting
                  ? 0.65
                  : 1,
            }}
          >
            {isPrinting
              ? "Opening print dialog…"
              : isLoading
                ? "Loading…"
                : "Print"}
          </button>
        </div>
      </div>

      {/* Hidden print area — visible only via @media print */}
      <div ref={printAreaRef}>
        {template && (
          <PrintArea
            template={template}
            mode={mode}
            pageSize={pageSize}
            responses={responses}
            printDate={new Date().toISOString()}
          />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function PrintDialog({
  preselectedTemplateId,
  trigger,
}: PrintDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "12px",
            padding: "24px",
            width: "480px",
            maxWidth: "95vw",
            maxHeight: "85vh",
            overflowY: "auto",
            zIndex: 1001,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          {open && (
            <PrintDialogContent
              preselectedTemplateId={preselectedTemplateId}
              onClose={() => setOpen(false)}
            />
          )}
          <Dialog.Close
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              color: "var(--io-text-muted)",
              lineHeight: 1,
              padding: "4px",
            }}
            aria-label="Close"
          >
            ×
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
