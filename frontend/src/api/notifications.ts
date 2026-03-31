import { api, queryString, type ApiResult } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationSeverity =
  | "emergency"
  | "critical"
  | "warning"
  | "info";
export type NotificationChannel =
  | "websocket"
  | "email"
  | "sms"
  | "pa"
  | "radio"
  | "push";
export type MusterStatus = "unaccounted" | "accounted" | "off_site";
export type GroupType =
  | "static"
  | "role_based"
  | "on_shift"
  | "on_site"
  | "all_users";

export interface TemplateVariable {
  name: string;
  label: string;
  default_value?: string;
  required: boolean;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  category: string;
  severity: NotificationSeverity;
  title_template: string;
  body_template: string;
  channels: NotificationChannel[];
  variables: TemplateVariable[];
  is_system: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface NotificationGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  display_name?: string;
  email?: string;
  added_at: string;
  added_by?: string;
}

export interface NotificationGroup {
  id: string;
  name: string;
  description?: string;
  group_type: GroupType;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  member_count?: number;
  members?: NotificationGroupMember[];
}

export interface NotificationMessage {
  id: string;
  template_id?: string;
  template_name?: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  channels: NotificationChannel[];
  group_id?: string;
  group_name?: string;
  recipient_count: number;
  sent_by: string;
  sent_by_name?: string;
  sent_at: string;
  variables_used?: Record<string, string>;
  status: "sent" | "partial" | "failed";
}

export interface MusterMark {
  id: string;
  message_id: string;
  user_id: string;
  display_name?: string;
  email?: string;
  status: MusterStatus;
  marked_by?: string;
  marked_at?: string;
  notes?: string;
}

export interface MusterStatusResult {
  marks: MusterMark[];
  summary: {
    total: number;
    accounted: number;
    off_site: number;
    unaccounted: number;
  };
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface SendNotificationPayload {
  template_id?: string;
  severity?: NotificationSeverity;
  title?: string;
  body?: string;
  channels?: NotificationChannel[];
  group_id?: string;
  recipient_user_ids?: string[];
  variables?: Record<string, string>;
}

export interface CreateTemplatePayload {
  name: string;
  category?: string;
  severity?: NotificationSeverity;
  title_template: string;
  body_template: string;
  channels?: NotificationChannel[];
  variables?: TemplateVariable[];
}

export interface UpdateTemplatePayload {
  name?: string;
  category?: string;
  severity?: NotificationSeverity;
  title_template?: string;
  body_template?: string;
  channels?: NotificationChannel[];
  variables?: TemplateVariable[];
  enabled?: boolean;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  group_type?: GroupType;
  config?: Record<string, unknown>;
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string;
  group_type?: GroupType;
  config?: Record<string, unknown>;
}

export interface MarkMusterPayload {
  user_id: string;
  status: MusterStatus;
  notes?: string;
}

export interface ListMessagesParams {
  page?: number;
  limit?: number;
  severity?: NotificationSeverity;
  sent_by?: string;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const notificationsApi = {
  // Messages
  listMessages(
    params?: ListMessagesParams,
  ): Promise<ApiResult<NotificationMessage[]>> {
    return api.get(
      `/api/notifications/messages${queryString(params as Record<string, unknown>)}`,
    );
  },

  sendNotification(
    payload: SendNotificationPayload,
  ): Promise<ApiResult<NotificationMessage>> {
    return api.post("/api/notifications/send", payload);
  },

  sendEmergency(
    payload: SendNotificationPayload,
  ): Promise<ApiResult<NotificationMessage>> {
    return api.post("/api/notifications/send-emergency", payload);
  },

  getMessage(id: string): Promise<ApiResult<NotificationMessage>> {
    return api.get(`/api/notifications/messages/${id}`);
  },

  // Templates
  listTemplates(params?: {
    enabled?: boolean;
  }): Promise<ApiResult<NotificationTemplate[]>> {
    return api.get(
      `/api/notifications/templates${queryString(params as Record<string, unknown>)}`,
    );
  },

  createTemplate(
    payload: CreateTemplatePayload,
  ): Promise<ApiResult<NotificationTemplate>> {
    return api.post("/api/notifications/templates", payload);
  },

  getTemplate(id: string): Promise<ApiResult<NotificationTemplate>> {
    return api.get(`/api/notifications/templates/${id}`);
  },

  updateTemplate(
    id: string,
    payload: UpdateTemplatePayload,
  ): Promise<ApiResult<NotificationTemplate>> {
    return api.put(`/api/notifications/templates/${id}`, payload);
  },

  deleteTemplate(id: string): Promise<ApiResult<void>> {
    return api.delete(`/api/notifications/templates/${id}`);
  },

  // Groups
  listGroups(): Promise<ApiResult<NotificationGroup[]>> {
    return api.get("/api/notifications/groups");
  },

  createGroup(
    payload: CreateGroupPayload,
  ): Promise<ApiResult<NotificationGroup>> {
    return api.post("/api/notifications/groups", payload);
  },

  getGroup(id: string): Promise<ApiResult<NotificationGroup>> {
    return api.get(`/api/notifications/groups/${id}`);
  },

  updateGroup(
    id: string,
    payload: UpdateGroupPayload,
  ): Promise<ApiResult<NotificationGroup>> {
    return api.put(`/api/notifications/groups/${id}`, payload);
  },

  deleteGroup(id: string): Promise<ApiResult<void>> {
    return api.delete(`/api/notifications/groups/${id}`);
  },

  addGroupMember(groupId: string, userId: string): Promise<ApiResult<void>> {
    return api.post(`/api/notifications/groups/${groupId}/members`, {
      user_id: userId,
    });
  },

  removeGroupMember(groupId: string, userId: string): Promise<ApiResult<void>> {
    return api.delete(`/api/notifications/groups/${groupId}/members/${userId}`);
  },

  // Muster
  getMusterStatus(messageId: string): Promise<ApiResult<MusterStatusResult>> {
    return api.get(`/api/notifications/muster/${messageId}`);
  },

  markMuster(
    messageId: string,
    payload: MarkMusterPayload,
  ): Promise<ApiResult<MusterMark>> {
    return api.post(`/api/notifications/muster/${messageId}/mark`, payload);
  },

  // Active (last 24h, high-severity)
  getActive(): Promise<ApiResult<NotificationMessage[]>> {
    return api.get("/api/notifications/active");
  },

  resolveMessage(id: string): Promise<ApiResult<void>> {
    return api.post(`/api/notifications/messages/${id}/resolve`, {});
  },

  cancelMessage(id: string): Promise<ApiResult<void>> {
    return api.post(`/api/notifications/messages/${id}/cancel`, {});
  },

  // Channel availability — driven by Alert Service config
  getEnabledChannels(): Promise<ApiResult<NotificationChannel[]>> {
    return api.get("/api/notifications/channels/enabled");
  },

  // Muster export — returns a URL string for use in an anchor tag
  exportMusterUnaccounted(messageId: string): string {
    return `/api/notifications/muster/${messageId}/export`;
  },
};
