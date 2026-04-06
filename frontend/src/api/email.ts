import { api, queryString, type ApiResult } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailProvider {
  id: string;
  name: string;
  provider_type: "smtp" | "webhook" | string;
  config: Record<string, unknown>;
  is_default: boolean;
  is_fallback: boolean;
  enabled: boolean;
  from_address: string;
  from_name?: string;
  last_tested_at?: string;
  last_test_ok?: boolean;
  last_test_error?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderRequest {
  name: string;
  provider_type: string;
  config: Record<string, unknown>;
  is_default?: boolean;
  is_fallback?: boolean;
  enabled?: boolean;
  from_address: string;
  from_name?: string;
}

export interface UpdateProviderRequest {
  name?: string;
  provider_type?: string;
  config?: Record<string, unknown>;
  is_default?: boolean;
  is_fallback?: boolean;
  enabled?: boolean;
  from_address?: string;
  from_name?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject_template: string;
  body_html: string;
  body_text?: string;
  variables_schema?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateRequest {
  name: string;
  category?: string;
  subject_template: string;
  body_html: string;
  body_text?: string;
  variables_schema?: Record<string, unknown>;
}

export interface UpdateTemplateRequest {
  name?: string;
  category?: string;
  subject_template?: string;
  body_html?: string;
  body_text?: string;
  variables_schema?: Record<string, unknown>;
}

export interface TemplateRenderResult {
  subject: string;
  body_html: string;
  body_text?: string;
}

export interface EmailQueueItem {
  id: string;
  provider_id?: string;
  template_id?: string;
  to_addresses: string[];
  subject: string;
  body_html: string;
  body_text?: string;
  priority: number;
  status: "pending" | "retry" | "sent" | "failed" | string;
  attempts: number;
  max_attempts: number;
  next_attempt: string;
  last_error?: string;
  context_type?: string;
  context_id?: string;
  created_at: string;
  sent_at?: string;
}

export interface EnqueueRequest {
  provider_id?: string;
  template_id?: string;
  to_addresses: string[];
  subject?: string;
  body_html?: string;
  body_text?: string;
  priority?: number;
  context_type?: string;
  context_id?: string;
  variables?: Record<string, unknown>;
}

export interface DeliveryLogEntry {
  id: string;
  queue_id: string;
  provider_id: string;
  attempt_number: number;
  status: string;
  provider_message_id?: string;
  provider_response?: string;
  error_details?: string;
  sent_at: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const emailApi = {
  // Providers
  listProviders: (): Promise<ApiResult<EmailProvider[]>> =>
    api.get<EmailProvider[]>("/api/email/providers"),

  createProvider: (
    data: CreateProviderRequest,
  ): Promise<ApiResult<EmailProvider>> =>
    api.post<EmailProvider>("/api/email/providers", data),

  updateProvider: (
    id: string,
    data: UpdateProviderRequest,
  ): Promise<ApiResult<EmailProvider>> =>
    api.put<EmailProvider>(`/api/email/providers/${id}`, data),

  deleteProvider: (id: string): Promise<ApiResult<{ deleted: boolean }>> =>
    api.delete<{ deleted: boolean }>(`/api/email/providers/${id}`),

  testProvider: (
    id: string,
    toAddress: string,
  ): Promise<ApiResult<{ tested: boolean; ok: boolean }>> =>
    api.post<{ tested: boolean; ok: boolean }>(
      `/api/email/providers/${id}/test`,
      { to_address: toAddress },
    ),

  // Templates
  listTemplates: (): Promise<ApiResult<EmailTemplate[]>> =>
    api.get<EmailTemplate[]>("/api/email/templates"),

  createTemplate: (
    data: CreateTemplateRequest,
  ): Promise<ApiResult<EmailTemplate>> =>
    api.post<EmailTemplate>("/api/email/templates", data),

  updateTemplate: (
    id: string,
    data: UpdateTemplateRequest,
  ): Promise<ApiResult<EmailTemplate>> =>
    api.put<EmailTemplate>(`/api/email/templates/${id}`, data),

  deleteTemplate: (id: string): Promise<ApiResult<{ deleted: boolean }>> =>
    api.delete<{ deleted: boolean }>(`/api/email/templates/${id}`),

  renderTemplate: (
    id: string,
    variables?: Record<string, unknown>,
  ): Promise<ApiResult<TemplateRenderResult>> =>
    api.post<TemplateRenderResult>(`/api/email/templates/${id}/render`, {
      variables,
    }),

  // Queue
  enqueue: (data: EnqueueRequest): Promise<ApiResult<EmailQueueItem>> =>
    api.post<EmailQueueItem>("/api/email/queue", data),

  listQueue: (params?: {
    status?: string;
    limit?: number;
  }): Promise<ApiResult<EmailQueueItem[]>> =>
    api.get<EmailQueueItem[]>(`/api/email/queue${queryString(params)}`),

  // Delivery log
  listDeliveryLog: (params?: {
    queue_id?: string;
    limit?: number;
  }): Promise<ApiResult<DeliveryLogEntry[]>> =>
    api.get<DeliveryLogEntry[]>(
      `/api/email/delivery-log${queryString(params)}`,
    ),
};
