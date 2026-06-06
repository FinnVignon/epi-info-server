export type ClientAccessStatus = "active" | "disabled";
export type ClientConnectionStatus = "online" | "offline" | "unknown";

export interface ClientEnrollmentToken {
  expiresAt: string;
  token: string;
}

export interface CreateClientEnrollmentTokenResponse {
  enrollmentToken: ClientEnrollmentToken;
}

export interface RegisterClientRequest {
  enrollmentToken: string;
  name: string;
  softwareVersion?: string;
}

export interface RegisterClientResponse {
  clientId: string;
  clientSecret: string;
  heartbeatIntervalSeconds: number;
}

export interface ClientHeartbeatRequest {
  currentManifestId?: string | null;
  currentManifestVersion?: number | null;
  lastError?: string | null;
  lastSyncResult?: string | null;
  softwareVersion?: string;
}

export interface ClientHeartbeatResponse {
  heartbeatIntervalSeconds: number;
  serverTime: string;
}
