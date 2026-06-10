import { useMemo, useState } from "react";

import { formatDate } from "../utils/formatDate";
import type { DisplayGroup } from "../../../shared/groupContracts";

type SortDirection = "asc" | "desc";
type SortKey = "members" | "name" | "updated";

interface GroupTableProps {
  groups: DisplayGroup[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectGroup: (groupId: string) => void;
  selectedGroupId: string | null;
}

export function GroupTable({
  groups,
  isLoading,
  onRefresh,
  onSelectGroup,
  selectedGroupId,
}: GroupTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const visibleGroups = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return groups
      .filter(
        (group) =>
          !normalizedQuery ||
          group.name.toLowerCase().includes(normalizedQuery) ||
          group.id.toLowerCase().includes(normalizedQuery),
      )
      .sort((firstGroup, secondGroup) => {
        const comparison = compareGroups(firstGroup, secondGroup, sortKey);

        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [groups, searchQuery, sortDirection, sortKey]);

  function handleSort(nextSortKey: SortKey): void {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortDirection("asc");
    setSortKey(nextSortKey);
  }

  return (
    <article className="panel groups-list-panel">
      <div className="panel-header">
        <h2>Groups</h2>
        <button className="secondary-button" onClick={onRefresh} type="button">
          Refresh
        </button>
      </div>

      <label className="table-search">
        <span>Search</span>
        <input
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Name or ID"
          value={searchQuery}
        />
      </label>

      {isLoading ? (
        <p className="metric">Loading groups...</p>
      ) : groups.length ? (
        <div className="table-wrap">
          <table className="data-table groups-table">
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
                  label="Members"
                  onSort={handleSort}
                  sortKey="members"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Updated"
                  onSort={handleSort}
                  sortKey="updated"
                />
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group) => (
                <tr
                  className={selectedGroupId === group.id ? "selected" : ""}
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                >
                  <td>
                    <button className="table-link" type="button">
                      <span>{group.name}</span>
                      <small>{shortGroupId(group.id)}</small>
                    </button>
                  </td>
                  <td>{group.memberCount}</td>
                  <td>{formatDate(group.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleGroups.length ? <p className="metric table-empty">No matching groups.</p> : null}
        </div>
      ) : (
        <p className="metric">No groups created yet.</p>
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

function compareGroups(
  firstGroup: DisplayGroup,
  secondGroup: DisplayGroup,
  sortKey: SortKey,
): number {
  switch (sortKey) {
    case "members":
      return firstGroup.memberCount - secondGroup.memberCount;
    case "name":
      return firstGroup.name.localeCompare(secondGroup.name, undefined, {
        sensitivity: "base",
      });
    case "updated":
      return Date.parse(firstGroup.updatedAt) - Date.parse(secondGroup.updatedAt);
  }
}

function shortGroupId(groupId: string): string {
  return groupId.length > 16 ? `${groupId.slice(0, 8)}...${groupId.slice(-4)}` : groupId;
}
