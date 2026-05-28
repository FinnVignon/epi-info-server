import { useEffect, useState } from "react";

import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../shared/contracts";
import "./App.css";

interface HealthResponse {
  database: {
    missingTables: string[];
    status: string;
  };
  service: string;
  supportedManifestItemTypes: string[];
}

interface DashboardResponse {
  clients: Array<{
    currentManifestId: string | null;
    id: string;
    lastSeenAt: string | null;
    name: string;
    status: "online" | "offline" | "unknown";
  }>;
  groups: Array<{
    clientCount: number;
    id: string;
    name: string;
  }>;
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const [healthResponse, dashboardResponse] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/dashboard"),
        ]);
        const healthBody = (await healthResponse.json()) as HealthResponse;
        const dashboardBody = dashboardResponse.ok
          ? ((await dashboardResponse.json()) as DashboardResponse)
          : null;

        if (!cancelled) {
          setDashboard(dashboardBody);
          setHealth(healthBody);
          setStatus("ok");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Epi Info Admin</h1>
          <span>Controller server</span>
        </div>
        <span className={`status-pill ${status}`}>API {status}</span>
      </header>

      <section className="content">
        <article className="panel">
          <h2>Server</h2>
          <p className="metric">Service: {health?.service ?? "not connected"}</p>
          <p className="metric">Database: {health?.database.status ?? "unknown"}</p>
          {health?.database.missingTables.length ? (
            <p className="metric">Missing tables: {health.database.missingTables.join(", ")}</p>
          ) : null}
        </article>

        <article className="panel">
          <h2>Display Types</h2>
          <div className="content-types">
            {(health?.supportedManifestItemTypes ?? SUPPORTED_MANIFEST_ITEM_TYPES).map((type) => (
              <span className="content-type" key={type}>
                {type}
              </span>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Clients And Groups</h2>
          <div className="summary-grid">
            <section>
              <h3>Clients</h3>
              {dashboard?.clients.length ? (
                <ul className="summary-list">
                  {dashboard.clients.map((client) => (
                    <li key={client.id}>
                      <span>{client.name}</span>
                      <small>{client.status}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="metric">No clients registered yet.</p>
              )}
            </section>

            <section>
              <h3>Groups</h3>
              {dashboard?.groups.length ? (
                <ul className="summary-list">
                  {dashboard.groups.map((group) => (
                    <li key={group.id}>
                      <span>{group.name}</span>
                      <small>{group.clientCount} clients</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="metric">No groups created yet.</p>
              )}
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}
