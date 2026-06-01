export interface DashboardClientSummary {
  currentManifestId: string | null;
  id: string;
  lastSeenAt: string | null;
  name: string;
  status: "online" | "offline" | "unknown";
}

export interface DashboardGroupSummary {
  clientCount: number;
  id: string;
  name: string;
}

export interface DashboardResponse {
  clients: DashboardClientSummary[];
  groups: DashboardGroupSummary[];
}

export interface DatabaseHealthResponse {
  error?: string;
  expectedTables: readonly string[];
  missingTables: string[];
  status: "ok" | "schema_incomplete" | "unavailable";
}

export interface HealthResponse {
  database: DatabaseHealthResponse;
  service: string;
  supportedManifestItemTypes: string[];
}
