import { api, type ApiResult } from "./client";

export interface SmsProvider {
  id: string;
  name: string;
  provider_type: "twilio" | "webhook";
  enabled: boolean;
  is_default: boolean;
  config: {
    account_sid?: string;
    auth_token?: string; // masked as "***" by server
    from_number?: string;
    url?: string;
    headers?: Record<string, string>;
  };
  last_tested_at: string | null;
  last_test_ok: boolean | null;
}

export interface CreateSmsProviderRequest {
  name: string;
  provider_type: "twilio" | "webhook";
  enabled: boolean;
  is_default: boolean;
  config: SmsProvider["config"];
}

export interface UpdateSmsProviderRequest {
  name?: string;
  provider_type?: string;
  enabled?: boolean;
  is_default?: boolean;
  config?: SmsProvider["config"];
}

export const smsProvidersApi = {
  list: (): Promise<ApiResult<SmsProvider[]>> =>
    api.get<SmsProvider[]>("/api/auth/sms-providers"),

  create: (body: CreateSmsProviderRequest): Promise<ApiResult<SmsProvider>> =>
    api.post<SmsProvider>("/api/auth/sms-providers", body),

  update: (
    id: string,
    body: UpdateSmsProviderRequest,
  ): Promise<ApiResult<SmsProvider>> =>
    api.put<SmsProvider>(`/api/auth/sms-providers/${id}`, body),

  test: (
    id: string,
    toNumber: string,
  ): Promise<ApiResult<{ tested: boolean; ok: boolean; error?: string }>> =>
    api.post<{ tested: boolean; ok: boolean; error?: string }>(
      `/api/auth/sms-providers/${id}/test`,
      { to_number: toNumber },
    ),

  delete: (id: string): Promise<ApiResult<{ deleted: boolean }>> =>
    api.delete<{ deleted: boolean }>(`/api/auth/sms-providers/${id}`),
};
