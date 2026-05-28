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

export function isValidAdminPassword(password: string): boolean {
  return password.length >= 10;
}
