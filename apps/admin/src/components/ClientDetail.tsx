import { useEffect, useState } from "react";

import { formatDate } from "../utils/formatDate";
import type { ManagedClient } from "../../../shared/clientContracts";

interface ClientDetailProps {
  client: ManagedClient | null;
  isSaving: boolean;
  onStatusChange: (client: ManagedClient) => void;
  onUpdateProfile: (name: string) => Promise<boolean>;
}

export function ClientDetail({
  client,
  isSaving,
  onStatusChange,
  onUpdateProfile,
}: ClientDetailProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(client?.name ?? "");
  }, [client?.id, client?.name]);

  async function handleUpdateProfile(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await onUpdateProfile(name);
  }

  if (!client) {
    return (
      <article className="panel clients-detail-panel">
        <p className="metric">Select a client.</p>
      </article>
    );
  }

  return (
    <article className="panel clients-detail-panel">
      <div className="panel-header">
        <div>
          <h2>{client.name}</h2>
          <p className="metric">{client.id}</p>
        </div>
        <button
          className="secondary-button"
          disabled={isSaving}
          onClick={() => onStatusChange(client)}
          type="button"
        >
          {client.accessStatus === "active" ? "Disable" : "Enable"}
        </button>
      </div>

      <div className="detail-grid">
        <p>
          <span>Connection</span>
          <strong>{client.connectionStatus}</strong>
        </p>
        <p>
          <span>Access</span>
          <strong>{client.accessStatus}</strong>
        </p>
        <p>
          <span>Client software</span>
          <strong>{client.softwareVersion ?? "Unknown"}</strong>
        </p>
        <p>
          <span>Last seen</span>
          <strong>{formatDate(client.lastSeenAt)}</strong>
        </p>
        <p>
          <span>Manifest</span>
          <strong>{client.currentManifestId ?? "None"}</strong>
        </p>
        <p>
          <span>Last sync</span>
          <strong>{client.lastSyncResult ?? "Unknown"}</strong>
        </p>
      </div>

      <form
        className="form-grid compact-form"
        onSubmit={(event) => void handleUpdateProfile(event)}
      >
        <label>
          <span>Client name</span>
          <input
            maxLength={255}
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <button className="secondary-button" disabled={isSaving} type="submit">
          Save name
        </button>
      </form>

      {client.lastError ? (
        <section className="section-block">
          <h3>Last Error</h3>
          <p className="client-error-detail">{client.lastError}</p>
        </section>
      ) : null}
    </article>
  );
}
