import { useEffect, useState } from "react";

import { listAssets, updateAssetStatus, uploadAsset } from "../api/adminAssetsApi";
import { ApiError } from "../api/adminApi";
import { AssetTable } from "./AssetTable";
import { AssetUploadForm } from "./AssetUploadForm";
import type { AdminUser, Asset, AssetStatus } from "../../../shared/adminContracts";

interface AdminAssetsScreenProps {
  currentUser: AdminUser;
  onUnauthorized: () => void;
}

export function AdminAssetsScreen({ currentUser, onUnauthorized }: AdminAssetsScreenProps) {
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
      handleApiError(loadError, "Unable to load assets");
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
      setNotice("Asset uploaded.");
      return true;
    } catch (uploadError) {
      handleApiError(uploadError, "Unable to upload asset");
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
      setNotice(status === "archived" ? "Asset archived." : "Asset restored.");
    } catch (statusError) {
      handleApiError(statusError, "Unable to update asset");
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
    <section className="content assets-layout">
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
    </section>
  );
}
