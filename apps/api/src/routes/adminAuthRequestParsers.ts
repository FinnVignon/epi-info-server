import { isValidAdminEmail, normalizeAdminEmail } from "../auth/adminCredentials.js";
import { readAdminPasswordValidationError } from "../auth/passwords.js";

export interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export interface BootstrapBody extends LoginBody {
  displayName?: unknown;
}

export function readLoginBody(body: LoginBody): { email: string; password: string } | string {
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return "Email and password are required";
  }

  const email = normalizeAdminEmail(body.email);

  if (!isValidAdminEmail(email)) {
    return "A valid email is required";
  }

  if (body.password.length === 0) {
    return "Password is required";
  }

  return {
    email,
    password: body.password,
  };
}

export function readBootstrapBody(
  body: BootstrapBody,
): { displayName: string; email: string; password: string } | string {
  const loginBody = readLoginBody(body);

  if (typeof loginBody === "string") {
    return loginBody;
  }

  const passwordError = readAdminPasswordValidationError(loginBody.password);

  if (passwordError) {
    return passwordError;
  }

  if (typeof body.displayName !== "string" || body.displayName.trim().length < 2) {
    return "Display name must be at least 2 characters";
  }

  if (body.displayName.trim().length > 255) {
    return "Display name must not exceed 255 characters";
  }

  return {
    ...loginBody,
    displayName: body.displayName.trim(),
  };
}
