import { api } from "./client";

export interface WsTicket {
  ticket: string;
}

export const wsTicketApi = {
  create: () => api.post<WsTicket>("/api/auth/ws-ticket", {}),
};
