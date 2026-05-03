import { api, type ApiResult } from "./client";

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
}

export type UpdateVideoStreamInput = Partial<CreateVideoStreamInput>;

export interface VideoStreamAccess {
  stream_id: string;
  entity_type: "role" | "user";
  entity_id: string;
  entity_name?: string;
}

export interface VideoStreamToken {
  direct_url?: string;
  relay_url?: string;
  token: string;
  expires_at: string;
}

export const videoStreamsApi = {
  list: (): Promise<ApiResult<VideoStream[]>> =>
    api.get<VideoStream[]>("/api/video-streams"),

  get: (id: string): Promise<ApiResult<VideoStream>> =>
    api.get<VideoStream>(`/api/video-streams/${id}`),

  create: (body: CreateVideoStreamInput): Promise<ApiResult<VideoStream>> =>
    api.post<VideoStream>("/api/video-streams", body),

  update: (
    id: string,
    body: UpdateVideoStreamInput,
  ): Promise<ApiResult<VideoStream>> =>
    api.put<VideoStream>(`/api/video-streams/${id}`, body),

  remove: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/video-streams/${id}`),

  token: (id: string): Promise<ApiResult<VideoStreamToken>> =>
    api.get<VideoStreamToken>(`/api/video-streams/${id}/token`),

  listAccess: (id: string): Promise<ApiResult<VideoStreamAccess[]>> =>
    api.get<VideoStreamAccess[]>(`/api/video-streams/${id}/access`),

  addAccess: (
    id: string,
    entity_type: "role" | "user",
    entity_id: string,
  ): Promise<ApiResult<VideoStreamAccess>> =>
    api.post<VideoStreamAccess>(`/api/video-streams/${id}/access`, {
      entity_type,
      entity_id,
    }),

  removeAccess: (
    id: string,
    entity_type: "role" | "user",
    entity_id: string,
  ): Promise<ApiResult<void>> =>
    api.delete<void>(
      `/api/video-streams/${id}/access/${entity_type}/${entity_id}`,
    ),
};
