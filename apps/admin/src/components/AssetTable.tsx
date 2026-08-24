import { useMemo, useState } from "react";

import { RefreshButton } from "./RefreshButton";
import { SortableTableHeader, type SortDirection } from "./SortableTableHeader";
import { useTranslation } from "../i18n";
import {
  filterAndSortAssets,
  formatAssetStatus,
  formatAssetType,
  formatAssetUploader,
  formatFileSize,
  type AssetSortKey,
  type AssetStatusFilter,
  type AssetTypeFilter,
} from "../utils/assetTable";
import { formatDate } from "../utils/formatDate";
import type { AdminUser, Asset, AssetStatus } from "../../../shared/adminContracts";

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
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [sortKey, setSortKey] = useState<AssetSortKey>("createdAt");
  const [statusFilter, setStatusFilter] = useState<AssetStatusFilter>("active");
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>("all");
  const visibleAssets = useMemo(
    () =>
      filterAndSortAssets(assets, {
        searchQuery,
        sortDirection,
        sortKey,
        statusFilter,
        typeFilter,
      }),
    [assets, searchQuery, sortDirection, sortKey, statusFilter, typeFilter],
  );

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
        <h2>{t.assets.title}</h2>
        <RefreshButton label={t.common.refresh} onClick={onRefresh} />
      </div>

      <div className="table-controls">
        <label className="table-search">
          <span>{t.common.search}</span>
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t.assets.searchPlaceholder}
            value={searchQuery}
          />
        </label>

        <label>
          <span>{t.assets.statusFilter}</span>
          <select
            onChange={(event) => setStatusFilter(event.target.value as AssetStatusFilter)}
            value={statusFilter}
          >
            <option value="active">{t.common.active}</option>
            <option value="archived">{t.common.archived}</option>
            <option value="all">{t.common.all}</option>
          </select>
        </label>

        <label>
          <span>{t.assets.typeFilter}</span>
          <select
            onChange={(event) => setTypeFilter(event.target.value as AssetTypeFilter)}
            value={typeFilter}
          >
            <option value="all">{t.common.all}</option>
            <option value="image">{t.common.images}</option>
            <option value="video">{t.common.videos}</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="metric">{t.assets.loading}</p>
      ) : assets.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.common.name}
                  onSort={handleSort}
                  sortKey="displayName"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.common.type}
                  onSort={handleSort}
                  sortKey="type"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.assets.uploader}
                  onSort={handleSort}
                  sortKey="uploader"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.assets.size}
                  onSort={handleSort}
                  sortKey="sizeBytes"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.common.status}
                  onSort={handleSort}
                  sortKey="status"
                />
                <SortableTableHeader
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  label={t.assets.uploaded}
                  onSort={handleSort}
                  sortKey="createdAt"
                />
                <th>{t.common.actions}</th>
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
                    <td>{formatAssetType(asset.type, t)}</td>
                    <td>{formatAssetUploader(asset, t)}</td>
                    <td>{formatFileSize(asset.sizeBytes)}</td>
                    <td>
                      <span className={`status-pill ${asset.status}`}>
                        {formatAssetStatus(asset.status, t)}
                      </span>
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
                          {t.common.open}
                        </a>
                        <button
                          className="ghost-button"
                          disabled={!canArchive}
                          onClick={() => onStatusChange(asset, nextStatus)}
                          type="button"
                        >
                          {asset.status === "active" ? t.common.archive : t.common.restore}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleAssets.length ? <p className="metric table-empty">{t.assets.noMatch}</p> : null}
        </div>
      ) : (
        <p className="metric">{t.assets.noAssets}</p>
      )}
    </article>
  );
}
