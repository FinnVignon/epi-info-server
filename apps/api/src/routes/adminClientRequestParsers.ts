import type {
  ClientAccessStatus,
  UpdateClientProfileRequest,
  UpdateClientStatusRequest,
} from "../../../shared/clientContracts.js";

export interface ClientRouteParams {
  clientId?: string;
}

export function readClientId(params: ClientRouteParams): string | null {
  return typeof params.clientId === "string" && params.clientId.length > 0 ? params.clientId : null;
}

export function readClientName(
  body: Partial<UpdateClientProfileRequest>,
): string | { error: string } {
  if (typeof body.name !== "string") {
    return { error: "Client name is required" };
  }

  const name = body.name.trim();

  if (name.length < 2) {
    return { error: "Client name must be at least 2 characters" };
  }

  if (name.length > 255) {
    return { error: "Client name must not exceed 255 characters" };
  }

  return name;
}

export function readClientStatus(
  body: Partial<UpdateClientStatusRequest>,
): ClientAccessStatus | { error: string } {
  if (body.accessStatus !== "active" && body.accessStatus !== "disabled") {
    return { error: "Access status must be active or disabled" };
  }

  return body.accessStatus;
}
