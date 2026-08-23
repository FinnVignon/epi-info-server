import { useEffect, useState } from "react";

import { listAssets, updateAssetStatus, uploadAsset } from "../api/adminAssetsApi";
import { ApiError } from "../api/adminApi";
import { useTranslation } from "../i18n";
import { AssetTable } from "./AssetTable";
import { AssetUploadForm } from "./AssetUploadForm";
import type { AdminUser, Asset, AssetStatus } from "../../../shared/adminContracts";

interface AssetLibraryProps {
  currentUser: AdminUser;
  onUnauthorized: () => void;
}

export function AssetLibrary({ currentUser, onUnauthorized }: AssetLibraryProps) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadAssets();
  }, []);

  async function loadAssets(): Promise<void> {
    setError(null);
    setIsLoading(true);

    try {
      const response = await listAssets();
      setAssets(response.assets);
    } catch (loadError) {
      handleApiError(loadError, t.assets.errorLoad);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpload(file: File, displayName: string): Promise<boolean> {
    setError(null);
    setNotice(null);
    setIsUploading(true);

    try {
      const response = await uploadAsset(file, displayName);

      setAssets((currentAssets) => [
        response.asset,
        ...currentAssets.filter((asset) => asset.id !== response.asset.id),
      ]);
      setNotice(t.assets.noticeUploaded);
      return true;
    } catch (uploadError) {
      handleApiError(uploadError, t.assets.errorUpload);
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAssetStatusChange(asset: Asset, status: AssetStatus): Promise<void> {
    setError(null);
    setNotice(null);

    try {
      const response = await updateAssetStatus(asset.id, { status });

      replaceAsset(response.asset);
      setNotice(status === "archived" ? t.assets.noticeArchived : t.assets.noticeRestored);
    } catch (statusError) {
      handleApiError(statusError, t.assets.errorUpdate);
    }
  }

  function replaceAsset(asset: Asset): void {
    setAssets((currentAssets) =>
      currentAssets.map((currentAsset) => (currentAsset.id === asset.id ? asset : currentAsset)),
    );
  }

  function handleApiError(apiError: unknown, fallback: string): void {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized();
      return;
    }

    setError(apiError instanceof Error ? apiError.message : fallback);
  }

  return (
    <div className="asset-library-layout">
      {error || notice ? (
        <div className="screen-alerts">
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}
        </div>
      ) : null}

      <AssetUploadForm isUploading={isUploading} onUpload={handleUpload} />
      <AssetTable
        assets={assets}
        currentUser={currentUser}
        isLoading={isLoading}
        onRefresh={() => void loadAssets()}
        onStatusChange={(asset, status) => void handleAssetStatusChange(asset, status)}
      />
    </div>
  );
}
