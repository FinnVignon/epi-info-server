import { useTranslation, type Translations } from "../i18n";
import type { Asset } from "../../../shared/adminContracts";
import type { FitMode } from "../../../shared/contracts";
import type { AssignmentContentType, AssignmentTargetOption } from "./displayAssignmentTypes";

interface DisplayAssignmentFormProps {
  assetId: string;
  assets: Asset[];
  canSubmit: boolean;
  contentType: AssignmentContentType;
  fit: FitMode;
  hideTargetSelector: boolean;
  isLoading: boolean;
  isSaving: boolean;
  liveUrl: string;
  onAssetChange: (assetId: string) => void;
  onContentTypeChange: (contentType: AssignmentContentType) => void;
  onFitChange: (fit: FitMode) => void;
  onLiveUrlChange: (url: string) => void;
  onRefreshSecondsChange: (seconds: string) => void;
  onSubmit: () => void;
  onTargetChange: (targetId: string) => void;
  refreshSeconds: string;
  targetId: string;
  targetLabel: string;
  targets: AssignmentTargetOption[];
}

export function DisplayAssignmentForm({
  assetId,
  assets,
  canSubmit,
  contentType,
  fit,
  hideTargetSelector,
  isLoading,
  isSaving,
  liveUrl,
  onAssetChange,
  onContentTypeChange,
  onFitChange,
  onLiveUrlChange,
  onRefreshSecondsChange,
  onSubmit,
  onTargetChange,
  refreshSeconds,
  targetId,
  targetLabel,
  targets,
}: DisplayAssignmentFormProps) {
  const { t } = useTranslation();

  return (
    <form
      className="form-grid assignment-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {!hideTargetSelector ? (
        <label>
          <span>{targetLabel}</span>
          <select
            disabled={isLoading || isSaving || targets.length === 0}
            onChange={(event) => onTargetChange(event.target.value)}
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
        <span>{t.assignment.contentLabel}</span>
        <select
          disabled={isSaving}
          onChange={(event) => onContentTypeChange(event.target.value as AssignmentContentType)}
          value={contentType}
        >
          <option value="asset">{t.assignment.contentAsset}</option>
          <option value="live_web_link">{t.assignment.contentLiveWebLink}</option>
        </select>
      </label>

      {contentType === "asset" ? (
        <>
          <label>
            <span>{t.assignment.assetLabel}</span>
            <select
              disabled={isLoading || isSaving || assets.length === 0}
              onChange={(event) => onAssetChange(event.target.value)}
              value={assetId}
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.displayName} ({formatAssetType(asset.type, t)})
                </option>
              ))}
            </select>
          </label>

          <label className="assignment-fit-field">
            <span>{t.assignment.fitLabel}</span>
            <select
              disabled={isSaving}
              onChange={(event) => onFitChange(event.target.value as FitMode)}
              value={fit}
            >
              <option value="contain">{t.assignment.fitContain}</option>
              <option value="cover">{t.assignment.fitCover}</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <label>
            <span>{t.assignment.webLinkLabel}</span>
            <input
              disabled={isSaving}
              maxLength={2048}
              onChange={(event) => onLiveUrlChange(event.target.value)}
              placeholder={t.assignment.webLinkPlaceholder}
              type="url"
              value={liveUrl}
            />
          </label>

          <label>
            <span>{t.assignment.refreshSecondsLabel}</span>
            <input
              disabled={isSaving}
              max={86400}
              min={1}
              onChange={(event) => onRefreshSecondsChange(event.target.value)}
              type="number"
              value={refreshSeconds}
            />
          </label>
        </>
      )}

      {contentType === "asset" && assets.length === 0 && !isLoading ? (
        <p className="metric">{t.assignment.noAssets}</p>
      ) : null}

      <div className="assignment-actions">
        <button className="primary-button" disabled={!canSubmit} type="submit">
          {isSaving ? t.common.working : t.assignment.assignButton}
        </button>
      </div>
    </form>
  );
}

function formatAssetType(type: Asset["type"], t: Translations): string {
  return type === "image" ? t.common.image : t.common.video;
}
