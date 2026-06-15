import { useMemo, useState } from "react";

import type { AdminUserWithPermissions } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

type SortDirection = "asc" | "desc";
type SortKey = "displayName" | "permissions" | "status" | "superAdmin";

interface AdminUserTableProps {
  isLoading: boolean;
  onRefresh: () => void;
  onSelectUser: (userId: string) => void;
  selectedUserId: string | null;
  users: AdminUserWithPermissions[];
}

export function AdminUserTable({ isLoading, onRefresh, onSelectUser, selectedUserId, users }: AdminUserTableProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sortKey, setSortKey] = useState<SortKey>("displayName");

  const visibleUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredUsers = normalizedQuery
      ? users.filter(
          (user) =>
            user.displayName.toLowerCase().includes(normalizedQuery) ||
            user.email.toLowerCase().includes(normalizedQuery),
        )
      : users;

    return [...filteredUsers].sort((a, b) => {
      const comparison = compareUsers(a, b, sortKey);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [searchQuery, sortDirection, sortKey, users]);

  function handleSort(nextSortKey: SortKey): void {
    if (nextSortKey === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  return (
    <article className="panel users-list-panel">
      <div className="panel-header">
        <h2>{t.users.title}</h2>
        <button className="secondary-button" onClick={onRefresh} type="button">
          {t.users.refresh}
        </button>
      </div>

      <label className="table-search">
        <span>{t.users.search}</span>
        <input
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t.users.searchPlaceholder}
          value={searchQuery}
        />
      </label>

      {isLoading ? (
        <p className="metric">{t.users.loading}</p>
      ) : users.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader activeSortKey={sortKey} direction={sortDirection} label={t.users.colName} onSort={handleSort} sortKey="displayName" />
                <SortableHeader activeSortKey={sortKey} direction={sortDirection} label={t.users.colStatus} onSort={handleSort} sortKey="status" />
                <SortableHeader activeSortKey={sortKey} direction={sortDirection} label={t.users.colSuperAdmin} onSort={handleSort} sortKey="superAdmin" />
                <SortableHeader activeSortKey={sortKey} direction={sortDirection} label={t.users.colPermissions} onSort={handleSort} sortKey="permissions" />
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr
                  className={selectedUserId === user.id ? "selected" : ""}
                  key={user.id}
                  onClick={() => onSelectUser(user.id)}
                >
                  <td>
                    <button className="table-link" type="button">
                      <span>{user.displayName}</span>
                      <small>{user.email}</small>
                    </button>
                  </td>
                  <td>
                    <span className={`status-pill ${user.status}`}>{user.status}</span>
                  </td>
                  <td>{user.isSuperAdmin ? t.users.yes : t.users.no}</td>
                  <td>{user.isSuperAdmin ? t.users.allPermissions : `${user.permissions.length} ${t.users.grantsCount}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleUsers.length ? <p className="metric table-empty">{t.users.noMatch}</p> : null}
        </div>
      ) : (
        <p className="metric">{t.users.noUsers}</p>
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
      <button className={`sort-button ${isActive ? "active" : ""}`} onClick={() => onSort(sortKey)} type="button">
        <span>{label}</span>
        <small>{isActive ? (direction === "asc" ? "↑" : "↓") : ""}</small>
      </button>
    </th>
  );
}

function compareUsers(a: AdminUserWithPermissions, b: AdminUserWithPermissions, sortKey: SortKey): number {
  switch (sortKey) {
    case "displayName": return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
    case "permissions": return a.permissions.length - b.permissions.length;
    case "status": return a.status.localeCompare(b.status, undefined, { sensitivity: "base" });
    case "superAdmin": return Number(a.isSuperAdmin) - Number(b.isSuperAdmin);
  }
}
