import { Activity, ArrowRight, Monitor, MonitorCheck, Server, UsersRound } from "lucide-react";

import type { AdminScreen } from "./AdminShell";
import type { DashboardResponse, HealthResponse } from "../../../shared/dashboardContracts";
import { useTranslation } from "../i18n";

interface AdminDashboardProps {
  dashboard: DashboardResponse | null;
  health: HealthResponse | null;
  onNavigate: (screen: AdminScreen) => void;
}

export function AdminDashboard({ dashboard, health, onNavigate }: AdminDashboardProps) {
  const { t } = useTranslation();
  const clients = dashboard?.clients ?? [];
  const groups = dashboard?.groups ?? [];
  const onlineCount = clients.filter((client) => client.status === "online").length;
  const needsAttentionCount = clients.filter((client) => client.status !== "online").length;

  return (
    <section className="content dashboard-layout">
      <div className="dashboard-metrics">
        <DashboardMetric
          icon={Monitor}
          label={t.dashboard.screensTotal}
          onClick={() => onNavigate("screens")}
          value={clients.length}
        />
        <DashboardMetric
          icon={MonitorCheck}
          label={t.dashboard.screensOnline}
          onClick={() => onNavigate("screens")}
          tone="positive"
          value={onlineCount}
        />
        <DashboardMetric
          icon={Activity}
          label={t.dashboard.needsAttention}
          onClick={() => onNavigate("screens")}
          tone={needsAttentionCount ? "warning" : "neutral"}
          value={needsAttentionCount}
        />
        <DashboardMetric
          icon={UsersRound}
          label={t.dashboard.groupsTitle}
          onClick={() => onNavigate("groups")}
          value={groups.length}
        />
      </div>

      <article className="panel dashboard-status-panel">
        <div className="panel-heading">
          <span className="panel-heading-icon">
            <Server aria-hidden="true" size={18} />
          </span>
          <h2>{t.dashboard.serverTitle}</h2>
        </div>
        <dl className="settings-details">
          <div>
            <dt>{t.dashboard.service}</dt>
            <dd>{health?.service ?? t.dashboard.notConnected}</dd>
          </div>
          <div>
            <dt>{t.dashboard.database}</dt>
            <dd>{health?.database.status ?? t.dashboard.unknown}</dd>
          </div>
          {health?.database.missingTables.length ? (
            <div>
              <dt>{t.dashboard.missingTables}</dt>
              <dd className="status-text-error">{health.database.missingTables.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </article>

      <article className="panel dashboard-screens-panel">
        <div className="panel-header">
          <h2>{t.dashboard.screensTitle}</h2>
          <button className="panel-link" onClick={() => onNavigate("screens")} type="button">
            {t.dashboard.viewScreens}
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        </div>
        {clients.length ? (
          <ul className="summary-list operational-list">
            {clients.slice(0, 8).map((client) => (
              <li key={client.id}>
                <span>{client.name}</span>
                <small className={`connection-text ${client.status}`}>
                  {t.dashboard[client.status]}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="metric">{t.dashboard.noScreens}</p>
        )}
      </article>

      <article className="panel dashboard-groups-panel">
        <div className="panel-header">
          <h2>{t.dashboard.groupsTitle}</h2>
          <button className="panel-link" onClick={() => onNavigate("groups")} type="button">
            {t.dashboard.viewGroups}
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        </div>
        {groups.length ? (
          <ul className="summary-list operational-list">
            {groups.slice(0, 8).map((group) => (
              <li key={group.id}>
                <span>{group.name}</span>
                <small>
                  {group.clientCount} {t.dashboard.screenCount}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="metric">{t.dashboard.noGroups}</p>
        )}
      </article>
    </section>
  );
}

interface DashboardMetricProps {
  icon: typeof Monitor;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "positive" | "warning";
  value: number;
}

function DashboardMetric({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
  value,
}: DashboardMetricProps) {
  return (
    <button className={`dashboard-metric ${tone}`} onClick={onClick} type="button">
      <span className="dashboard-metric-icon">
        <Icon aria-hidden="true" size={19} />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </button>
  );
}
