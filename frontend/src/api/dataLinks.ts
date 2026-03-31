import { api } from "./client";
import type { ApiResult } from "./client";

// ---------------------------------------------------------------------------
// Data Links API
// ---------------------------------------------------------------------------

export interface LinkTransform {
  op:
    | "uppercase"
    | "lowercase"
    | "trim"
    | "remove_dashes"
    | "remove_spaces"
    | "remove_underscores"
    | "leading_zeros"
    | "strip_prefix"
    | "strip_suffix"
    | "replace"
    | "regex_extract"
    | "substring";
  params?: Record<string, string>;
}

export interface DataLink {
  id: string;
  source_dataset_id: string;
  source_column: string;
  target_dataset_id: string;
  target_column: string;
  match_type: "exact" | "case_insensitive" | "transformed";
  bidirectional: boolean;
  enabled: boolean;
  source_transforms: LinkTransform[];
  target_transforms: LinkTransform[];
  /** Populated by validation on save */
  valid?: boolean;
  validation_reason?: string;
}

export const dataLinksApi = {
  list: (): Promise<ApiResult<DataLink[]>> =>
    api.get<DataLink[]>("/api/v1/data-links"),

  create: (
    body: Omit<DataLink, "id" | "valid" | "validation_reason">,
  ): Promise<ApiResult<DataLink>> =>
    api.post<DataLink>("/api/v1/data-links", body),

  update: (
    id: string,
    body: Partial<Omit<DataLink, "id">>,
  ): Promise<ApiResult<DataLink>> =>
    api.put<DataLink>(`/api/v1/data-links/${id}`, body),

  delete: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/v1/data-links/${id}`),
};
