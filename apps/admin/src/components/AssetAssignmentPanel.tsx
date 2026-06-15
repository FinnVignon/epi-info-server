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
  hideTargetSelector?: boolean;
  loadTargets: () => Promise<AssignmentTargetOption[]>;
  onUnauthorized: () => void;
  panelClassName: string;
  preferredTargetId: string | null;
  targetLabel: string;
  title: string;
  unavailableMessage?: string;
}

export function AssetAssignmentPanel({
  assignAsset,
  hideTargetSelector = false,
  loadTargets,
  onUnauthorized,
  panelClassName,
  preferredTargetId,
  targetLabel,
  title,
  unavailableMessage,
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
        `${response.manifest.name} sent to ${selectedTarget.name}. Affected displays will download, verify, and activate it on their next sync.`,
      );
    } catch (assignmentError) {
      handleApiError(assignmentError, "Unable to assign asset");
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

  if (isAvailable === false && unavailableMessage) {
    return (
      <article className={`panel ${panelClassName}`}>
        <h2>{title}</h2>
        <p className="metric">{unavailableMessage}</p>
      </article>
    );
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
        {!hideTargetSelector ? (
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
        ) : null}

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
        </div>
      </form>
    </article>
  );
}
