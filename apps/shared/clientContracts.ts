export type ClientAccessStatus = "active" | "disabled";
export type ClientConnectionStatus = "online" | "offline" | "unknown";

export interface ManagedClient {
  accessStatus: ClientAccessStatus;
  connectionStatus: ClientConnectionStatus;
  createdAt: string;
  currentManifestId: string | null;
  currentManifestVersion: number | null;
  id: string;
  lastError: string | null;
  lastSeenAt: string | null;
  lastSyncResult: string | null;
  name: string;
  softwareVersion: string | null;
  updatedAt: string;
}

export interface ClientListResponse {
  clients: ManagedClient[];
}

export interface ClientResponse {
  client: ManagedClient;
}

export interface UpdateClientProfileRequest {
  name: string;
}

export interface UpdateClientStatusRequest {
  accessStatus: ClientAccessStatus;
}

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
