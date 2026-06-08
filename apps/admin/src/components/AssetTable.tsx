import { useMemo, useState } from "react";

import type { AdminUser, Asset, AssetStatus, AssetType } from "../../../shared/adminContracts";

type AssetSortDirection = "asc" | "desc";
type AssetSortKey = "createdAt" | "displayName" | "sizeBytes" | "status" | "type" | "uploader";
type AssetStatusFilter = "active" | "all" | "archived";
type AssetTypeFilter = "all" | AssetType;

interface AssetTableProps {
  assets: Asset[];
  currentUser: AdminUser;
  isLoading: boolean;
  onRefresh: () => void;
  onStatusChange: (asset: Asset, status: AssetStatus) => void;
}

export function AssetTable({
  assets,
  currentUser,
  isLoading,
  onRefresh,
  onStatusChange,
}: AssetTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<AssetSortDirection>("desc");
  const [sortKey, setSortKey] = useState<AssetSortKey>("createdAt");
  const [statusFilter, setStatusFilter] = useState<AssetStatusFilter>("active");
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>("all");
  const visibleAssets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredAssets = assets.filter((asset) => {
      if (statusFilter !== "all" && asset.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== "all" && asset.type !== typeFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const uploader = asset.uploadedBy
        ? `${asset.uploadedBy.displayName} ${asset.uploadedBy.email}`
        : "";

      return [asset.displayName, asset.originalFilename, uploader].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });

    return filteredAssets.sort((firstAsset, secondAsset) => {
      const comparison = compareAssets(firstAsset, secondAsset, sortKey);

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [assets, searchQuery, sortDirection, sortKey, statusFilter, typeFilter]);

  function handleSort(nextSortKey: AssetSortKey): void {
    if (nextSortKey === sortKey) {
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "createdAt" ? "desc" : "asc");
  }

  return (
    <article className="panel assets-list-panel">
      <div className="panel-header">
        <h2>Assets</h2>
        <button className="secondary-button" onClick={onRefresh} type="button">
          Refresh
        </button>
      </div>

      <div className="table-controls">
        <label className="table-search">
          <span>Search</span>
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name, filename, or uploader"
            value={searchQuery}
          />
        </label>

        <label>
          <span>Status</span>
          <select
            onChange={(event) => setStatusFilter(event.target.value as AssetStatusFilter)}
            value={statusFilter}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>

        <label>
          <span>Type</span>
          <select
            onChange={(event) => setTypeFilter(event.target.value as AssetTypeFilter)}
            value={typeFilter}
          >
            <option value="all">All</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="metric">Loading assets...</p>
      ) : assets.length ? (
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
                  label="Type"
                  onSort={handleSort}
                  sortKey="type"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Uploader"
                  onSort={handleSort}
                  sortKey="uploader"
                />
                <SortableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label="Size"
                  onSort={handleSort}
                  sortKey="sizeBytes"
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
                  label="Uploaded"
                  onSort={handleSort}
                  sortKey="createdAt"
                />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAssets.map((asset) => {
                const canArchive =
                  currentUser.isSuperAdmin || asset.uploadedBy?.id === currentUser.id;
                const nextStatus: AssetStatus = asset.status === "active" ? "archived" : "active";

                return (
                  <tr key={asset.id}>
                    <td>
                      <div className="asset-file-cell">
                        <span>{asset.displayName}</span>
                        <small>{asset.originalFilename}</small>
                      </div>
                    </td>
                    <td>{asset.type}</td>
                    <td>{formatUploader(asset)}</td>
                    <td>{formatFileSize(asset.sizeBytes)}</td>
                    <td>
                      <span className={`status-pill ${asset.status}`}>{asset.status}</span>
                    </td>
                    <td>{formatDate(asset.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <a
                          className="table-action-link"
                          href={asset.publicUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open
                        </a>
                        <button
                          className="ghost-button"
                          disabled={!canArchive}
                          onClick={() => onStatusChange(asset, nextStatus)}
                          type="button"
                        >
                          {asset.status === "active" ? "Archive" : "Restore"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleAssets.length ? <p className="metric table-empty">No matching assets.</p> : null}
        </div>
      ) : (
        <p className="metric">No assets uploaded yet.</p>
      )}
    </article>
  );
}

interface SortableHeaderProps {
  activeSortKey: AssetSortKey;
  direction: AssetSortDirection;
  label: string;
  onSort: (sortKey: AssetSortKey) => void;
  sortKey: AssetSortKey;
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

function compareAssets(firstAsset: Asset, secondAsset: Asset, sortKey: AssetSortKey): number {
  switch (sortKey) {
    case "createdAt":
      return Date.parse(firstAsset.createdAt) - Date.parse(secondAsset.createdAt);
    case "displayName":
      return compareText(firstAsset.displayName, secondAsset.displayName);
    case "sizeBytes":
      return firstAsset.sizeBytes - secondAsset.sizeBytes;
    case "status":
      return compareText(firstAsset.status, secondAsset.status);
    case "type":
      return compareText(firstAsset.type, secondAsset.type);
    case "uploader":
      return compareText(formatUploader(firstAsset), formatUploader(secondAsset));
  }
}

function compareText(firstValue: string, secondValue: string): number {
  return firstValue.localeCompare(secondValue, undefined, {
    sensitivity: "base",
  });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function formatUploader(asset: Asset): string {
  return asset.uploadedBy?.displayName ?? "Unknown";
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
