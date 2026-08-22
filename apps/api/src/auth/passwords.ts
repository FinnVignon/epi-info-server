import bcrypt from "bcryptjs";

export interface PasswordHashOptions {
  bcryptRounds: number;
}

export async function hashAdminPassword(
  password: string,
  options: PasswordHashOptions,
): Promise<string> {
  return bcrypt.hash(password, options.bcryptRounds);
}

export async function verifyAdminPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
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
