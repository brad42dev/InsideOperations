import { api } from "./client";

export interface Setting {
  key: string;
  value: unknown;
  description: string | null;
  is_public: boolean;
  requires_restart: boolean;
  updated_at: string;
}

export const settingsApi = {
  list: () => api.get<Setting[]>("/api/settings"),

  update: (key: string, value: unknown) =>
    api.put<Setting>(`/api/settings/${key}`, { value }),
};
