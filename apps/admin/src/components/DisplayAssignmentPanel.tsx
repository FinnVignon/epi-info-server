import { useEffect, useMemo, useState } from "react";

import { listAssignmentAssets } from "../api/adminAssignmentsApi";
import { ApiError } from "../api/adminApi";
import { useTemporaryNotice } from "../hooks/useTemporaryNotice";
import { formatTranslation, useTranslation } from "../i18n";
import { AdminFeedback } from "./AdminFeedback";
import { DisplayAssignmentForm } from "./DisplayAssignmentForm";
import type { AssignmentContentType, AssignmentTargetOption } from "./displayAssignmentTypes";
import type {
  AssignDisplayContentRequest,
  AssignmentResponse,
  Asset,
} from "../../../shared/adminContracts";
import type { FitMode } from "../../../shared/contracts";

interface DisplayAssignmentPanelProps {
  assignContent: (
    targetId: string,
    request: AssignDisplayContentRequest,
  ) => Promise<AssignmentResponse>;
  hideTargetSelector?: boolean;
  loadTargets: () => Promise<AssignmentTargetOption[]>;
  onUnauthorized: () => void;
  panelClassName: string;
  preferredTargetId: string | null;
  targetLabel: string;
  title: string;
  unavailableMessage?: string;
}

export function DisplayAssignmentPanel({
  assignContent,
  hideTargetSelector = false,
  loadTargets,
  onUnauthorized,
  panelClassName,
  preferredTargetId,
  targetLabel,
  title,
  unavailableMessage,
}: DisplayAssignmentPanelProps) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [contentType, setContentType] = useState<AssignmentContentType>("asset");
  const [error, setError] = useState<string | null>(null);
  const [fit, setFit] = useState<FitMode>("contain");
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");
  const [notice, setNotice] = useTemporaryNotice();
  const [refreshSecondsInput, setRefreshSecondsInput] = useState("60");
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
  const hasValidLiveWebLink =
    liveUrl.trim().length > 0 &&
    Number.isSafeInteger(Number(refreshSecondsInput)) &&
    Number(refreshSecondsInput) >= 1 &&
    Number(refreshSecondsInput) <= 86400;
  const canSubmit =
    !!selectedTarget &&
    !isSaving &&
    (contentType === "asset" ? !!selectedAsset : hasValidLiveWebLink);

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
            handleApiError(loadError, t.assignment.errorLoad);
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
  }, [loadTargets, preferredTargetId]);

  useEffect(() => {
    setError(null);
    setNotice(null);

    if (preferredTargetId && targets.some((target) => target.id === preferredTargetId)) {
      setTargetId(preferredTargetId);
    }
  }, [preferredTargetId, targets]);

  async function handleSubmit(): Promise<void> {
    if (!selectedTarget) {
      return;
    }

    const request = createAssignmentRequest();

    if (!request) {
      setError(t.assignment.errorInvalidContent);
      return;
    }

    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await assignContent(selectedTarget.id, request);

      setNotice(
        formatTranslation(t.assignment.noticeSent, {
          manifest: response.manifest.name,
          target: selectedTarget.name,
        }),
      );
    } catch (assignmentError) {
      handleApiError(assignmentError, t.assignment.errorAssign);
    } finally {
      setIsSaving(false);
    }
  }

  function createAssignmentRequest(): AssignDisplayContentRequest | null {
    if (contentType === "asset") {
      if (!selectedAsset) {
        return null;
      }

      return {
        assetId: selectedAsset.id,
        contentType: "asset",
        fit,
      };
    }

    if (!hasValidLiveWebLink) {
      return null;
    }

    return {
      contentType: "live_web_link",
      refreshSeconds: Number(refreshSecondsInput),
      url: liveUrl.trim(),
    };
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
              ? formatTranslation(t.assignment.targetSummary, { target: selectedTarget.name })
              : formatTranslation(t.assignment.noTarget, {
                  target: targetLabel.toLocaleLowerCase(),
                })}
          </p>
        </div>
      </div>

      <AdminFeedback error={error} notice={notice} />

      <DisplayAssignmentForm
        assetId={assetId}
        assets={assets}
        canSubmit={canSubmit}
        contentType={contentType}
        fit={fit}
        hideTargetSelector={hideTargetSelector}
        isLoading={isLoading}
        isSaving={isSaving}
        liveUrl={liveUrl}
        onAssetChange={setAssetId}
        onContentTypeChange={setContentType}
        onFitChange={setFit}
        onLiveUrlChange={setLiveUrl}
        onRefreshSecondsChange={setRefreshSecondsInput}
        onSubmit={() => void handleSubmit()}
        onTargetChange={setTargetId}
        refreshSeconds={refreshSecondsInput}
        targetId={targetId}
        targetLabel={targetLabel}
        targets={targets}
      />
    </article>
  );
}
