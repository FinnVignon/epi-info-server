import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_SHA256_PREFIX = "epi-info:bcrypt-sha256:";

export interface PasswordHashOptions {
  bcryptRounds: number;
}

export async function hashAdminPassword(
  password: string,
  options: PasswordHashOptions,
): Promise<string> {
  const passwordHash = await bcrypt.hash(deriveBcryptInput(password), options.bcryptRounds);

  return `${BCRYPT_SHA256_PREFIX}${passwordHash}`;
}

export async function verifyAdminPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (passwordHash.startsWith(BCRYPT_SHA256_PREFIX)) {
    return bcrypt.compare(
      deriveBcryptInput(password),
      passwordHash.slice(BCRYPT_SHA256_PREFIX.length),
    );
  }

  return bcrypt.compare(password, passwordHash);
}

export function adminPasswordHashNeedsUpgrade(passwordHash: string, bcryptRounds: number): boolean {
  if (!passwordHash.startsWith(BCRYPT_SHA256_PREFIX)) {
    return true;
  }

  try {
    return bcrypt.getRounds(passwordHash.slice(BCRYPT_SHA256_PREFIX.length)) !== bcryptRounds;
  } catch {
    return true;
  }
}

export function readAdminPasswordValidationError(password: string): string | null {
  if (password.length < 10) {
    return "Password must be at least 10 characters";
  }

  if (bcrypt.truncates(password)) {
    return "Password must not exceed 72 bytes when encoded as UTF-8";
  }

  return null;
}

function deriveBcryptInput(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("base64url");
}
