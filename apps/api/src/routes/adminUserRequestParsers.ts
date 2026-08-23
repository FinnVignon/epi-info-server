import { isValidAdminEmail, normalizeAdminEmail } from "../auth/adminCredentials.js";
import { readAdminPasswordValidationError } from "../auth/passwords.js";
import type {
  AdminUser,
  CreateAdminUserRequest,
  ResetAdminUserPasswordRequest,
  UpdateAdminUserProfileRequest,
  UpdateAdminUserStatusRequest,
} from "../../../shared/adminContracts.js";
import {
  readAccountTypePermissionError,
  readPermissionGrants,
} from "./adminUserPermissionParsers.js";

export interface UserRouteParams {
  userId?: string;
}

export function readUserId(params: UserRouteParams): string | null {
  return typeof params.userId === "string" && params.userId.length > 0 ? params.userId : null;
}

export function readCreateUserBody(
  body: Partial<CreateAdminUserRequest>,
): CreateAdminUserRequest | string {
  if (
    (body.accountType !== "admin" && body.accountType !== "user") ||
    typeof body.displayName !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return "Account type, display name, email, and password are required";
  }

  const displayName = body.displayName.trim();
  const email = normalizeAdminEmail(body.email);

  if (displayName.length < 2) {
    return "Display name must be at least 2 characters";
  }

  if (displayName.length > 255) {
    return "Display name must not exceed 255 characters";
  }

  if (!isValidAdminEmail(email)) {
    return "A valid email is required";
  }

  const passwordError = readAdminPasswordValidationError(body.password);

  if (passwordError) {
    return passwordError;
  }

  const permissions = readPermissionGrants(body.permissions ?? []);

  if (typeof permissions === "string") {
    return permissions;
  }

  const accountTypeError = readAccountTypePermissionError(body.accountType, permissions);

  if (accountTypeError) {
    return accountTypeError;
  }

  return {
    accountType: body.accountType,
    displayName,
    email,
    password: body.password,
    permissions,
  };
}

export function readPasswordBody(
  body: Partial<ResetAdminUserPasswordRequest>,
): { password: string } | string {
  if (typeof body.password !== "string") {
    return "Password is required";
  }

  const passwordError = readAdminPasswordValidationError(body.password);

  if (passwordError) {
    return passwordError;
  }

  return {
    password: body.password,
  };
}

export function readProfileBody(
  body: Partial<UpdateAdminUserProfileRequest>,
): { displayName: string } | string {
  if (typeof body.displayName !== "string") {
    return "Display name is required";
  }

  const displayName = body.displayName.trim();

  if (displayName.length < 2) {
    return "Display name must be at least 2 characters";
  }

  if (displayName.length > 255) {
    return "Display name must not exceed 255 characters";
  }

  return {
    displayName,
  };
}

export function readStatusBody(
  body: Partial<UpdateAdminUserStatusRequest>,
): { status: AdminUser["status"] } | string {
  if (body.status !== "active" && body.status !== "disabled") {
    return "Status must be active or disabled";
  }

  return {
    status: body.status,
  };
}
