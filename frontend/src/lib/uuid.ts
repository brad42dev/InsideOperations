/**
 * RFC 4122 v4 UUID — works in both secure (HTTPS) and non-secure (HTTP dev)
 * contexts.  crypto.randomUUID() is only available in secure contexts, so we
 * fall back to a Math.random()-based implementation that still produces
 * correctly formatted v4 UUIDs.
 */
export function uuidv4(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 via Math.random()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
