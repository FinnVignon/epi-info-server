import { useEffect, useMemo, useState } from "react";

import { listAssignmentAssets } from "../api/adminAssignmentsApi";
import { ApiError } from "../api/adminApi";
import type { AssignAssetRequest, AssignmentResponse, Asset } from "../../../shared/adminContracts";
import type { FitMode } from "../../../shared/contracts";

export interface AssignmentTargetOption {
  id: string;
  name: string;
}

interface AssetAssignmentPanelProps {
  assignAsset: (targetId: string, request: AssignAssetRequest) => Promise<AssignmentResponse>;
  clearActionLabel?: string;
  clearAssignment?: (targetId: string) => Promise<void>;
  clearSuccessMessage?: (target: AssignmentTargetOption) => string;
  loadTargets: () => Promise<AssignmentTargetOption[]>;
  onUnauthorized: () => void;
  panelClassName: string;
  preferredTargetId: string | null;
  targetLabel: string;
  title: string;
}

export function AssetAssignmentPanel({
  assignAsset,
  clearActionLabel,
  clearAssignment,
  clearSuccessMessage,
  loadTargets,
  onUnauthorized,
  panelClassName,
  preferredTargetId,
  targetLabel,
  title,
}: AssetAssignmentPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fit, setFit] = useState<FitMode>("contain");
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [targets, setTargets] = useState<AssignmentTargetOption[]>([]);
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === assetId) ?? null,
    [assetId, assets],
  );
  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === targetId) ?? null,
    [targetId, targets],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAssignmentOptions(): Promise<void> {
      try {
        const [assetResponse, targetResponse] = await Promise.all([
          listAssignmentAssets(),
          loadTargets(),
        ]);

        if (!cancelled) {
          setAssets(assetResponse.assets);
          setTargets(targetResponse);
          setAssetId((currentAssetId) => currentAssetId || assetResponse.assets[0]?.id || "");
          setTargetId((currentTargetId) => {
            if (
              preferredTargetId &&
              targetResponse.some((target) => target.id === preferredTargetId)
            ) {
              return preferredTargetId;
            }

            return currentTargetId || targetResponse[0]?.id || "";
          });
          setIsAvailable(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError instanceof ApiError && loadError.status === 403) {
            setIsAvailable(false);
          } else {
            setIsAvailable(true);
            handleApiError(loadError, "Unable to load assignment options");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAssignmentOptions();

    return () => {
      cancelled = true;
    };
  }, [loadTargets]);

  useEffect(() => {
    setError(null);
    setNotice(null);

    if (preferredTargetId && targets.some((target) => target.id === preferredTargetId)) {
      setTargetId(preferredTargetId);
    }
  }, [preferredTargetId, targets]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!selectedAsset || !selectedTarget) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await assignAsset(selectedTarget.id, {
        assetId: selectedAsset.id,
        fit,
      });

      setNotice(
        `${response.manifest.name} assigned to ${selectedTarget.name}. Affected displays will activate version ${response.manifest.version} after download verification.`,
      );
    } catch (assignmentError) {
      handleApiError(assignmentError, "Unable to assign asset");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClearAssignment(): Promise<void> {
    if (!clearAssignment || !selectedTarget) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      await clearAssignment(selectedTarget.id);
      setNotice(
        clearSuccessMessage?.(selectedTarget) ??
          `${selectedTarget.name} will now use its next available assignment.`,
      );
    } catch (clearError) {
      handleApiError(clearError, "Unable to remove assignment");
    } finally {
      setIsSaving(false);
    }
  }

  function handleApiError(apiError: unknown, fallback: string): void {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized();
      return;
    }

    setError(apiError instanceof Error ? apiError.message : fallback);
  }

  if (isAvailable !== true) {
    return null;
  }

  return (
    <article className={`panel ${panelClassName}`}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p className="metric">
            {selectedTarget
              ? `Target: ${selectedTarget.name}`
              : `No permitted ${targetLabel.toLowerCase()} is available.`}
          </p>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}

      <form className="form-grid assignment-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>{targetLabel}</span>
          <select
            disabled={isLoading || isSaving || targets.length === 0}
            onChange={(event) => setTargetId(event.target.value)}
            value={targetId}
          >
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Asset</span>
          <select
            disabled={isLoading || isSaving || assets.length === 0}
            onChange={(event) => setAssetId(event.target.value)}
            value={assetId}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.displayName} ({asset.type})
              </option>
            ))}
          </select>
        </label>

        <label className="assignment-fit-field">
          <span>Fit</span>
          <select
            disabled={isSaving}
            onChange={(event) => setFit(event.target.value as FitMode)}
            value={fit}
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
          </select>
        </label>

        {assets.length === 0 && !isLoading ? (
          <p className="metric">Upload an active image or video before creating an assignment.</p>
        ) : null}

        <div className="assignment-actions">
          <button
            className="primary-button"
            disabled={!selectedAsset || !selectedTarget || isSaving}
            type="submit"
          >
            {isSaving ? "Working" : "Display asset"}
          </button>
          {clearAssignment && clearActionLabel ? (
            <button
              className="secondary-button"
              disabled={!selectedTarget || isSaving}
              onClick={() => void handleClearAssignment()}
              type="button"
            >
              {clearActionLabel}
            </button>
          ) : null}
        </div>
      </form>
    </article>
  );
}
