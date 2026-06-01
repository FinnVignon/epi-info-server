export interface AdminUser {
  createdAt: string;
  displayName: string;
  email: string;
  id: string;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  status: "active" | "disabled";
  updatedAt: string;
}

export interface AdminSessionSummary {
  expiresAt: string;
  id?: string;
}

export interface AdminAuthResponse {
  session: AdminSessionSummary;
  user: AdminUser;
}

export interface BootstrapAdminRequest {
  displayName: string;
  email: string;
  password: string;
}

export interface BootstrapStatusResponse {
  needsBootstrap: boolean;
}

export interface LoginAdminRequest {
  email: string;
  password: string;
}
