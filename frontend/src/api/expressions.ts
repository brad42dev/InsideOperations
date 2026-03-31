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
};
