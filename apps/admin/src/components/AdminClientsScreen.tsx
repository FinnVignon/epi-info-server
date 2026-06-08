import { useEffect, useMemo, useState } from "react";

import { listClients, updateClientProfile, updateClientStatus } from "../api/adminClientsApi";
import { ApiError } from "../api/adminApi";
import { ClientDetail } from "./ClientDetail";
import { ClientEnrollmentPanel } from "./ClientEnrollmentPanel";
import { ClientTable } from "./ClientTable";
import type { ManagedClient } from "../../../shared/clientContracts";

interface AdminClientsScreenProps {
  onUnauthorized: () => void;
}

export function AdminClientsScreen({ onUnauthorized }: AdminClientsScreenProps) {
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

      setClients(response.clients);
      setSelectedClientId(
        (currentSelection) => currentSelection ?? response.clients[0]?.id ?? null,
      );
    } catch (loadError) {
      handleApiError(loadError, "Unable to load clients");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateProfile(name: string): Promise<boolean> {
    if (!selectedClient) {
      return false;
    }

    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await updateClientProfile(selectedClient.id, { name });

      replaceClient(response.client);
      setNotice("Client updated.");
      return true;
    } catch (profileError) {
      handleApiError(profileError, "Unable to update client");
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
      setNotice(response.client.accessStatus === "active" ? "Client enabled." : "Client disabled.");
    } catch (statusError) {
      handleApiError(statusError, "Unable to update client status");
    } finally {
      setIsSaving(false);
    }
  }

  function replaceClient(client: ManagedClient): void {
    setClients((currentClients) =>
      currentClients.map((currentClient) =>
        currentClient.id === client.id ? client : currentClient,
      ),
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
    <section className="content clients-layout">
      {error || notice ? (
        <div className="screen-alerts">
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}
        </div>
      ) : null}

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

      <ClientEnrollmentPanel onUnauthorized={onUnauthorized} />
    </section>
  );
}
