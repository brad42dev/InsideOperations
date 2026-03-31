import { api, type ApiResult } from "./client";

export interface Bookmark {
  id: string;
  entity_type: string;
  entity_id: string;
  name: string;
  created_at: string;
}

export const bookmarksApi = {
  list: (): Promise<ApiResult<Bookmark[]>> =>
    api.get<Bookmark[]>("/api/bookmarks"),

  add: (b: {
    entity_type: string;
    entity_id: string;
    name: string;
  }): Promise<ApiResult<Bookmark>> => api.post<Bookmark>("/api/bookmarks", b),

  remove: (id: string): Promise<ApiResult<void>> =>
    api.delete<void>(`/api/bookmarks/${id}`),
};
