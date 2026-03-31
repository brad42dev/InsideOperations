import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { PasteFromOffice } from "./PasteFromOffice";
import {
  logsApi,
  type LogAttachment,
  type LogSegment,
  type LogTemplate,
} from "../../api/logs";
import { useWebSocket } from "../../shared/hooks/useWebSocket";
import { SkeletonBlock } from "../../shared/components/Skeleton";
import PointContextMenu from "../../shared/components/PointContextMenu";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    draft: {
      bg: "var(--io-warning-subtle)",
      text: "var(--io-warning)",
      label: "Draft",
    },
    in_progress: {
      bg: "var(--io-accent-subtle, rgba(74,158,255,0.15))",
      text: "var(--io-accent, #4A9EFF)",
      label: "In Progress",
    },
    submitted: {
      bg: "var(--io-success-subtle)",
      text: "var(--io-success)",
      label: "Submitted",
    },
    reviewed: {
      bg: "var(--io-accent-subtle)",
      text: "var(--io-accent)",
      label: "Reviewed",
    },
  };
  const c = map[status] ?? {
    bg: "var(--io-surface-secondary)",
    text: "var(--io-text-muted)",
    label: status,
  };
  return (
    <span
      style={{
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "100px",
        background: c.bg,
        color: c.text,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        background: active
          ? "var(--io-accent-subtle, rgba(74,158,255,0.15))"
          : "none",
        border: "none",
        borderRadius: "4px",
        padding: "4px 8px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: active ? 700 : 400,
        color: active ? "var(--io-accent)" : "var(--io-text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// WYSIWYG segment renderer
// ---------------------------------------------------------------------------

function WysiwygSegment({
  segmentId,
  initialContent,
  onChange,
  readOnly,
}: {
  segmentId: string;
  initialContent: Record<string, unknown>;
  onChange: (segmentId: string, content: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextStyle,
      Color,
      FontFamily,
      PasteFromOffice,
    ],
    content: (initialContent.doc as object) ?? "",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(segmentId, { doc: editor.getJSON(), text: editor.getText() });
    },
  });

  return (
    <div>
      {!readOnly && editor && (
        <div
          style={{
            display: "flex",
            gap: "2px",
            flexWrap: "wrap",
            padding: "6px 8px",
            borderBottom: "1px solid var(--io-border)",
            background: "var(--io-surface-secondary)",
          }}
        >
          <ToolbarBtn
            title="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <b>B</b>
          </ToolbarBtn>
          <ToolbarBtn
            title="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i>I</i>
          </ToolbarBtn>
          <ToolbarBtn
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <u>U</u>
          </ToolbarBtn>
          <ToolbarBtn
            title="Strikethrough"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <s>S</s>
          </ToolbarBtn>
          <span
            style={{
              width: "1px",
              background: "var(--io-border)",
              margin: "4px 4px",
            }}
          />
          <ToolbarBtn
            title="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            H1
          </ToolbarBtn>
          <ToolbarBtn
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            H2
          </ToolbarBtn>
          <ToolbarBtn
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            H3
          </ToolbarBtn>
          <span
            style={{
              width: "1px",
              background: "var(--io-border)",
              margin: "4px 4px",
            }}
          />
          <ToolbarBtn
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • List
          </ToolbarBtn>
          <ToolbarBtn
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. List
          </ToolbarBtn>
          <span
            style={{
              width: "1px",
              background: "var(--io-border)",
              margin: "4px 4px",
            }}
          />
          <ToolbarBtn
            title="Insert Image"
            onClick={() => {
              const url = window.prompt("Image URL");
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
          >
            Img
          </ToolbarBtn>
          <ToolbarBtn
            title="Insert Table"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            Table
          </ToolbarBtn>
          <label
            title="Text color"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              padding: "4px 6px",
              borderRadius: "4px",
            }}
          >
            A
            <input
              type="color"
              style={{
                width: "18px",
                height: "18px",
                padding: 0,
                border: "none",
                cursor: "pointer",
                background: "none",
              }}
              onChange={(e) =>
                editor.chain().focus().setColor(e.target.value).run()
              }
            />
          </label>
          <span
            style={{
              width: "1px",
              background: "var(--io-border)",
              margin: "4px 4px",
            }}
          />
          <select
            title="Font family"
            value={editor.getAttributes("textStyle").fontFamily ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                editor.chain().focus().setFontFamily(value).run();
              } else {
                editor.chain().focus().unsetFontFamily().run();
              }
            }}
            style={{
              background: "var(--io-surface-secondary)",
              border: "1px solid var(--io-border)",
              borderRadius: "4px",
              padding: "3px 6px",
              fontSize: "12px",
              color: "var(--io-text-secondary)",
              cursor: "pointer",
            }}
          >
            <option value="">Default</option>
            <option value="Inter, sans-serif">Inter</option>
            <option value="serif">Serif</option>
            <option value="monospace">Monospace</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
          </select>
        </div>
      )}
      <div
        style={{
          padding: "12px",
          minHeight: "120px",
          color: "var(--io-text-primary)",
          fontSize: "14px",
          lineHeight: 1.6,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field table / field list segment renderer
// ---------------------------------------------------------------------------

type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
};

function FieldsSegment({
  segmentId,
  fields,
  values,
  layout,
  onChange,
  readOnly,
}: {
  segmentId: string;
  fields: FieldDef[];
  values: Record<string, unknown>;
  layout: "table" | "list";
  onChange: (segmentId: string, content: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const handleChange = (fieldName: string, value: string) => {
    onChange(segmentId, { ...values, [fieldName]: value });
  };

  const renderInput = (field: FieldDef) => {
    const val = String(values[field.name] ?? "");
    if (readOnly) {
      return (
        <span style={{ color: "var(--io-text-primary)", fontSize: "14px" }}>
          {val || <span style={{ color: "var(--io-text-muted)" }}>—</span>}
        </span>
      );
    }
    if (field.type === "select" && field.options) {
      return (
        <select
          value={val}
          onChange={(e) => handleChange(field.name, e.target.value)}
          style={{
            background: "var(--io-bg)",
            border: "1px solid var(--io-border)",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "13px",
            color: "var(--io-text-primary)",
            minWidth: "120px",
          }}
        >
          <option value="">Select...</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={field.type === "number" ? "number" : "text"}
        value={val}
        onChange={(e) => handleChange(field.name, e.target.value)}
        style={{
          background: "var(--io-bg)",
          border: "1px solid var(--io-border)",
          borderRadius: "4px",
          padding: "4px 8px",
          fontSize: "13px",
          color: "var(--io-text-primary)",
          width: "100%",
          maxWidth: "240px",
        }}
      />
    );
  };

  if (layout === "table") {
    return (
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
            <th
              style={{
                padding: "8px 12px",
                textAlign: "left",
                fontSize: "12px",
                color: "var(--io-text-secondary)",
                fontWeight: 600,
              }}
            >
              Field
            </th>
            <th
              style={{
                padding: "8px 12px",
                textAlign: "left",
                fontSize: "12px",
                color: "var(--io-text-secondary)",
                fontWeight: 600,
              }}
            >
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr
              key={field.name}
              style={{ borderBottom: "1px solid var(--io-border)" }}
            >
              <td
                style={{
                  padding: "8px 12px",
                  color: "var(--io-text-secondary)",
                  fontWeight: 500,
                }}
              >
                {field.label}
              </td>
              <td style={{ padding: "8px 12px" }}>{renderInput(field)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // list layout
  return (
    <div
      style={{
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {fields.map((field) => (
        <div
          key={field.name}
          style={{ display: "flex", flexDirection: "column", gap: "4px" }}
        >
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {field.label}
          </label>
          {renderInput(field)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Point data segment renderer
// ---------------------------------------------------------------------------

function PointDataSegment({ pointIds }: { pointIds?: string[] }) {
  const ids = pointIds ?? [];
  const { values } = useWebSocket(ids);

  if (ids.length === 0) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "var(--io-surface-secondary)",
          borderRadius: "6px",
          fontSize: "13px",
          color: "var(--io-text-muted)",
          textAlign: "center",
        }}
      >
        No points configured for this segment.
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: "6px",
        overflow: "hidden",
        border: "1px solid var(--io-border)",
      }}
    >
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}
      >
        <thead>
          <tr>
            <th
              style={{
                padding: "6px 12px",
                textAlign: "left",
                background: "var(--io-surface-secondary)",
                borderBottom: "1px solid var(--io-border)",
                fontWeight: 600,
                color: "var(--io-text-muted)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Point
            </th>
            <th
              style={{
                padding: "6px 12px",
                textAlign: "right",
                background: "var(--io-surface-secondary)",
                borderBottom: "1px solid var(--io-border)",
                fontWeight: 600,
                color: "var(--io-text-muted)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {ids.map((pid, idx) => {
            const pv = values.get(pid);
            return (
              <PointContextMenu
                key={pid}
                pointId={pid}
                tagName={pid}
                isAlarm={false}
                isAlarmElement={false}
              >
                <tr
                  style={{
                    background:
                      idx % 2 === 0
                        ? "transparent"
                        : "var(--io-surface-secondary)",
                  }}
                >
                  <td
                    style={{
                      padding: "7px 12px",
                      color: "var(--io-text-secondary)",
                      fontFamily: "var(--io-font-mono, monospace)",
                      fontSize: "12px",
                      borderBottom:
                        idx < ids.length - 1
                          ? "1px solid var(--io-border)"
                          : "none",
                    }}
                  >
                    {pid}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      textAlign: "right",
                      color: pv
                        ? "var(--io-text-primary)"
                        : "var(--io-text-muted)",
                      fontWeight: pv ? 600 : 400,
                      borderBottom:
                        idx < ids.length - 1
                          ? "1px solid var(--io-border)"
                          : "none",
                    }}
                  >
                    {pv ? String(pv.value) : "—"}
                  </td>
                </tr>
              </PointContextMenu>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment card
// ---------------------------------------------------------------------------

function SegmentCard({
  segment,
  entryContent,
  onContentChange,
  readOnly,
}: {
  segment: LogSegment;
  entryContent: Record<string, unknown>;
  onContentChange: (
    segmentId: string,
    content: Record<string, unknown>,
  ) => void;
  readOnly: boolean;
}) {
  const config = segment.content_config;

  const renderContent = () => {
    switch (segment.segment_type) {
      case "wysiwyg":
        return (
          <WysiwygSegment
            segmentId={segment.id}
            initialContent={entryContent}
            onChange={onContentChange}
            readOnly={readOnly}
          />
        );
      case "field_table": {
        const fields = (config.fields as FieldDef[]) ?? [];
        return (
          <FieldsSegment
            segmentId={segment.id}
            fields={fields}
            values={entryContent}
            layout="table"
            onChange={onContentChange}
            readOnly={readOnly}
          />
        );
      }
      case "field_list": {
        const fields = (config.fields as FieldDef[]) ?? [];
        return (
          <FieldsSegment
            segmentId={segment.id}
            fields={fields}
            values={entryContent}
            layout="list"
            onChange={onContentChange}
            readOnly={readOnly}
          />
        );
      }
      case "point_data":
        return (
          <PointDataSegment
            pointIds={config.point_ids as string[] | undefined}
          />
        );
      default:
        return (
          <div
            style={{
              padding: "12px",
              color: "var(--io-text-muted)",
              fontSize: "14px",
            }}
          >
            Unknown segment type: {segment.segment_type}
          </div>
        );
    }
  };

  return (
    <div
      style={{
        background: "var(--io-surface)",
        border: "1px solid var(--io-border)",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--io-text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {segment.name}
      </div>
      {renderContent()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submit confirmation dialog
// ---------------------------------------------------------------------------

function SubmitDialog({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "12px",
          padding: "28px",
          width: "400px",
          maxWidth: "90vw",
        }}
      >
        <h3 style={{ margin: "0 0 12px", color: "var(--io-text-primary)" }}>
          Submit Log?
        </h3>
        <p
          style={{
            margin: "0 0 24px",
            color: "var(--io-text-secondary)",
            fontSize: "14px",
          }}
        >
          Submitting will mark this log as submitted. This action cannot be
          undone.
        </p>
        <div
          style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
        >
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "1px solid var(--io-border)",
              borderRadius: "6px",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "14px",
              color: "var(--io-text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: "var(--io-success)",
              border: "none",
              borderRadius: "6px",
              padding: "8px 20px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--io-status-fg)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachment panel
// ---------------------------------------------------------------------------

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

function mediaBadge(mediaType: string): string {
  if (mediaType.startsWith("image/")) return "Photo";
  if (mediaType.startsWith("video/")) return "Video";
  if (mediaType.startsWith("audio/")) return "Audio";
  return "File";
}

function AttachmentPanel({
  instanceId,
  readOnly,
  attachments,
}: {
  instanceId: string;
  readOnly: boolean;
  attachments: LogAttachment[];
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => logsApi.uploadAttachment(instanceId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-instance", instanceId] });
      setSizeError(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected after an error
    e.target.value = "";
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setSizeError(
        `"${file.name}" exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
      );
      return;
    }
    setSizeError(null);
    uploadMutation.mutate(file);
  };

  if (readOnly) return null;

  return (
    <div
      style={{
        background: "var(--io-surface)",
        border: "1px solid var(--io-border)",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--io-text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Attachments</span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            style={{
              background: "var(--io-accent)",
              border: "none",
              borderRadius: "5px",
              padding: "4px 12px",
              cursor: uploadMutation.isPending ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-accent-foreground)",
              opacity: uploadMutation.isPending ? 0.7 : 1,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            {uploadMutation.isPending ? "Uploading..." : "+ Add File"}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Inline error */}
      {sizeError && (
        <div
          style={{
            padding: "8px 16px",
            background: "var(--io-danger-subtle)",
            borderBottom: "1px solid var(--io-border)",
            fontSize: "13px",
            color: "var(--io-danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <span>{sizeError}</span>
          <button
            type="button"
            onClick={() => setSizeError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-danger)",
              fontSize: "16px",
              lineHeight: 1,
              padding: "0 2px",
              flexShrink: 0,
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Upload error from server */}
      {uploadMutation.isError && (
        <div
          style={{
            padding: "8px 16px",
            background: "var(--io-danger-subtle)",
            borderBottom: "1px solid var(--io-border)",
            fontSize: "13px",
            color: "var(--io-danger)",
          }}
        >
          Upload failed. Please try again.
        </div>
      )}

      {/* Attachment list */}
      <div style={{ padding: attachments.length > 0 ? "0" : "16px" }}>
        {attachments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            No attachments yet.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {attachments.map((att, idx) => (
              <li
                key={att.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 16px",
                  borderBottom:
                    idx < attachments.length - 1
                      ? "1px solid var(--io-border)"
                      : "none",
                  fontSize: "13px",
                  color: "var(--io-text-primary)",
                }}
              >
                {/* Type badge */}
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "100px",
                    background:
                      "var(--io-accent-subtle, rgba(74,158,255,0.15))",
                    color: "var(--io-accent, #4A9EFF)",
                    flexShrink: 0,
                  }}
                >
                  {mediaBadge(att.media_type)}
                </span>

                {/* Filename */}
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {att.filename}
                </span>

                {/* Remove button (only when editable) */}
                {!readOnly && (
                  <button
                    type="button"
                    title="Remove attachment"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--io-text-muted)",
                      fontSize: "16px",
                      lineHeight: 1,
                      padding: "0 2px",
                      flexShrink: 0,
                    }}
                    onClick={() => {
                      // Remove action: placeholder for delete API (not yet specced)
                      // Optimistically filter from query cache until API is available
                      queryClient.setQueryData(
                        ["log-instance", instanceId],
                        (
                          old: { attachments?: LogAttachment[] } | undefined,
                        ) => {
                          if (!old) return old;
                          return {
                            ...old,
                            attachments: (old.attachments ?? []).filter(
                              (a) => a.id !== att.id,
                            ),
                          };
                        },
                      );
                    }}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading state (CX-LOADING)
// ---------------------------------------------------------------------------

function LogEditorSkeleton() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--io-bg)",
        overflow: "hidden",
      }}
    >
      {/* Header bar skeleton */}
      <div
        style={{
          borderBottom: "1px solid var(--io-border)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
          height: "60px",
        }}
      >
        <SkeletonBlock height="20px" width="200px" />
        <div style={{ flex: 1 }} />
        <SkeletonBlock height="30px" width="80px" borderRadius="6px" />
        <SkeletonBlock height="30px" width="80px" borderRadius="6px" />
      </div>
      {/* Segment cards skeleton */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          maxWidth: "800px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {[120, 140].map((h, i) => (
          <div
            key={i}
            style={{
              background: "var(--io-surface)",
              border: "1px solid var(--io-border)",
              borderRadius: "8px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <SkeletonBlock height="16px" width="35%" />
            <SkeletonBlock
              height={`${h - 36}px`}
              width="100%"
              borderRadius="6px"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function LogEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Local content state: segment_id -> content object
  const [pendingContent, setPendingContent] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const hasPendingRef = useRef(false);
  const pendingContentRef = useRef<Record<string, Record<string, unknown>>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: instanceData, isLoading } = useQuery({
    queryKey: ["log-instance", id],
    queryFn: async () => {
      const res = await logsApi.getInstance(id!);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: segmentsData } = useQuery({
    queryKey: ["log-segments"],
    queryFn: async () => {
      const res = await logsApi.listSegments();
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!instanceData,
  });

  const { data: templateData } = useQuery({
    queryKey: ["log-templates"],
    queryFn: async () => {
      const res = await logsApi.listTemplates();
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!instanceData,
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      status?: string;
      content_updates?: Array<{
        segment_id: string;
        content: Record<string, unknown>;
      }>;
    }) => logsApi.updateInstance(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-instance", id] });
      setLastSaved(new Date());
      setSaving(false);
    },
    onError: () => {
      setSaving(false);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => logsApi.submitInstance(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-instance", id] });
      queryClient.invalidateQueries({ queryKey: ["log-instances"] });
      setShowSubmitDialog(false);
      navigate("/log");
    },
  });

  const startMutation = useMutation({
    mutationFn: () => logsApi.updateInstance(id!, { status: "in_progress" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-instance", id] });
    },
  });

  // Periodic auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!hasPendingRef.current) return;
      const updates = Object.entries(pendingContentRef.current).map(
        ([segment_id, content]) => ({
          segment_id,
          content,
        }),
      );
      if (updates.length === 0) return;
      hasPendingRef.current = false;
      setSaving(true);
      updateMutation.mutate({ content_updates: updates });
    }, 30_000);
    return () => clearInterval(interval);
  }, [updateMutation]);

  const handleContentChange = (
    segmentId: string,
    content: Record<string, unknown>,
  ) => {
    const next = { ...pendingContent, [segmentId]: content };
    setPendingContent(next);
    pendingContentRef.current = next;
    hasPendingRef.current = true;
  };

  // Build a map of segment_id -> entry content from fetched data
  const entryMap: Record<string, Record<string, unknown>> = {};
  if (instanceData?.entries) {
    for (const entry of instanceData.entries) {
      entryMap[entry.segment_id] = entry.content;
    }
  }

  // Segments for this template (in order)
  const templateList: LogTemplate[] = Array.isArray(templateData)
    ? templateData
    : ((templateData as any)?.data ?? []);
  const segmentList: LogSegment[] = Array.isArray(segmentsData)
    ? segmentsData
    : ((segmentsData as any)?.data ?? []);
  const template = templateList.find(
    (t: LogTemplate) => t.id === instanceData?.template_id,
  );
  const orderedSegments: LogSegment[] = [];
  if (template && segmentList.length > 0) {
    for (const segId of template.segment_ids) {
      const seg = segmentList.find((s: LogSegment) => s.id === segId);
      if (seg) orderedSegments.push(seg);
    }
  }

  const readOnly =
    instanceData?.status === "submitted" || instanceData?.status === "reviewed";

  if (isLoading) {
    return <LogEditorSkeleton />;
  }

  if (!instanceData) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--io-text-muted)",
          fontSize: "14px",
        }}
      >
        Instance not found.
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--io-bg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--io-border)",
          background: "var(--io-surface)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <button
          onClick={() => navigate("/log")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--io-text-muted)",
            fontSize: "20px",
            lineHeight: 1,
            padding: "0 4px",
          }}
          title="Back to Log"
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--io-text-primary)",
              }}
            >
              {instanceData.template_name ?? "Log Entry"}
            </h2>
            <StatusBadge status={instanceData.status} />
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "var(--io-text-muted)",
              marginTop: "2px",
              display: "flex",
              gap: "12px",
            }}
          >
            {instanceData.team_name && (
              <span>Team: {instanceData.team_name}</span>
            )}
            <span>{new Date(instanceData.created_at).toLocaleString()}</span>
            {lastSaved && (
              <span style={{ color: "var(--io-success)" }}>
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {saving && (
              <span style={{ color: "var(--io-accent)" }}>Saving...</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {instanceData.status === "draft" && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              style={{
                background: "var(--io-accent)",
                color: "var(--io-accent-foreground)",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                opacity: startMutation.isPending ? 0.7 : 1,
              }}
            >
              Start
            </button>
          )}
          {instanceData.status === "in_progress" && (
            <button
              onClick={() => setShowSubmitDialog(true)}
              style={{
                background: "var(--io-success)",
                color: "var(--io-status-fg)",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Submit
            </button>
          )}
        </div>
      </div>

      {/* Segments */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px",
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {orderedSegments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "var(--io-text-muted)",
              fontSize: "14px",
            }}
          >
            No segments configured for this template.
          </div>
        ) : (
          orderedSegments.map((seg) => (
            <SegmentCard
              key={seg.id}
              segment={seg}
              entryContent={pendingContent[seg.id] ?? entryMap[seg.id] ?? {}}
              onContentChange={handleContentChange}
              readOnly={readOnly}
            />
          ))
        )}

        <AttachmentPanel
          instanceId={id!}
          readOnly={readOnly}
          attachments={instanceData.attachments ?? []}
        />
      </div>

      {showSubmitDialog && (
        <SubmitDialog
          onConfirm={() => submitMutation.mutate()}
          onCancel={() => setShowSubmitDialog(false)}
          loading={submitMutation.isPending}
        />
      )}
    </div>
  );
}
