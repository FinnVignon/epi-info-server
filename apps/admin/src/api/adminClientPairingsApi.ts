import type {
  ApproveClientPairingRequest,
  ClientPairingActionResponse,
  LookupClientPairingRequest,
  LookupClientPairingResponse,
} from "../../../shared/clientPairingContracts";
import { readJsonResponse } from "./adminApi";

const PAIRING_API_URL = "/api/admin/client-pairings";

export async function lookupClientPairing(
  request: LookupClientPairingRequest,
): Promise<LookupClientPairingResponse> {
  return postJson<LookupClientPairingResponse>(`${PAIRING_API_URL}/lookup`, request);
}

export async function approveClientPairing(
  pairingId: string,
  request: ApproveClientPairingRequest,
): Promise<ClientPairingActionResponse> {
  return postJson<ClientPairingActionResponse>(
    `${PAIRING_API_URL}/${encodeURIComponent(pairingId)}/approve`,
    request,
  );
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).then(readJsonResponse<T>);
}
