import type { Translations } from "../i18n";
import type { Asset, AssetStatus, AssetType } from "../../../shared/adminContracts";
import type { SortDirection } from "../components/SortableTableHeader";

export type AssetSortKey =
  | "createdAt"
  | "displayName"
  | "sizeBytes"
  | "status"
  | "type"
  | "uploader";
export type AssetStatusFilter = "active" | "all" | "archived";
export type AssetTypeFilter = "all" | AssetType;

interface AssetTableQuery {
  searchQuery: string;
  sortDirection: SortDirection;
  sortKey: AssetSortKey;
  statusFilter: AssetStatusFilter;
  typeFilter: AssetTypeFilter;
}

export function filterAndSortAssets(assets: Asset[], query: AssetTableQuery): Asset[] {
  const normalizedQuery = query.searchQuery.trim().toLowerCase();
  const filteredAssets = assets.filter((asset) => {
    if (query.statusFilter !== "all" && asset.status !== query.statusFilter) {
      return false;
    }

    if (query.typeFilter !== "all" && asset.type !== query.typeFilter) {
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
    const comparison = compareAssets(firstAsset, secondAsset, query.sortKey);

    return query.sortDirection === "asc" ? comparison : -comparison;
  });
}

export function formatAssetStatus(status: AssetStatus, t: Translations): string {
  return status === "active" ? t.common.active : t.common.archived;
}

export function formatAssetType(type: AssetType, t: Translations): string {
  return type === "image" ? t.common.image : t.common.video;
}

export function formatAssetUploader(asset: Asset, t: Translations): string {
  return asset.uploadedBy?.displayName ?? t.assets.unknownUploader;
}

export function formatFileSize(sizeBytes: number): string {
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
      return compareText(
        firstAsset.uploadedBy?.displayName ?? "",
        secondAsset.uploadedBy?.displayName ?? "",
      );
  }
}

function compareText(firstValue: string, secondValue: string): number {
  return firstValue.localeCompare(secondValue, undefined, { sensitivity: "base" });
}
