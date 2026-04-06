import { api, type ApiResult, type PaginatedResult } from "./client";
import type {
  ExpressionAst,
  ExpressionContext,
} from "../shared/types/expression";

// ---------------------------------------------------------------------------
// Saved expression types
// ---------------------------------------------------------------------------

export interface SavedExpression {
  id: string;
  name: string;
  description: string | null;
  context: ExpressionContext;
  ast: ExpressionAst;
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateExpressionBody {
  name: string;
  description?: string;
  context: ExpressionContext;
  ast: ExpressionAst;
  is_shared?: boolean;
}

export interface UpdateExpressionBody {
  name?: string;
  description?: string;
  ast?: ExpressionAst;
  is_shared?: boolean;
}

export interface EvaluateInlineBody {
  /** ExprNode root object (the `root` field of ExpressionAst). */
  ast: Record<string, unknown>;
  /** Point values to substitute, keyed by point_id or "current_point". */
  values: Record<string, number>;
}

export interface EvaluateByIdBody {
  /** Point values to substitute, keyed by point_id or "current_point". */
  values: Record<string, number>;
}

export interface EvaluateResult {
  result: number;
}

export interface EvaluateBatchBody {
  /** Unix millisecond timestamps — one per sample. */
  timestamps: number[];
  /** Point values keyed by point UUID. Each array must be the same length as timestamps. */
  point_values: Record<string, number[]>;
}

export interface EvaluateBatchResult {
  /** Evaluated result for each sample. null where evaluation failed. */
  results: (number | null)[];
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const expressionsApi = {
  list: (): Promise<ApiResult<PaginatedResult<SavedExpression>>> =>
    api.get<PaginatedResult<SavedExpression>>("/api/expressions"),

  get: (id: string): Promise<ApiResult<SavedExpression>> =>
    api.get<SavedExpression>(`/api/expressions/${id}`),

  create: (body: CreateExpressionBody): Promise<ApiResult<SavedExpression>> =>
    api.post<SavedExpression>("/api/expressions", body),

  update: (
    id: string,
    body: UpdateExpressionBody,
  ): Promise<ApiResult<SavedExpression>> =>
    api.put<SavedExpression>(`/api/expressions/${id}`, body),

  delete: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/expressions/${id}`),

  /** List expressions filtered by context slug (e.g. "point_config"). */
  listByContext: (ctx: string): Promise<ApiResult<SavedExpression[]>> =>
    api.get<SavedExpression[]>(
      `/api/expressions/by-context/${encodeURIComponent(ctx)}`,
    ),

  /** List expressions that reference a specific point UUID. */
  listByPoint: (pointId: string): Promise<ApiResult<SavedExpression[]>> =>
    api.get<SavedExpression[]>(`/api/expressions/by-point/${pointId}`),

  /** Evaluate an ad-hoc expression AST with caller-supplied point values. */
  evaluateInline: (
    body: EvaluateInlineBody,
  ): Promise<ApiResult<EvaluateResult>> =>
    api.post<EvaluateResult>("/api/expressions/evaluate", body),

  /** Evaluate a saved expression by ID with caller-supplied point values. */
  evaluate: (
    id: string,
    body: EvaluateByIdBody,
  ): Promise<ApiResult<EvaluateResult>> =>
    api.post<EvaluateResult>(`/api/expressions/${id}/evaluate`, body),

  /** Evaluate a saved expression over a historical time series (batch). */
  evaluateBatch: (
    id: string,
    body: EvaluateBatchBody,
  ): Promise<ApiResult<EvaluateBatchResult>> =>
    api.post<EvaluateBatchResult>(
      `/api/expressions/${id}/evaluate-batch`,
      body,
    ),
};
