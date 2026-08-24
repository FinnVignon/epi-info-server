import { Monitor } from "lucide-react";
import { useMemo, useState } from "react";

import { RefreshButton } from "./RefreshButton";
import { SortableTableHeader, type SortDirection } from "./SortableTableHeader";
import { useTranslation, type Translations } from "../i18n";
import { formatDate } from "../utils/formatDate";
import type {
  ClientAccessStatus,
  ClientConnectionStatus,
  ManagedClient,
} from "../../../shared/clientContracts";

type SortKey = "access" | "connection" | "lastSeen" | "name" | "software";
type AccessFilter = "all" | ClientAccessStatus;
type ConnectionFilter = "all" | ClientConnectionStatus;

interface ClientTableProps {
  clients: ManagedClient[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectClient: (clientId: string) => void;
  selectedClientId: string | null;
}

export function ClientTable({
  clients,
  isLoading,
  onRefresh,
  onSelectClient,
  selectedClientId,
}: ClientTableProps) {
  const { t } = useTranslation();
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const visibleClients = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return clients
      .filter((client) => accessFilter === "all" || client.accessStatus === accessFilter)
      .filter(
        (client) => connectionFilter === "all" || client.connectionStatus === connectionFilter,
      )
      .filter(
        (client) =>
          !normalizedQuery ||
          client.name.toLowerCase().includes(normalizedQuery) ||
          client.id.toLowerCase().includes(normalizedQuery) ||
          client.softwareVersion?.toLowerCase().includes(normalizedQuery),
      )
      .sort((firstClient, secondClient) => {
        const comparison = compareClients(firstClient, secondClient, sortKey);

        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [accessFilter, clients, connectionFilter, searchQuery, sortDirection, sortKey]);

  function handleSort(nextSortKey: SortKey): void {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortDirection("asc");
    setSortKey(nextSortKey);
  }

  return (
    <article className="panel clients-list-panel">
      <div className="panel-header">
        <div className="panel-heading compact">
          <span className="panel-heading-icon">
            <Monitor aria-hidden="true" size={18} />
          </span>
          <div>
            <h2>{t.clients.title}</h2>
            <p className="metric">
              {t.clients.screenCount.replace("{count}", String(clients.length))}
            </p>
          </div>
        </div>
        <RefreshButton label={t.common.refresh} onClick={onRefresh} />
      </div>

      <div className="table-controls">
        <label>
          <span>{t.common.search}</span>
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t.clients.searchPlaceholder}
            value={searchQuery}
          />
        </label>
        <label>
          <span>{t.clients.connection}</span>
          <select
            onChange={(event) => setConnectionFilter(event.target.value as ConnectionFilter)}
            value={connectionFilter}
          >
            <option value="all">{t.common.all}</option>
            <option value="online">{t.clients.connectionOnline}</option>
            <option value="offline">{t.clients.connectionOffline}</option>
            <option value="unknown">{t.clients.connectionUnknown}</option>
          </select>
        </label>
        <label>
          <span>{t.clients.access}</span>
          <select
            onChange={(event) => setAccessFilter(event.target.value as AccessFilter)}
            value={accessFilter}
          >
            <option value="all">{t.common.all}</option>
            <option value="active">{t.common.active}</option>
            <option value="disabled">{t.common.disabled}</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="metric">{t.clients.loading}</p>
      ) : clients.length ? (
        <div className="table-wrap">
          <table className="data-table clients-table">
            <thead>
              <tr>
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.common.name}
                  onSort={handleSort}
                  sortKey="name"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.clients.connection}
                  onSort={handleSort}
                  sortKey="connection"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.clients.access}
                  onSort={handleSort}
                  sortKey="access"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.clients.software}
                  onSort={handleSort}
                  sortKey="software"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.clients.lastSeen}
                  onSort={handleSort}
                  sortKey="lastSeen"
                />
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((client) => (
                <tr
                  className={selectedClientId === client.id ? "selected" : ""}
                  key={client.id}
                  onClick={() => onSelectClient(client.id)}
                >
                  <td>
                    <button className="table-link" type="button">
                      <span>{client.name}</span>
                    </button>
                  </td>
                  <td>
                    <span className={`status-pill ${client.connectionStatus}`}>
                      {formatConnectionStatus(client.connectionStatus, t)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${client.accessStatus}`}>
                      {formatAccessStatus(client.accessStatus, t)}
                    </span>
                  </td>
                  <td>{client.softwareVersion ?? t.common.unknown}</td>
                  <td>{formatDate(client.lastSeenAt, t.common.never)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleClients.length ? (
            <p className="metric table-empty">{t.clients.noMatch}</p>
          ) : null}
        </div>
      ) : (
        <p className="metric">{t.clients.noClients}</p>
      )}
    </article>
  );
}

function compareClients(
  firstClient: ManagedClient,
  secondClient: ManagedClient,
  sortKey: SortKey,
): number {
  switch (sortKey) {
    case "access":
      return compareText(firstClient.accessStatus, secondClient.accessStatus);
    case "connection":
      return compareText(firstClient.connectionStatus, secondClient.connectionStatus);
    case "lastSeen":
      return compareNullableDates(firstClient.lastSeenAt, secondClient.lastSeenAt);
    case "name":
      return compareText(firstClient.name, secondClient.name);
    case "software":
      return compareText(firstClient.softwareVersion ?? "", secondClient.softwareVersion ?? "");
  }
}

function compareNullableDates(firstValue: string | null, secondValue: string | null): number {
  return (firstValue ? Date.parse(firstValue) : 0) - (secondValue ? Date.parse(secondValue) : 0);
}

function compareText(firstValue: string, secondValue: string): number {
  return firstValue.localeCompare(secondValue, undefined, {
    sensitivity: "base",
  });
}

function formatAccessStatus(status: ClientAccessStatus, t: Translations): string {
  return status === "active" ? t.common.active : t.common.disabled;
}

function formatConnectionStatus(status: ClientConnectionStatus, t: Translations): string {
  switch (status) {
    case "offline":
      return t.clients.connectionOffline;
    case "online":
      return t.clients.connectionOnline;
    case "unknown":
      return t.clients.connectionUnknown;
  }
}
