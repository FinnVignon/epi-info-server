import { useEffect, useMemo, useState } from "react";

import {
  assignAssetToClient,
  listAssignmentAssets,
  listAssignmentClients,
} from "../api/adminAssignmentsApi";
import { ApiError } from "../api/adminApi";
import type { Asset } from "../../../shared/adminContracts";
import type { ManagedClient } from "../../../shared/clientContracts";
import type { FitMode } from "../../../shared/contracts";
import { useTranslation } from "../i18n";

interface ClientAssignmentPanelProps {
  onUnauthorized: () => void;
  preferredClientId: string | null;
}

export function ClientAssignmentPanel({ onUnauthorized, preferredClientId }: ClientAssignmentPanelProps) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [clients, setClients] = useState<ManagedClient[]>([]);
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fit, setFit] = useState<FitMode>("contain");
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedAsset = useMemo(() => assets.find((a) => a.id === assetId) ?? null, [assetId, assets]);
  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId) ?? null, [clientId, clients]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignmentOptions(): Promise<void> {
      try {
        const [assetResponse, clientResponse] = await Promise.all([
          listAssignmentAssets(),
          listAssignmentClients(),
        ]);

        if (!cancelled) {
          setAssets(assetResponse.assets);
          setClients(clientResponse.clients);
          setAssetId((current) => current || assetResponse.assets[0]?.id || "");
          setClientId((current) => {
            if (preferredClientId && clientResponse.clients.some((c) => c.id === preferredClientId)) {
              return preferredClientId;
            }
            return current || clientResponse.clients[0]?.id || "";
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
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadAssignmentOptions();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setError(null);
    setNotice(null);
    if (preferredClientId && clients.some((c) => c.id === preferredClientId)) {
      setClientId(preferredClientId);
    }
  }, [clients, preferredClientId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedClient || !selectedAsset) return;

    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await assignAssetToClient(selectedClient.id, { assetId: selectedAsset.id, fit });
      setNotice(`${response.manifest.name} ${t.assignment.noticeAssigned} ${response.manifest.version}.`);
    } catch (assignmentError) {
      handleApiError(assignmentError, t.assignment.errorAssign);
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

  if (isAvailable !== true) return null;

  return (
    <article className="panel client-assignment-panel">
      <div className="panel-header">
        <div>
          <h2>{t.assignment.title}</h2>
          <p className="metric">
            {selectedClient ? `${t.assignment.target} : ${selectedClient.name}` : t.assignment.noClient}
          </p>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}

      <form className="form-grid assignment-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>{t.assignment.clientLabel}</span>
          <select
            disabled={isLoading || isSaving || clients.length === 0}
            onChange={(event) => setClientId(event.target.value)}
            value={clientId}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>{t.assignment.assetLabel}</span>
          <select
            disabled={isLoading || isSaving || assets.length === 0}
            onChange={(event) => setAssetId(event.target.value)}
            value={assetId}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.displayName} ({asset.type})</option>
            ))}
          </select>
        </label>

        <label className="assignment-fit-field">
          <span>{t.assignment.fitLabel}</span>
          <select
            disabled={isSaving}
            onChange={(event) => setFit(event.target.value as FitMode)}
            value={fit}
          >
            <option value="contain">{t.assignment.fitContain}</option>
            <option value="cover">{t.assignment.fitCover}</option>
          </select>
        </label>

        {assets.length === 0 && !isLoading ? (
          <p className="metric">{t.assignment.noAssets}</p>
        ) : null}

        <button
          className="primary-button"
          disabled={!selectedClient || !selectedAsset || isSaving}
          type="submit"
        >
          {isSaving ? t.assignment.assigning : t.assignment.assignButton}
        </button>
      </form>
    </article>
  );
}
