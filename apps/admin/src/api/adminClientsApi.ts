import type {
  ClientListResponse,
  ClientResponse,
  CreateClientEnrollmentTokenResponse,
  UpdateClientProfileRequest,
  UpdateClientStatusRequest,
} from "../../../shared/clientContracts";
import { readJsonResponse } from "./adminApi";

export async function createClientEnrollmentToken(): Promise<CreateClientEnrollmentTokenResponse> {
  return readJsonResponse<CreateClientEnrollmentTokenResponse>(
    await fetch("/api/admin/client-enrollment-tokens", {
      method: "POST",
    }),
  );
}

export async function listClients(): Promise<ClientListResponse> {
  return readJsonResponse<ClientListResponse>(await fetch("/api/admin/clients"));
}

export async function updateClientProfile(
  clientId: string,
  request: UpdateClientProfileRequest,
): Promise<ClientResponse> {
  return readJsonResponse<ClientResponse>(
    await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}/profile`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }),
  );
}

export async function updateClientStatus(
  clientId: string,
  request: UpdateClientStatusRequest,
): Promise<ClientResponse> {
  return readJsonResponse<ClientResponse>(
    await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}/status`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }),
  );
}
