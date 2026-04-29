export interface CreateVideoExportRequest {
  module: "process" | "console";
  graphic_id: string;
  range_start: number; // epoch ms
  range_end: number;
  step_ms: number;
  fps: number;
  width_px: number;
  height_px: number;
  device_pixel_ratio: number;
  overlay_timestamp: boolean;
  crf: number;
  snapshot_workspace_id?: string;
}

export interface VideoExportJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  module: string;
  graphic_id: string;
  range_start: string;
  range_end: string;
  step_ms: number;
  fps: number;
  width_px: number;
  height_px: number;
  overlay_timestamp: boolean;
  crf: number;
  file_size_bytes: number | null;
  original_filename: string | null;
  duration_seconds: number | null;
  frames_total: number | null;
  frames_rendered: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const TOKEN_KEY = "io_access_token";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export const videoExportsApi = {
  create: (req: CreateVideoExportRequest) =>
    fetch("/api/video-exports", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...req,
        range_start: new Date(req.range_start).toISOString(),
        range_end: new Date(req.range_end).toISOString(),
      }),
    }).then(async (r) => {
      if (r.ok) return r.json();
      let body: unknown;
      try {
        body = await r.json();
      } catch {
        body = { status: r.status, message: `HTTP ${r.status}` };
      }
      return Promise.reject(body);
    }),

  list: (): Promise<VideoExportJob[]> =>
    fetch("/api/video-exports", { headers: authHeaders() }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as
        | { data?: VideoExportJob[] }
        | VideoExportJob[];
      return Array.isArray(body)
        ? body
        : ((body as { data?: VideoExportJob[] }).data ?? []);
    }),

  get: (id: string): Promise<VideoExportJob> =>
    fetch(`/api/video-exports/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((r) => r?.data ?? r),

  cancel: (id: string): Promise<void> =>
    fetch(`/api/video-exports/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(() => undefined),

  getDownloadUrl: (id: string): string => `/api/video-exports/${id}/download`,

  download: async (id: string): Promise<void> => {
    const resp = await fetch(`/api/video-exports/${id}/download`, {
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const disposition = resp.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    a.download = match?.[1] ?? `video-export-${id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
