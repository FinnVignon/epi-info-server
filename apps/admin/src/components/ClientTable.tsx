import { useMemo, useState } from "react";

import { formatDate } from "../utils/formatDate";
import type {
  ClientAccessStatus,
  ClientConnectionStatus,
  ManagedClient,
} from "../../../shared/clientContracts";

type SortDirection = "asc" | "desc";
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
        <h2>Clients</h2>
        <button className="secondary-button" onClick={onRefresh} type="button">
          Refresh
        </button>
      </div>

      <div className="table-controls">
        <label>
          <span>Search</span>
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name, ID, or software"
            value={searchQuery}
          />
        </label>
        <label>
          <span>Connection</span>
          <select
            onChange={(event) => setConnectionFilter(event.target.value as ConnectionFilter)}
            value={connectionFilter}
          >
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          <span>Access</span>
          <select
            onChange={(event) => setAccessFilter(event.target.value as AccessFilter)}
            value={accessFilter}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="metric">Loading clients...</p>
      ) : clients.length ? (
        <div className="table-wrap">
          <table className="data-table clients-table">
            <thead>
              <tr>
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Name"
                  onSort={handleSort}
                  sortKey="name"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Connection"
                  onSort={handleSort}
                  sortKey="connection"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Access"
                  onSort={handleSort}
                  sortKey="access"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Software"
                  onSort={handleSort}
                  sortKey="software"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Last seen"
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
                      <small>{shortClientId(client.id)}</small>
                    </button>
                  </td>
                  <td>
                    <span className={`status-pill ${client.connectionStatus}`}>
                      {client.connectionStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${client.accessStatus}`}>
                      {client.accessStatus}
                    </span>
                  </td>
                  <td>{client.softwareVersion ?? "Unknown"}</td>
                  <td>{formatDate(client.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleClients.length ? (
            <p className="metric table-empty">No matching clients.</p>
          ) : null}
        </div>
      ) : (
        <p className="metric">No clients registered yet.</p>
      )}
    </article>
  );
}

interface SortableHeaderProps {
  activeSortKey: SortKey;
  direction: SortDirection;
  label: string;
  onSort: (sortKey: SortKey) => void;
  sortKey: SortKey;
}

function SortableHeader({ activeSortKey, direction, label, onSort, sortKey }: SortableHeaderProps) {
  const isActive = activeSortKey === sortKey;

  return (
    <th>
      <button
        className={`sort-button ${isActive ? "active" : ""}`}
        onClick={() => onSort(sortKey)}
        type="button"
      >
        <span>{label}</span>
        <small>{isActive ? (direction === "asc" ? "up" : "down") : ""}</small>
      </button>
    </th>
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

function shortClientId(clientId: string): string {
  return clientId.length > 16 ? `${clientId.slice(0, 8)}...${clientId.slice(-4)}` : clientId;
}
