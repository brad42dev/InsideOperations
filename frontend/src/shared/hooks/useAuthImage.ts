import { useEffect, useState } from "react";

const TOKEN_KEY = "io_access_token";

// Session-scoped blob URL cache — avoids re-fetching on palette close/reopen.
// Entries are never explicitly evicted; they live for the page session, which
// is correct for thumbnails (stable URL = stable content within a session).
const cache = new Map<string, string>();

/**
 * Fetches an API image URL with the JWT auth header and returns a blob object
 * URL. Needed because <img src> never sends Authorization headers.
 *
 * Results are cached by URL for the page session — remounts are instant.
 * Returns undefined while loading or on error.
 */
export function useAuthImage(url: string | undefined): string | undefined {
  const [blobSrc, setBlobSrc] = useState<string | undefined>(
    url ? cache.get(url) : undefined,
  );

  useEffect(() => {
    if (!url) return;

    const cached = cache.get(url);
    if (cached) {
      setBlobSrc(cached);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY) ?? "";
    let cancelled = false;

    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        if (!r.ok) throw new Error("not ok");
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        cache.set(url, objectUrl);
        setBlobSrc(objectUrl);
      })
      .catch(() => {
        // Leave blobSrc undefined — caller shows placeholder
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return blobSrc;
}
