import { useEffect, useMemo, useState } from "react";

import { listClients, updateClientProfile, updateClientStatus } from "../api/adminClientsApi";
import { ApiError } from "../api/adminApi";
import { ClientAssignmentPanel } from "./ClientAssignmentPanel";
import { ClientDetail } from "./ClientDetail";
import { ClientEnrollmentPanel } from "./ClientEnrollmentPanel";
import { ClientTable } from "./ClientTable";
import type { ManagedClient } from "../../../shared/clientContracts";
import { useTranslation } from "../i18n";

interface AdminClientsScreenProps {
  onUnauthorized: () => void;
}

export function AdminClientsScreen({ onUnauthorized }: AdminClientsScreenProps) {
  const { t } = useTranslation();
  const [canEnrollClients, setCanEnrollClients] = useState(false);
  const [canManageClients, setCanManageClients] = useState<boolean | null>(null);
  const [clients, setClients] = useState<ManagedClient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? clients[0] ?? null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    void loadClients();
  }, []);

  async function loadClients(): Promise<void> {
    setError(null);
    setIsLoading(true);

    try {
      const response = await listClients();
      setCanEnrollClients(response.capabilities.canEnrollClients);
      setCanManageClients(true);
      setClients(response.clients);
      setSelectedClientId(
        (currentSelection) => currentSelection ?? response.clients[0]?.id ?? null,
      );
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 403) {
        setCanManageClients(false);
        setCanEnrollClients(false);
        setClients([]);
        setSelectedClientId(null);
      } else {
        handleApiError(loadError, t.clients.errorLoad);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateProfile(name: string): Promise<boolean> {
    if (!selectedClient) return false;
    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await updateClientProfile(selectedClient.id, { name });
      replaceClient(response.client);
      setNotice(t.clients.noticeUpdated);
      return true;
    } catch (profileError) {
      handleApiError(profileError, t.clients.errorUpdate);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(client: ManagedClient): Promise<void> {
    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await updateClientStatus(client.id, {
        accessStatus: client.accessStatus === "active" ? "disabled" : "active",
      });
      replaceClient(response.client);
      setNotice(
        response.client.accessStatus === "active"
          ? t.clients.noticeEnabled
          : t.clients.noticeDisabled,
      );
    } catch (statusError) {
      handleApiError(statusError, t.clients.errorStatus);
    } finally {
      setIsSaving(false);
    }
  }

  function replaceClient(client: ManagedClient): void {
    setClients((currentClients) => currentClients.map((c) => (c.id === client.id ? client : c)));
  }

  function handleApiError(apiError: unknown, fallback: string): void {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized();
      return;
    }
    setError(apiError instanceof Error ? apiError.message : fallback);
  }

  return (
    <section
      className={`content clients-layout ${canManageClients === false ? "assignment-only" : ""}`}
    >
      {error || notice ? (
        <div className="screen-alerts">
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}
        </div>
      ) : null}

      {canManageClients !== false ? (
        <>
          <ClientTable
            clients={clients}
            isLoading={isLoading}
            onRefresh={() => void loadClients()}
            onSelectClient={setSelectedClientId}
            selectedClientId={selectedClient?.id ?? null}
          />
          <ClientDetail
            client={selectedClient}
            isSaving={isSaving}
            onStatusChange={(client) => void handleStatusChange(client)}
            onUpdateProfile={handleUpdateProfile}
          />
          {canEnrollClients ? <ClientEnrollmentPanel onUnauthorized={onUnauthorized} /> : null}
        </>
      ) : null}

      <ClientAssignmentPanel
        onUnauthorized={onUnauthorized}
        preferredClientId={selectedClient?.id ?? null}
      />
    </section>
  );
}
