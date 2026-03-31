import { api } from "./client";
import type { ApiResult } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AboutInfo {
  version: string;
  build: string;
  serverHostname: string;
  eulaVersion: string;
}

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  copyright: string;
  text: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const systemApi = {
  about(): Promise<ApiResult<AboutInfo>> {
    return api.get<AboutInfo>("/api/system/about");
  },

  licensesBackend(): Promise<ApiResult<LicenseEntry[]>> {
    return api.get<LicenseEntry[]>("/api/system/licenses/backend");
  },

  licensesFrontend(): Promise<ApiResult<LicenseEntry[]>> {
    return api.get<LicenseEntry[]>("/api/system/licenses/frontend");
  },

  /**
   * Downloads the CycloneDX SBOM JSON. Returns the raw Response so the caller
   * can trigger a blob download.  Uses the stored JWT for authorization.
   */
  downloadSbom(): Promise<Response> {
    const token = localStorage.getItem("io_access_token") ?? "";
    return fetch("/api/system/sbom", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
