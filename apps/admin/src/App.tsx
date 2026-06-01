import { useEffect, useState } from "react";

import {
  ApiError,
  getBootstrapStatus,
  getCurrentAdminSession,
  loadDashboardData,
  logoutAdmin,
} from "./api/adminApi";
import { AdminDashboard } from "./components/AdminDashboard";
import { AuthScreen } from "./components/AuthScreen";
import { LoadingScreen } from "./components/LoadingScreen";
import type { AdminAuthResponse, AdminUser } from "../../shared/adminContracts";
import type { DashboardResponse, HealthResponse } from "../../shared/dashboardContracts";
import "./App.css";

type ApiStatus = "checking" | "ok" | "error";
type AuthMode = "checking" | "bootstrap" | "login" | "authenticated";

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const session = await getCurrentAdminSession();

        if (cancelled) {
          return;
        }

        if (session) {
          setCurrentUser(session.user);
          setAuthMode("authenticated");
          return;
        }

        const loggedOutMode = await resolveLoggedOutMode();

        if (!cancelled) {
          setAuthMode(loggedOutMode);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : "Unable to check admin session");
          setAuthMode("login");
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authMode !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function refreshDashboard() {
      try {
        const data = await loadDashboardData();

        if (!cancelled) {
          setDashboard(data.dashboard);
          setHealth(data.health);
          setApiStatus("ok");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          setCurrentUser(null);
          setAuthMode("login");
          return;
        }

        setApiStatus("error");
      }
    }

    void refreshDashboard();

    return () => {
      cancelled = true;
    };
  }, [authMode]);

  function handleAuthenticated(response: AdminAuthResponse): void {
    setAuthError(null);
    setCurrentUser(response.user);
    setAuthMode("authenticated");
  }

  async function handleLogout(): Promise<void> {
    try {
      await logoutAdmin();
    } finally {
      setCurrentUser(null);
      setDashboard(null);
      setHealth(null);
      setApiStatus("checking");
      setAuthMode(await resolveLoggedOutMode());
    }
  }

  if (authMode === "bootstrap" || authMode === "login") {
    return (
      <AuthScreen
        error={authError}
        mode={authMode}
        onAuthenticated={handleAuthenticated}
        onError={setAuthError}
      />
    );
  }

  if (authMode === "authenticated" && currentUser) {
    return (
      <AdminDashboard
        apiStatus={apiStatus}
        currentUser={currentUser}
        dashboard={dashboard}
        health={health}
        onLogout={() => void handleLogout()}
      />
    );
  }

  return <LoadingScreen />;
}

async function resolveLoggedOutMode(): Promise<"bootstrap" | "login"> {
  const bootstrapStatus = await getBootstrapStatus();

  return bootstrapStatus.needsBootstrap ? "bootstrap" : "login";
}
