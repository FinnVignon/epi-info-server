import { randomBytes } from "node:crypto";

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8;
const USER_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export function createClientPairingDeviceCode(): string {
  return randomBytes(32).toString("base64url");
}

export function createClientPairingUserCode(): string {
  const bytes = randomBytes(USER_CODE_LENGTH);
  let code = "";

  for (const byte of bytes) {
    code += USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
  }

  return formatClientPairingUserCode(code);
}

export function normalizeClientPairingUserCode(value: string): string | null {
  const normalized = value.toUpperCase().replace(/[\s-]/g, "");

  return USER_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function formatClientPairingUserCode(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}
