import type {
  AdminAuthResponse,
  BootstrapAdminRequest,
  BootstrapStatusResponse,
  LoginAdminRequest,
} from "../../../shared/adminContracts";
import type { DashboardResponse, HealthResponse } from "../../../shared/dashboardContracts";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = response.status === 204 ? null : ((await response.json()) as unknown);

  if (!response.ok) {
    const error =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : "Requête échouée";

    throw new ApiError(error, response.status);
  }

  return body as T;
}

export async function bootstrapAdmin(request: BootstrapAdminRequest): Promise<AdminAuthResponse> {
  return readJsonResponse<AdminAuthResponse>(
    await fetch("/api/admin/bootstrap", {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
}

export async function getBootstrapStatus(): Promise<BootstrapStatusResponse> {
  return readJsonResponse<BootstrapStatusResponse>(await fetch("/api/admin/bootstrap/status"));
}

export async function getCurrentAdminSession(): Promise<AdminAuthResponse | null> {
  const response = await fetch("/api/admin/me");

  if (response.status === 401) {
    return null;
  }

  return readJsonResponse<AdminAuthResponse>(response);
}

export async function loadDashboardData(): Promise<{
  dashboard: DashboardResponse;
  health: HealthResponse;
}> {
  const [healthResponse, dashboardResponse] = await Promise.all([
    fetch("/api/health"),
    fetch("/api/dashboard"),
  ]);
  const [health, dashboard] = await Promise.all([
    readJsonResponse<HealthResponse>(healthResponse),
    readJsonResponse<DashboardResponse>(dashboardResponse),
  ]);

  return {
    dashboard,
    health,
  };
}

export async function loginAdmin(request: LoginAdminRequest): Promise<AdminAuthResponse> {
  return readJsonResponse<AdminAuthResponse>(
    await fetch("/api/admin/login", {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
}

export async function logoutAdmin(): Promise<void> {
  await readJsonResponse<void>(
    await fetch("/api/admin/logout", {
      method: "POST",
    }),
  );
}
