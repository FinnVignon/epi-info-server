import { useEffect, useState } from "react";

import { useTranslation, type Translations } from "../i18n";
import { formatDate } from "../utils/formatDate";
import type {
  ClientAccessStatus,
  ClientConnectionStatus,
  ManagedClient,
} from "../../../shared/clientContracts";

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
  const { t } = useTranslation();
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
        <p className="metric">{t.clients.selectClient}</p>
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
          {client.accessStatus === "active" ? t.clients.disable : t.clients.enable}
        </button>
      </div>

      <div className="detail-grid">
        <p>
          <span>{t.clients.connection}</span>
          <strong>{formatConnectionStatus(client.connectionStatus, t)}</strong>
        </p>
        <p>
          <span>{t.clients.access}</span>
          <strong>{formatAccessStatus(client.accessStatus, t)}</strong>
        </p>
        <p>
          <span>{t.clients.clientSoftware}</span>
          <strong>{client.softwareVersion ?? t.common.unknown}</strong>
        </p>
        <p>
          <span>{t.clients.lastSeen}</span>
          <strong>{formatDate(client.lastSeenAt, t.common.never)}</strong>
        </p>
        <p>
          <span>{t.clients.manifest}</span>
          <strong>{client.currentManifestId ?? t.common.none}</strong>
        </p>
        <p>
          <span>{t.clients.lastSync}</span>
          <strong>{client.lastSyncResult ?? t.common.unknown}</strong>
        </p>
      </div>

      <form
        className="form-grid compact-form"
        onSubmit={(event) => void handleUpdateProfile(event)}
      >
        <label>
          <span>{t.clients.clientName}</span>
          <input
            maxLength={255}
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <button className="secondary-button" disabled={isSaving} type="submit">
          {t.common.saveName}
        </button>
      </form>

      {client.lastError ? (
        <section className="section-block">
          <h3>{t.clients.lastError}</h3>
          <p className="client-error-detail">{client.lastError}</p>
        </section>
      ) : null}
    </article>
  );
}

function formatAccessStatus(status: ClientAccessStatus, t: Translations): string {
  return status === "active" ? t.common.active : t.common.disabled;
}

function formatConnectionStatus(status: ClientConnectionStatus, t: Translations): string {
  switch (status) {
    case "offline":
      return t.clients.connectionOffline;
    case "online":
      return t.clients.connectionOnline;
    case "unknown":
      return t.clients.connectionUnknown;
  }
}
