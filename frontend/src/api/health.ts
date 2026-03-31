import { api as apiClient } from "./client";

export type ServiceStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface ServiceHealth {
  name: string;
  port: number;
  status: ServiceStatus;
  message?: string;
}

const KNOWN_SERVICES: Omit<ServiceHealth, "status">[] = [
  { name: "api-gateway", port: 3000 },
  { name: "data-broker", port: 3001 },
  { name: "opc-service", port: 3002 },
  { name: "archive-service", port: 3005 },
  { name: "auth-service", port: 3009 },
];

function unknownServices(): ServiceHealth[] {
  return KNOWN_SERVICES.map((s) => ({
    ...s,
    status: "unknown" as ServiceStatus,
  }));
}

interface RawServiceHealth {
  name?: string;
  port?: number;
  status?: string;
  message?: string;
}

function normaliseStatus(raw: string | undefined): ServiceStatus {
  if (raw === "healthy" || raw === "degraded" || raw === "unhealthy")
    return raw;
  return "unknown";
}

export async function fetchServiceHealth(): Promise<ServiceHealth[]> {
  const result = await apiClient.get<RawServiceHealth[]>(
    "/api/health/services",
  );

  if (!result.success) {
    // Backend not available yet — return unknown for all known services
    return unknownServices();
  }

  // Merge response with known service list so we always show all services
  const responseMap = new Map<string, RawServiceHealth>();
  for (const svc of result.data) {
    if (svc.name) responseMap.set(svc.name, svc);
  }

  return KNOWN_SERVICES.map((known) => {
    const found = responseMap.get(known.name);
    return {
      name: known.name,
      port: known.port,
      status: normaliseStatus(found?.status),
      message: found?.message,
    };
  });
}
