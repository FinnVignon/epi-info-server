import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../../shared/contracts";
import type { DashboardResponse, HealthResponse } from "../../../shared/dashboardContracts";

interface AdminDashboardProps {
  dashboard: DashboardResponse | null;
  health: HealthResponse | null;
}

export function AdminDashboard({ dashboard, health }: AdminDashboardProps) {
  return (
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
  );
}
