import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../../shared/contracts";
import type { DashboardResponse, HealthResponse } from "../../../shared/dashboardContracts";
import { useTranslation } from "../i18n";

interface AdminDashboardProps {
  dashboard: DashboardResponse | null;
  health: HealthResponse | null;
}

export function AdminDashboard({ dashboard, health }: AdminDashboardProps) {
  const { t } = useTranslation();

  return (
    <section className="content">
      <article className="panel">
        <h2>{t.dashboard.serverTitle}</h2>
        <p className="metric">
          {t.dashboard.service} : {health?.service ?? t.dashboard.notConnected}
        </p>
        <p className="metric">
          {t.dashboard.database} : {health?.database.status ?? t.dashboard.unknown}
        </p>
        {health?.database.missingTables.length ? (
          <p className="metric">
            {t.dashboard.missingTables} : {health.database.missingTables.join(", ")}
          </p>
        ) : null}
      </article>

      <article className="panel">
        <h2>{t.dashboard.displayTypesTitle}</h2>
        <div className="content-types">
          {(health?.supportedManifestItemTypes ?? SUPPORTED_MANIFEST_ITEM_TYPES).map((type) => (
            <span className="content-type" key={type}>
              {type}
            </span>
          ))}
        </div>
      </article>

      <article className="panel">
        <h2>{t.dashboard.clientsGroupsTitle}</h2>
        <div className="summary-grid">
          <section>
            <h3>{t.dashboard.clientsTitle}</h3>
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
              <p className="metric">{t.dashboard.noClients}</p>
            )}
          </section>

          <section>
            <h3>{t.dashboard.groupsTitle}</h3>
            {dashboard?.groups.length ? (
              <ul className="summary-list">
                {dashboard.groups.map((group) => (
                  <li key={group.id}>
                    <span>{group.name}</span>
                    <small>
                      {group.clientCount} {t.dashboard.clientCount}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="metric">{t.dashboard.noGroups}</p>
            )}
          </section>
        </div>
      </article>
    </section>
  );
}
