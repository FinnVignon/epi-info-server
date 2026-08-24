import type { Manifest } from "./contracts.js";

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
  capabilities: {
    canEnrollClients: boolean;
  };
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

export interface EffectiveManifestResponse {
  manifest: Manifest | null;
}

export interface ClientLiveServerHelloEvent {
  serverTime: string;
  service: "epi-info-server";
  type: "server.hello";
}

export interface ClientLiveAssignmentChangedEvent {
  clientId: string;
  sentAt: string;
  type: "assignment.changed";
}

export type ClientLiveEvent = ClientLiveAssignmentChangedEvent | ClientLiveServerHelloEvent;
