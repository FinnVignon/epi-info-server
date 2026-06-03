import { useMemo, useState } from "react";

import type { AdminUserWithPermissions } from "../../../shared/adminContracts";

type SortDirection = "asc" | "desc";
type SortKey = "displayName" | "permissions" | "status" | "superAdmin";

interface AdminUserTableProps {
  isLoading: boolean;
  onRefresh: () => void;
  onSelectUser: (userId: string) => void;
  selectedUserId: string | null;
  users: AdminUserWithPermissions[];
}

export function AdminUserTable({
  isLoading,
  onRefresh,
  onSelectUser,
  selectedUserId,
  users,
}: AdminUserTableProps) {
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

    return [...filteredUsers].sort((firstUser, secondUser) => {
      const comparison = compareUsers(firstUser, secondUser, sortKey);

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [searchQuery, sortDirection, sortKey, users]);

  function handleSort(nextSortKey: SortKey): void {
    if (nextSortKey === sortKey) {
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  return (
    <article className="panel users-list-panel">
      <div className="panel-header">
        <h2>Users</h2>
        <button className="secondary-button" onClick={onRefresh} type="button">
          Refresh
        </button>
      </div>

      <label className="table-search">
        <span>Search</span>
        <input
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Name or email"
          value={searchQuery}
        />
      </label>

      {isLoading ? (
        <p className="metric">Loading users...</p>
      ) : users.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Name"
                  onSort={handleSort}
                  sortKey="displayName"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Status"
                  onSort={handleSort}
                  sortKey="status"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Super admin"
                  onSort={handleSort}
                  sortKey="superAdmin"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Permissions"
                  onSort={handleSort}
                  sortKey="permissions"
                />
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
                  <td>{user.isSuperAdmin ? "Yes" : "No"}</td>
                  <td>{user.isSuperAdmin ? "All" : `${user.permissions.length} grants`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleUsers.length ? <p className="metric table-empty">No matching users.</p> : null}
        </div>
      ) : (
        <p className="metric">No admin users found.</p>
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

function compareUsers(
  firstUser: AdminUserWithPermissions,
  secondUser: AdminUserWithPermissions,
  sortKey: SortKey,
): number {
  switch (sortKey) {
    case "displayName":
      return compareText(firstUser.displayName, secondUser.displayName);
    case "permissions":
      return firstUser.permissions.length - secondUser.permissions.length;
    case "status":
      return compareText(firstUser.status, secondUser.status);
    case "superAdmin":
      return Number(firstUser.isSuperAdmin) - Number(secondUser.isSuperAdmin);
  }
}

function compareText(firstValue: string, secondValue: string): number {
  return firstValue.localeCompare(secondValue, undefined, {
    sensitivity: "base",
  });
}
