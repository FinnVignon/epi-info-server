import { Activity, ArrowRight, Monitor, MonitorCheck, MonitorPlay, UsersRound } from "lucide-react";

import type { AdminScreen } from "./AdminShell";
import type { AdminAccess } from "../../../shared/adminContracts";
import type { DashboardResponse } from "../../../shared/dashboardContracts";
import { useTranslation } from "../i18n";

interface AdminDashboardProps {
  access: AdminAccess;
  dashboard: DashboardResponse | null;
  onNavigate: (screen: AdminScreen) => void;
}

export function AdminDashboard({ access, dashboard, onNavigate }: AdminDashboardProps) {
  const { t } = useTranslation();
  const clients = dashboard?.clients ?? [];
  const groups = dashboard?.groups ?? [];
  const onlineCount = clients.filter((client) => client.status === "online").length;
  const needsAttentionCount = clients.filter((client) => client.status !== "online").length;
  const canDisplay =
    access.canAssignAllScreens || access.canAssignGroups || access.canAssignScreens;

  return (
    <section className="content dashboard-layout">
      {canDisplay ? (
        <button
          className="dashboard-primary-action"
          onClick={() => onNavigate("display")}
          type="button"
        >
          <span className="dashboard-primary-icon">
            <MonitorPlay aria-hidden="true" size={22} />
          </span>
          <span>
            <strong>{t.dashboard.displayContent}</strong>
            <small>{t.dashboard.displayTargets}</small>
          </span>
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      ) : null}

      <div className="dashboard-metrics">
        <DashboardMetric icon={Monitor} label={t.dashboard.screensTotal} value={clients.length} />
        <DashboardMetric
          icon={MonitorCheck}
          label={t.dashboard.screensOnline}
          tone="positive"
          value={onlineCount}
        />
        <DashboardMetric
          icon={Activity}
          label={t.dashboard.needsAttention}
          tone={needsAttentionCount ? "warning" : "neutral"}
          value={needsAttentionCount}
        />
        <DashboardMetric icon={UsersRound} label={t.dashboard.groupsTitle} value={groups.length} />
      </div>

      <article className="panel dashboard-screens-panel">
        <h2>{t.dashboard.screensTitle}</h2>
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
        <h2>{t.dashboard.groupsTitle}</h2>
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
  tone?: "neutral" | "positive" | "warning";
  value: number;
}

function DashboardMetric({ icon: Icon, label, tone = "neutral", value }: DashboardMetricProps) {
  return (
    <article className={`dashboard-metric ${tone}`}>
      <span className="dashboard-metric-icon">
        <Icon aria-hidden="true" size={19} />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </article>
  );
}
