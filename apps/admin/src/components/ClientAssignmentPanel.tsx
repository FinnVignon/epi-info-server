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

interface ClientAssignmentPanelProps {
  onUnauthorized: () => void;
  preferredClientId: string | null;
}

export function ClientAssignmentPanel({
  onUnauthorized,
  preferredClientId,
}: ClientAssignmentPanelProps) {
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
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === assetId) ?? null,
    [assetId, assets],
  );
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clientId, clients],
  );

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
          setAssetId((currentAssetId) => currentAssetId || assetResponse.assets[0]?.id || "");
          setClientId((currentClientId) => {
            if (
              preferredClientId &&
              clientResponse.clients.some((client) => client.id === preferredClientId)
            ) {
              return preferredClientId;
            }

            return currentClientId || clientResponse.clients[0]?.id || "";
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
  }, []);

  useEffect(() => {
    setError(null);
    setNotice(null);

    if (preferredClientId && clients.some((client) => client.id === preferredClientId)) {
      setClientId(preferredClientId);
    }
  }, [clients, preferredClientId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!selectedClient || !selectedAsset) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await assignAssetToClient(selectedClient.id, {
        assetId: selectedAsset.id,
        fit,
      });

      setNotice(
        `${response.manifest.name} assigned. The client will activate version ${response.manifest.version} after download verification.`,
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

  if (isAvailable !== true) {
    return null;
  }

  return (
    <article className="panel client-assignment-panel">
      <div className="panel-header">
        <div>
          <h2>Display Assignment</h2>
          <p className="metric">
            {selectedClient
              ? `Target: ${selectedClient.name}`
              : "No permitted client is available."}
          </p>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}

      <form className="form-grid assignment-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>Client</span>
          <select
            disabled={isLoading || isSaving || clients.length === 0}
            onChange={(event) => setClientId(event.target.value)}
            value={clientId}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
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

        <button
          className="primary-button"
          disabled={!selectedClient || !selectedAsset || isSaving}
          type="submit"
        >
          {isSaving ? "Assigning" : "Display asset"}
        </button>
      </form>
    </article>
  );
}
