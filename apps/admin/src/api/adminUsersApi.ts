import type {
  AdminUserListResponse,
  AdminUserResponse,
  CreateAdminUserRequest,
  ReplaceAdminUserPermissionsRequest,
  ResetAdminUserPasswordRequest,
  UpdateAdminUserProfileRequest,
  UpdateAdminUserStatusRequest,
} from "../../../shared/adminContracts";
import { readJsonResponse } from "./adminApi";

export async function createAdminUser(request: CreateAdminUserRequest): Promise<AdminUserResponse> {
  return readJsonResponse<AdminUserResponse>(
    await fetch("/api/admin/users", {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
}

export async function listAdminUsers(): Promise<AdminUserListResponse> {
  return readJsonResponse<AdminUserListResponse>(await fetch("/api/admin/users"));
}

export async function replaceAdminUserPermissions(
  userId: string,
  request: ReplaceAdminUserPermissionsRequest,
): Promise<AdminUserResponse> {
  return readJsonResponse<AdminUserResponse>(
    await fetch(`/api/admin/users/${encodeURIComponent(userId)}/permissions`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    }),
  );
}

export async function resetAdminUserPassword(
  userId: string,
  request: ResetAdminUserPasswordRequest,
): Promise<void> {
  await readJsonResponse<void>(
    await fetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
}

export async function updateAdminUserProfile(
  userId: string,
  request: UpdateAdminUserProfileRequest,
): Promise<AdminUserResponse> {
  return readJsonResponse<AdminUserResponse>(
    await fetch(`/api/admin/users/${encodeURIComponent(userId)}/profile`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }),
  );
}

export async function updateAdminUserStatus(
  userId: string,
  request: UpdateAdminUserStatusRequest,
): Promise<AdminUserResponse> {
  return readJsonResponse<AdminUserResponse>(
    await fetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }),
  );
}
