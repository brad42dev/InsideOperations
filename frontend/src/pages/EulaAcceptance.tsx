import { useRef, useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth";
import { authApi } from "../api/auth";
import type { EulaPendingItem } from "../api/auth";

// ---------------------------------------------------------------------------
// Lightweight markdown renderer — handles the subset used in the EULA
// ---------------------------------------------------------------------------

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "hr" }
  | { type: "blockquote"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string }
  | { type: "empty" };

function addSentenceSpacing(text: string): string {
  return text.replace(/\.( [A-Z])/g, ".\u00A0$1");
}

function parseInline(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return <strong key={i}>{addSentenceSpacing(tok.slice(2, -2))}</strong>;
    }
    if (tok.startsWith("*") && tok.endsWith("*")) {
      return <em key={i}>{addSentenceSpacing(tok.slice(1, -1))}</em>;
    }
    return addSentenceSpacing(tok);
  });
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2) });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3) });
      i++;
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (line.startsWith(">")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        bqLines.push(lines[i].slice(1).trimStart());
        i++;
      }
      blocks.push({ type: "blockquote", lines: bqLines });
      continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    blocks.push({ type: "p", text: line });
    i++;
  }

  return blocks;
}

function EulaContent({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown);
  const body = blocks[0]?.type === "h1" ? blocks.slice(1) : blocks;

  return (
    <div
      style={{
        color: "var(--io-text-secondary)",
        fontSize: "13.5px",
        lineHeight: 1.7,
      }}
    >
      {body.map((block, idx) => {
        switch (block.type) {
          case "h1":
            return null;

          case "h2":
            return (
              <h3
                key={idx}
                style={{
                  margin: "24px 0 8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--io-text-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  borderBottom: "1px solid var(--io-border-subtle)",
                  paddingBottom: "6px",
                }}
              >
                {parseInline(block.text)}
              </h3>
            );

          case "hr":
            return (
              <hr
                key={idx}
                style={{
                  border: "none",
                  borderTop: "1px solid var(--io-border)",
                  margin: "20px 0",
                }}
              />
            );

          case "blockquote": {
            const bqItems = block.lines.map((l) => ({
              isBullet: l.startsWith("- "),
              text: l.startsWith("- ") ? l.slice(2) : l,
            }));
            return (
              <div
                key={idx}
                style={{
                  margin: "16px 0",
                  padding: "14px 18px",
                  background: "var(--io-accent-subtle)",
                  borderLeft: "3px solid var(--io-accent)",
                  borderRadius: "0 var(--io-radius) var(--io-radius) 0",
                  color: "var(--io-text-secondary)",
                  fontSize: "13px",
                }}
              >
                {bqItems.map((item, j) => {
                  if (item.text.trim() === "") return <br key={j} />;
                  if (item.isBullet) {
                    return (
                      <div
                        key={j}
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "4px",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--io-accent)",
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        >
                          •
                        </span>
                        <span>{parseInline(item.text)}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={j} style={{ marginBottom: "2px" }}>
                      {parseInline(item.text)}
                    </div>
                  );
                })}
              </div>
            );
          }

          case "ul":
            return (
              <ul
                key={idx}
                style={{ margin: "8px 0", paddingLeft: 0, listStyle: "none" }}
              >
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "5px",
                    }}
                  >
                    <span
                      style={{ color: "var(--io-text-muted)", flexShrink: 0 }}
                    >
                      –
                    </span>
                    <span>{parseInline(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol
                key={idx}
                style={{
                  margin: "8px 0",
                  paddingLeft: 0,
                  listStyle: "none",
                  counterReset: "eula-ol",
                }}
              >
                {block.items.map((item, j) => (
                  <li
                    key={j}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "5px",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--io-accent)",
                        fontWeight: 600,
                        flexShrink: 0,
                        minWidth: "16px",
                      }}
                    >
                      {j + 1}.
                    </span>
                    <span>{parseInline(item)}</span>
                  </li>
                ))}
              </ol>
            );

          case "p": {
            const text = block.text.trim();
            if (!text) return null;
            const isItalicLine = /^\*[^*].+[^*]\*$/.test(text);
            return (
              <p
                key={idx}
                style={{
                  margin: "8px 0",
                  color: isItalicLine
                    ? "var(--io-text-muted)"
                    : "var(--io-text-secondary)",
                  fontSize: isItalicLine ? "12px" : undefined,
                }}
              >
                {parseInline(text)}
              </p>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single EULA acceptance panel
// ---------------------------------------------------------------------------

interface EulaPanelProps {
  item: EulaPendingItem;
  stepLabel: string;
  onAccepted: () => void;
  onDecline: () => void;
  isPending: boolean;
  error: string | null;
}

function EulaPanel({
  item,
  stepLabel,
  onAccepted,
  onDecline,
  isPending,
  error,
}: EulaPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [orgCheck, setOrgCheck] = useState(false);

  const isInstaller = item.eula_type === "installer";

  // Check if content fits without scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const fits =
        scrollRef.current.scrollHeight <= scrollRef.current.clientHeight + 8;
      if (fits) setScrolledToBottom(true);
    });
  }, [item]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8)
      setScrolledToBottom(true);
  }

  const canAccept = scrolledToBottom && (!isInstaller || orgCheck);

  return (
    <div
      style={{
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius-lg)",
        width: "100%",
        maxWidth: "760px",
        boxShadow: "var(--io-shadow-lg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "24px 32px 20px",
          borderBottom: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <h2
            style={{
              margin: 0,
              color: "var(--io-text-primary)",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Inside/Operations
          </h2>
          <span
            style={{
              color: "var(--io-text-muted)",
              fontSize: "14px",
              fontWeight: 400,
            }}
          >
            {isInstaller
              ? "Software License Agreement"
              : "End User License Agreement"}
          </span>
          <span
            style={{
              marginLeft: "auto",
              padding: "2px 8px",
              background: "var(--io-surface-sunken)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius-sm)",
              color: "var(--io-text-muted)",
              fontSize: "11px",
              fontFamily: "var(--io-font-mono)",
              flexShrink: 0,
            }}
          >
            v{item.version}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 600,
              background: isInstaller
                ? "var(--io-accent-subtle)"
                : "var(--io-surface-sunken)",
              color: isInstaller ? "var(--io-accent)" : "var(--io-text-muted)",
              border: `1px solid ${isInstaller ? "var(--io-accent)" : "var(--io-border)"}`,
            }}
          >
            {isInstaller
              ? "Organizational License"
              : "Individual Use Agreement"}
          </span>
          <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
            {stepLabel}
          </span>
        </div>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            color: "var(--io-text-muted)",
          }}
        >
          {isInstaller
            ? "This agreement governs your organization's rights to install and operate this software. Please read carefully before accepting on behalf of your organization."
            : "Please read the following terms carefully before using this application."}
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "0 32px", flex: 1, minHeight: 0 }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            maxHeight: "52vh",
            overflowY: "scroll",
            padding: "20px 4px 20px 0",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--io-border) transparent",
          }}
        >
          <EulaContent markdown={item.content} />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 32px",
          borderTop: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
        }}
      >
        {/* Scroll prompt */}
        {!scrolledToBottom && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
              padding: "8px 12px",
              background: "var(--io-surface-sunken)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              fontSize: "12px",
              color: "var(--io-text-muted)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <path
                d="M8 2v12M4 10l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Scroll to the bottom to enable acceptance
          </div>
        )}

        {/* Org acceptance checkbox — installer EULA only */}
        {isInstaller && scrolledToBottom && (
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={orgCheck}
              onChange={(e) => setOrgCheck(e.target.checked)}
              style={{
                marginTop: "2px",
                flexShrink: 0,
                accentColor: "var(--io-accent)",
              }}
            />
            <span
              style={{
                fontSize: "13px",
                color: "var(--io-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              I am authorized to accept this agreement on behalf of my
              organization, and I agree to the Inside/Operations Software
              License Agreement on its behalf.
            </span>
          </label>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px 12px",
              background: "var(--io-status-error-bg)",
              border: "1px solid var(--io-status-error)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-status-error)",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          {!isInstaller ? (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "var(--io-text-muted)",
                maxWidth: "420px",
              }}
            >
              The Installer EULA (software license) governing your
              organization's rights is available from{" "}
              <span style={{ color: "var(--io-text-secondary)" }}>
                Settings → EULA
              </span>
              .
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "var(--io-text-muted)",
                maxWidth: "420px",
              }}
            >
              An acceptance record with a cryptographic content hash will be
              stored for audit purposes.
            </p>
          )}

          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={onDecline}
              disabled={isPending}
              style={{
                background: "none",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                padding: "8px 18px",
                color: "var(--io-text-secondary)",
                fontSize: "13px",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.5 : 1,
              }}
            >
              Decline & Sign Out
            </button>

            <button
              type="button"
              onClick={onAccepted}
              disabled={!canAccept || isPending}
              style={{
                background: canAccept
                  ? "var(--io-accent)"
                  : "var(--io-surface-sunken)",
                border: "1px solid",
                borderColor: canAccept ? "transparent" : "var(--io-border)",
                borderRadius: "var(--io-radius)",
                padding: "8px 22px",
                color: canAccept
                  ? "var(--io-accent-contrast)"
                  : "var(--io-text-muted)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: !canAccept || isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.7 : 1,
                transition: "background 0.2s, color 0.2s, border-color 0.2s",
              }}
            >
              {isPending
                ? "Accepting…"
                : isInstaller
                  ? "I Accept on Behalf of My Organization"
                  : "I Accept"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EulaAcceptance page — sequences through all pending EULAs
// ---------------------------------------------------------------------------

export default function EulaAcceptance() {
  const navigate = useNavigate();
  const { user, pendingEulas, setPendingEulas, removePendingEula, logout } =
    useAuthStore();
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // If pending list not in store yet, fetch it
  const { data: fetchedPending, isLoading } = useQuery({
    queryKey: ["eula-pending"],
    queryFn: async () => {
      const result = await authApi.eulaGetPending();
      if (result.success) return result.data;
      throw new Error("Failed to load pending agreements");
    },
    enabled: pendingEulas === null,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (fetchedPending !== undefined && pendingEulas === null) {
      setPendingEulas(fetchedPending);
    }
  }, [fetchedPending, pendingEulas, setPendingEulas]);

  const effectivePending = pendingEulas ?? fetchedPending ?? null;
  const currentItem = effectivePending?.[0] ?? null;

  const acceptMutation = useMutation({
    mutationFn: async (item: EulaPendingItem) => {
      const context =
        item.eula_type === "installer" ? "installer_admin" : "login";
      const result = await authApi.eulaAccept(
        item.version,
        item.eula_type,
        context,
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (_data, item) => {
      setAcceptError(null);
      removePendingEula(item.eula_type);
    },
    onError: (err: Error) => {
      setAcceptError(
        err.message ?? "Failed to record acceptance. Please try again.",
      );
    },
  });

  // All done — navigate to app
  useEffect(() => {
    if (effectivePending !== null && effectivePending.length === 0) {
      navigate("/", { replace: true });
    }
  }, [effectivePending, navigate]);

  // Already fully accepted — shouldn't normally land here, but guard anyway
  if (
    user?.eula_accepted === true &&
    (effectivePending === null || effectivePending.length === 0)
  ) {
    return <Navigate to="/" replace />;
  }

  async function handleDecline() {
    await logout();
    navigate("/login", { replace: true });
  }

  if (isLoading || effectivePending === null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--io-surface-primary)",
          color: "var(--io-text-muted)",
          fontSize: "14px",
        }}
      >
        Loading agreements…
      </div>
    );
  }

  if (!currentItem) {
    return <Navigate to="/" replace />;
  }

  const total = pendingEulas?.length ?? fetchedPending?.length ?? 1;
  // We don't know the original total once items are removed, so track it
  const stepLabel =
    total > 1
      ? `Step ${currentItem.eula_type === "installer" ? 1 : 2} of ${total}`
      : "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--io-surface-primary)",
        padding: "24px",
      }}
    >
      <EulaPanel
        key={currentItem.eula_type}
        item={currentItem}
        stepLabel={stepLabel}
        onAccepted={() => acceptMutation.mutate(currentItem)}
        onDecline={handleDecline}
        isPending={acceptMutation.isPending}
        error={acceptError}
      />
    </div>
  );
}
