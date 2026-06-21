import type {
  ClientHeartbeatRequest,
  RegisterClientRequest,
} from "../../../shared/clientContracts.js";

export function readRegistrationBody(
  body: Partial<RegisterClientRequest>,
): RegisterClientRequest | string {
  if (typeof body.enrollmentToken !== "string" || body.enrollmentToken.length < 32) {
    return "A valid enrollment token is required";
  }

  if (body.enrollmentToken.length > 512) {
    return "Enrollment token is too long";
  }

  if (typeof body.name !== "string" || body.name.trim().length < 2) {
    return "Client name must be at least 2 characters";
  }

  const name = body.name.trim();

  if (name.length > 255) {
    return "Client name must not exceed 255 characters";
  }

  const softwareVersion = readOptionalText(body.softwareVersion, 64, "Software version");

  if ("error" in softwareVersion) {
    return softwareVersion.error;
  }

  return {
    enrollmentToken: body.enrollmentToken,
    name,
    ...(softwareVersion.value ? { softwareVersion: softwareVersion.value } : {}),
  };
}

export function readHeartbeatBody(
  body: Partial<ClientHeartbeatRequest>,
): ClientHeartbeatRequest | string {
  const currentManifestId = readNullableText(body.currentManifestId, 64, "Current manifest id");

  if ("error" in currentManifestId) {
    return currentManifestId.error;
  }

  if (
    body.currentManifestVersion !== undefined &&
    body.currentManifestVersion !== null &&
    (!Number.isSafeInteger(body.currentManifestVersion) || body.currentManifestVersion < 0)
  ) {
    return "Current manifest version must be a non-negative integer or null";
  }

  const softwareVersion = readOptionalText(body.softwareVersion, 64, "Software version");
  const lastSyncResult = readNullableText(body.lastSyncResult, 255, "Last sync result");
  const lastError = readNullableText(body.lastError, 4000, "Last error");

  if ("error" in softwareVersion) {
    return softwareVersion.error;
  }

  if ("error" in lastSyncResult) {
    return lastSyncResult.error;
  }

  if ("error" in lastError) {
    return lastError.error;
  }

  return {
    currentManifestId: currentManifestId.value,
    currentManifestVersion: body.currentManifestVersion,
    lastError: lastError.value,
    lastSyncResult: lastSyncResult.value,
    ...(softwareVersion.value ? { softwareVersion: softwareVersion.value } : {}),
  };
}

type TextValidationResult<T> =
  | {
      error: string;
    }
  | {
      value: T;
    };

function readOptionalText(
  value: unknown,
  maxLength: number,
  label: string,
): TextValidationResult<string | undefined> {
  if (value === undefined) {
    return { value: undefined };
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return { error: `${label} must be a non-empty string` };
  }

  const normalizedValue = value.trim();

  return normalizedValue.length <= maxLength
    ? { value: normalizedValue }
    : { error: `${label} must not exceed ${maxLength} characters` };
}

function readNullableText(
  value: unknown,
  maxLength: number,
  label: string,
): TextValidationResult<string | null | undefined> {
  if (value === undefined) {
    return { value: undefined };
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { error: `${label} must be a string or null` };
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    return { error: `${label} must not exceed ${maxLength} characters` };
  }

  return { value: normalizedValue || null };
}
