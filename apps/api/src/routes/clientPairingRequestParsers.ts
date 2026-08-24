import { normalizeClientPairingUserCode } from "../auth/clientPairingCodes.js";
import type {
  ApproveClientPairingRequest,
  CreateClientPairingRequest,
} from "../../../shared/clientPairingContracts.js";

const DEVICE_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readCreatePairingBody(
  body: Partial<CreateClientPairingRequest>,
): CreateClientPairingRequest | string {
  const name = readRequiredText(body.name, 2, 255, "Screen name");

  if (typeof name !== "string") {
    return name.error;
  }

  const softwareVersion = readOptionalText(body.softwareVersion, 64, "Software version");

  if (typeof softwareVersion !== "string" && softwareVersion !== undefined) {
    return softwareVersion.error;
  }

  return { name, ...(softwareVersion ? { softwareVersion } : {}) };
}

export function readPairingDeviceCode(body: { deviceCode?: unknown }): string | null {
  return typeof body.deviceCode === "string" && DEVICE_CODE_PATTERN.test(body.deviceCode)
    ? body.deviceCode
    : null;
}

export function readPairingUserCode(body: { userCode?: unknown }): string | null {
  return typeof body.userCode === "string" ? normalizeClientPairingUserCode(body.userCode) : null;
}

export function readPairingApprovalBody(body: Partial<ApproveClientPairingRequest>):
  | (Required<Pick<ApproveClientPairingRequest, "name">> & {
      groupId: string | null;
    })
  | string {
  const name = readRequiredText(body.name, 2, 255, "Screen name");

  if (typeof name !== "string") {
    return name.error;
  }

  if (body.groupId !== undefined && body.groupId !== null) {
    if (typeof body.groupId !== "string" || body.groupId.length < 1 || body.groupId.length > 64) {
      return "Group id is invalid";
    }
  }

  return { groupId: body.groupId ?? null, name };
}

export function readPairingId(params: { pairingId?: unknown }): string | null {
  return typeof params.pairingId === "string" && params.pairingId.length <= 64
    ? params.pairingId
    : null;
}

type TextError = { error: string };

function readRequiredText(
  value: unknown,
  minLength: number,
  maxLength: number,
  label: string,
): string | TextError {
  if (typeof value !== "string") {
    return { error: `${label} is required` };
  }

  const normalized = value.trim();

  if (normalized.length < minLength || normalized.length > maxLength) {
    return { error: `${label} must be between ${minLength} and ${maxLength} characters` };
  }

  return normalized;
}

function readOptionalText(
  value: unknown,
  maxLength: number,
  label: string,
): string | TextError | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return { error: `${label} must be a non-empty string` };
  }

  const normalized = value.trim();

  return normalized.length <= maxLength
    ? normalized
    : { error: `${label} must not exceed ${maxLength} characters` };
}
