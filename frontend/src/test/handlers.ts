import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("/api/auth/login", () =>
    HttpResponse.json({
      success: true,
      data: {
        access_token: "test-token",
        token_type: "Bearer",
        expires_in: 900,
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          username: "testuser",
          email: "test@example.com",
          full_name: "Test User",
        },
      },
    }),
  ),
  http.post("/api/auth/logout", () =>
    HttpResponse.json({ success: true, data: { message: "ok" } }),
  ),
  http.get("/api/auth/me", () =>
    HttpResponse.json({
      success: true,
      data: {
        id: "00000000-0000-0000-0000-000000000001",
        username: "testuser",
        email: "test@example.com",
        full_name: "Test User",
      },
    }),
  ),
  http.get("/api/alarms/active", () =>
    HttpResponse.json({ success: true, data: [] }),
  ),
  http.get("/api/dashboards", () =>
    HttpResponse.json({ success: true, data: [] }),
  ),
  http.get("/api/rounds/instances", () =>
    HttpResponse.json({ success: true, data: [] }),
  ),
];
