# Phase 07b — Camera Streams Settings UI

**Goal:** Add a "Camera Streams" tab to the Settings module: list, create, edit, delete streams, and manage per-stream ACL grants for private streams. Admin-only.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 07a must be complete (the API endpoints must exist and work).
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` — to see how Settings tabs are registered.
- `/home/io/io-dev/io/frontend/src/pages/settings/SettingsPageLayout.tsx` — the layout component used by other tabs.
- `/home/io/io-dev/io/frontend/src/pages/settings/AuthProviders.tsx` or `/home/io/io-dev/io/frontend/src/pages/settings/Roles.tsx` — pick a representative existing CRUD-style settings tab as your structural template.
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts` — shared styles.

## Context

The Camera Streams tab is a standard CRUD admin tool. It has:

- A list of all streams (admins see everything; non-admins shouldn't even reach this tab).
- An "Add Stream" button → dialog with:
  - Name + description.
  - Visibility tier (public / managed / private).
  - Connection mode (direct / relay / auto).
  - Direct URL field (visible when mode is direct or auto).
  - Relay configuration (visible when mode is relay or auto): list of go2rtc input URLs (RTSP/RTMP/etc.). "Test Connection" button calls a probe endpoint (or just the existing token endpoint) to verify go2rtc can reach the camera.
- For each row: Edit and Delete buttons.
- For each private stream's row: an "Access" button → dialog managing ACL grants (add/remove role or user).

Tabs are registered in `index.tsx` (or wherever the Settings router lives). We add a `"camera-streams"` route that's gated on the `video_streams:manage` permission.

## Changes

### 1. Create the API client

Create `frontend/src/api/videoStreams.ts`:

```ts
import { apiClient } from "./client"; // or whatever the existing axios/fetch wrapper is

export interface VideoStream {
  id: string;
  name: string;
  description?: string | null;
  visibility: "public" | "managed" | "private";
  connection_mode: "direct" | "relay" | "auto";
  direct_url?: string | null;
  relay_config?: { stream_name?: string; go2rtc_inputs?: string[] } | null;
  onvif_config?: unknown | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVideoStreamInput {
  name: string;
  description?: string;
  visibility: VideoStream["visibility"];
  connection_mode: VideoStream["connection_mode"];
  direct_url?: string;
  relay_config?: VideoStream["relay_config"];
  onvif_config?: unknown;
}

export interface UpdateVideoStreamInput extends Partial<CreateVideoStreamInput> {}

export interface VideoStreamAccess {
  stream_id: string;
  entity_type: "role" | "user";
  entity_id: string;
}

export const videoStreamsApi = {
  list: () => apiClient.get<VideoStream[]>("/video-streams"),
  get: (id: string) => apiClient.get<VideoStream>(`/video-streams/${id}`),
  create: (body: CreateVideoStreamInput) =>
    apiClient.post<VideoStream>("/video-streams", body),
  update: (id: string, body: UpdateVideoStreamInput) =>
    apiClient.put<VideoStream>(`/video-streams/${id}`, body),
  remove: (id: string) => apiClient.delete<void>(`/video-streams/${id}`),
  token: (id: string) =>
    apiClient.get<{
      direct_url?: string;
      relay_url?: string;
      token: string;
      expires_at: string;
    }>(`/video-streams/${id}/token`),
  listAccess: (id: string) =>
    apiClient.get<VideoStreamAccess[]>(`/video-streams/${id}/access`),
  addAccess: (id: string, entity_type: "role" | "user", entity_id: string) =>
    apiClient.post<VideoStreamAccess>(`/video-streams/${id}/access`, {
      entity_type,
      entity_id,
    }),
  removeAccess: (
    id: string,
    entity_type: "role" | "user",
    entity_id: string,
  ) =>
    apiClient.delete<void>(
      `/video-streams/${id}/access/${entity_type}/${entity_id}`,
    ),
};
```

(Use the existing API client wrapper — `apiClient` is illustrative. Match `frontend/src/api/dashboards.ts` or another existing file.)

### 2. Create the Settings tab component

Create `frontend/src/pages/settings/CameraStreams.tsx`:

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { videoStreamsApi, type VideoStream } from "../../api/videoStreams";
import SettingsPageLayout from "./SettingsPageLayout";
import { settingsStyles } from "./settingsStyles";
// ... import existing UI primitives: Button, Dialog, TextInput, Select, etc.

export default function CameraStreamsTab() {
  const qc = useQueryClient();
  const { data: streams = [] } = useQuery({
    queryKey: ["video-streams"],
    queryFn: () => videoStreamsApi.list().then((r) => r.data),
  });

  const [editing, setEditing] = useState<VideoStream | null>(null);
  const [creating, setCreating] = useState(false);
  const [aclFor, setAclFor] = useState<VideoStream | null>(null);

  const removeMut = useMutation({
    mutationFn: (id: string) => videoStreamsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-streams"] }),
  });

  return (
    <SettingsPageLayout title="Camera Streams" description="Configure live video sources for Camera Stream widgets.">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setCreating(true)}>+ Add Stream</button>
      </div>

      <table style={settingsStyles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Visibility</th>
            <th>Mode</th>
            <th>URL / Inputs</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {streams.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.visibility}</td>
              <td>{s.connection_mode}</td>
              <td style={{ fontFamily: "ui-monospace" }}>
                {s.direct_url ?? s.relay_config?.go2rtc_inputs?.join(", ") ?? "—"}
              </td>
              <td>
                <button onClick={() => setEditing(s)}>Edit</button>
                {s.visibility === "private" && (
                  <button onClick={() => setAclFor(s)} style={{ marginLeft: 4 }}>Access</button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Delete "${s.name}"?`)) removeMut.mutate(s.id);
                  }}
                  style={{ marginLeft: 4 }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {streams.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: "var(--io-text-muted)", textAlign: "center", padding: 16 }}>
                No streams configured
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {creating && <CameraStreamDialog onClose={() => setCreating(false)} stream={null} />}
      {editing && <CameraStreamDialog onClose={() => setEditing(null)} stream={editing} />}
      {aclFor && <CameraStreamAclDialog onClose={() => setAclFor(null)} stream={aclFor} />}
    </SettingsPageLayout>
  );
}
```

### 3. `CameraStreamDialog` (create + edit)

Same file or a sibling. Form fields:

- **Name** — text required.
- **Description** — text optional.
- **Visibility** — select (public / managed / private).
- **Connection Mode** — select (direct / relay / auto).
- **Direct URL** — visible when mode is direct or auto. Text input; placeholder `rtsp://camera.local/stream1`. Note: direct mode requires the browser to reach the camera; intended for private networks.
- **Relay Inputs** — visible when mode is relay or auto. Multi-line textarea or a list editor; each entry is a go2rtc input URL.
- **Test Connection** — button (visible when relay or auto). Calls `videoStreamsApi.token(streamId)` after saving to verify go2rtc has the stream registered. For new streams, save first then test. (Or POST/PUT with a `dry_run: true` flag if you extend the backend.)

On submit: call `videoStreamsApi.create` or `update`, invalidate the query, close dialog.

### 4. `CameraStreamAclDialog` (private stream ACL)

Lists current ACL grants. Form to add a new grant: pick role (from existing roles dropdown) or user (autocomplete from users API). On submit: call `addAccess`. Each row has a Remove button calling `removeAccess`.

Use `useQuery({ queryKey: ["video-stream-access", stream.id], ... })` to fetch grants.

### 5. Register the tab in Settings

Find the Settings tab registry (likely `frontend/src/pages/settings/index.tsx`). Add an entry:

```tsx
{
  id: "camera-streams",
  label: "Camera Streams",
  permission: "video_streams:manage",
  component: CameraStreamsTab,
},
```

Match the surrounding pattern. Tabs gated by permission only show in the navigation when the user has it.

### 6. Add an "Allowed embedded URL/origin" probe (optional)

If your platform integrates ONVIF discovery in the future, the dialog could also probe an ONVIF endpoint. For phase 07b, skip it — `onvif_config` stays `null`. Document as a future enhancement.

## Gotchas

- **Permission-gated tab**: the tab must not show for users without `video_streams:manage`. The settings index already has this pattern — copy verbatim from `Roles.tsx` or `AuthProviders.tsx`.
- **`createPortal` for modals**: dialogs that overlay react-grid-layout-hosted content must use `createPortal(el, document.body)` because CSS transforms break `position: fixed`. The Settings module isn't typically inside react-grid-layout, so simple `position: fixed` modals likely work. Match the existing dialog component used in other Settings tabs.
- **Form validation**: at least name and either direct_url or relay_config.go2rtc_inputs (depending on mode). Show inline errors.
- **Optimistic updates** are nice but not required for phase 07b. Plain `invalidateQueries` after save is fine.
- **`pnpm test` + `pnpm build`** required.
- **Designer Mode B selection** — irrelevant here (Settings is its own page).

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** Log in as admin. Settings → Camera Streams tab is visible. List is empty.
3. Click + Add Stream. Fill name, visibility=managed, mode=relay, add a public RTSP URL (e.g. `rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4`). Save. Stream appears in the list.
4. Edit the stream — change visibility to private. Save. The "Access" button appears in the row.
5. Click Access — dialog shows empty grants. Add a role grant (e.g. role "operators"). Grant appears.
6. Remove the grant — disappears.
7. Delete the stream — confirms, then disappears. go2rtc no longer has the registration (verified via `curl /go2rtc/api/streams`).
8. Log in as a non-admin user — Camera Streams tab is **not** visible in the Settings nav.

## Phase dependencies

- **Depends on:** Phase 07a.
- **Gates:** Phase 07c (camera widget needs streams to choose from).
