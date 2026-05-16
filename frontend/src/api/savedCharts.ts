import { api, type ApiResult, type PaginatedResult } from "./client";
import type { ChartConfig } from "../shared/components/charts/chart-config-types";
import type {
  VersionSummary,
  ChartVersionContent,
} from "../shared/types/versioning";

export interface SavedChartResponse {
  id: string;
  name: string;
  description?: string | null;
  chart_type: number;
  config: ChartConfig;
  published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedChartRequest {
  name: string;
  description?: string;
  chart_type: number;
  config: ChartConfig;
  published?: boolean;
  label?: string;
}

export interface UpdateSavedChartRequest {
  name?: string;
  description?: string;
  chart_type?: number;
  config?: ChartConfig;
  label?: string;
}

export const savedChartsApi = {
  list: (params?: {
    allUsers?: boolean;
  }): Promise<ApiResult<PaginatedResult<SavedChartResponse>>> =>
    api.get<PaginatedResult<SavedChartResponse>>(
      `/api/v1/saved-charts${params?.allUsers ? "?all_users=true" : ""}`,
    ),

  get: (id: string): Promise<ApiResult<SavedChartResponse>> =>
    api.get<SavedChartResponse>(`/api/v1/saved-charts/${id}`),

  create: (
    body: CreateSavedChartRequest,
  ): Promise<ApiResult<SavedChartResponse>> =>
    api.post<SavedChartResponse>("/api/v1/saved-charts", body),

  update: (
    id: string,
    body: UpdateSavedChartRequest,
  ): Promise<ApiResult<SavedChartResponse>> =>
    api.put<SavedChartResponse>(`/api/v1/saved-charts/${id}`, body),

  remove: (id: string): Promise<ApiResult<void>> =>
    api.delete(`/api/v1/saved-charts/${id}`),

  publish: (
    id: string,
  ): Promise<ApiResult<{ id: string; published: boolean }>> =>
    api.post<{ id: string; published: boolean }>(
      `/api/v1/saved-charts/${id}/publish`,
      {},
    ),

  unpublish: (
    id: string,
  ): Promise<ApiResult<{ id: string; published: boolean }>> =>
    api.post<{ id: string; published: boolean }>(
      `/api/v1/saved-charts/${id}/unpublish`,
      {},
    ),

  listVersions: (
    id: string,
    opts?: { includeDeleted?: boolean },
  ): Promise<ApiResult<VersionSummary[]>> =>
    api.get<VersionSummary[]>(
      `/api/v1/saved-charts/${id}/versions${opts?.includeDeleted ? "?include_deleted=true" : ""}`,
    ),

  getVersionContent: (
    id: string,
    versionNumber: number,
  ): Promise<ApiResult<ChartVersionContent>> =>
    api.get<ChartVersionContent>(
      `/api/v1/saved-charts/${id}/versions/${versionNumber}`,
    ),

  restoreVersion: (
    id: string,
    versionNumber: number,
  ): Promise<ApiResult<{ version_number: number }>> =>
    api.post<{ version_number: number }>(
      `/api/v1/saved-charts/${id}/versions/${versionNumber}/restore`,
      {},
    ),

  softDeleteVersion: (
    id: string,
    versionNumber: number,
  ): Promise<ApiResult<{ deleted: boolean }>> =>
    api.delete<{ deleted: boolean }>(
      `/api/v1/saved-charts/${id}/versions/${versionNumber}`,
    ),

  recoverVersion: (
    id: string,
    versionNumber: number,
  ): Promise<ApiResult<{ recovered: boolean }>> =>
    api.post<{ recovered: boolean }>(
      `/api/v1/saved-charts/${id}/versions/${versionNumber}/recover`,
      {},
    ),

  permanentDeleteVersion: (
    id: string,
    versionNumber: number,
  ): Promise<ApiResult<{ permanently_deleted: boolean }>> =>
    api.delete<{ permanently_deleted: boolean }>(
      `/api/v1/saved-charts/${id}/versions/${versionNumber}/permanent`,
    ),

  updateVersionLabel: (
    id: string,
    versionNumber: number,
    label: string | null,
  ): Promise<ApiResult<{ version_number: number; label: string | null }>> =>
    api.patch<{ version_number: number; label: string | null }>(
      `/api/v1/saved-charts/${id}/versions/${versionNumber}`,
      { label },
    ),
};
