import { useEffect, useState } from "react";

import {
  ApiError,
  getBootstrapStatus,
  getCurrentAdminSession,
  loadDashboardData,
  logoutAdmin,
} from "./api/adminApi";
import { AdminClientsScreen } from "./components/AdminClientsScreen";
import { AdminContentScreen } from "./components/AdminContentScreen";
import { AdminDashboard } from "./components/AdminDashboard";
import { AdminDisplayScreen } from "./components/AdminDisplayScreen";
import { AdminGroupsScreen } from "./components/AdminGroupsScreen";
import { AdminShell } from "./components/AdminShell";
import type { AdminScreen } from "./components/AdminShell";
import { AdminSettingsScreen } from "./components/AdminSettingsScreen";
import { AdminUsersScreen } from "./components/AdminUsersScreen";
import { AuthScreen } from "./components/AuthScreen";
import { LoadingScreen } from "./components/LoadingScreen";
import { useTranslation } from "./i18n";
import type { AdminAccess, AdminAuthResponse, AdminUser } from "../../shared/adminContracts";
import type { DashboardResponse, HealthResponse } from "../../shared/dashboardContracts";
import "./App.css";

type ApiStatus = "checking" | "ok" | "error";
type AuthMode = "checking" | "bootstrap" | "login" | "authenticated";

export function App() {
  const { t } = useTranslation();
  const [activeScreen, setActiveScreen] = useState<AdminScreen>("dashboard");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [currentAccess, setCurrentAccess] = useState<AdminAccess | null>(null);
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
          setCurrentAccess(session.access);
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
          setAuthError(error instanceof Error ? error.message : t.auth.sessionError);
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
          handleSessionExpired();
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
    setCurrentAccess(response.access);
    setCurrentUser(response.user);
    setAuthMode("authenticated");
  }

  function handleSessionExpired(): void {
    setCurrentAccess(null);
    setCurrentUser(null);
    setDashboard(null);
    setHealth(null);
    setApiStatus("checking");
    setActiveScreen("dashboard");
    setAuthMode("login");
  }

  async function handleLogout(): Promise<void> {
    try {
      await logoutAdmin();
    } finally {
      setCurrentAccess(null);
      setCurrentUser(null);
      setDashboard(null);
      setHealth(null);
      setApiStatus("checking");
      setActiveScreen("dashboard");
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

  if (authMode === "authenticated" && currentAccess && currentUser) {
    return (
      <AdminShell
        access={currentAccess}
        activeScreen={activeScreen}
        apiStatus={apiStatus}
        currentUser={currentUser}
        onLogout={() => void handleLogout()}
        onScreenChange={setActiveScreen}
      >
        {renderAdminScreen(activeScreen, {
          currentUser,
          access: currentAccess,
          dashboard,
          health,
          apiStatus,
          onNavigate: setActiveScreen,
          onUnauthorized: handleSessionExpired,
        })}
      </AdminShell>
    );
  }

  return <LoadingScreen />;
}

interface AdminScreenRenderState {
  access: AdminAccess;
  apiStatus: ApiStatus;
  currentUser: AdminUser;
  dashboard: DashboardResponse | null;
  health: HealthResponse | null;
  onNavigate: (screen: AdminScreen) => void;
  onUnauthorized: () => void;
}

function renderAdminScreen(activeScreen: AdminScreen, state: AdminScreenRenderState) {
  switch (activeScreen) {
    case "content":
      return (
        <AdminContentScreen currentUser={state.currentUser} onUnauthorized={state.onUnauthorized} />
      );
    case "screens":
      return <AdminClientsScreen onUnauthorized={state.onUnauthorized} />;
    case "dashboard":
      return (
        <AdminDashboard
          access={state.access}
          dashboard={state.dashboard}
          onNavigate={state.onNavigate}
        />
      );
    case "display":
      return <AdminDisplayScreen access={state.access} onUnauthorized={state.onUnauthorized} />;
    case "groups":
      return <AdminGroupsScreen onUnauthorized={state.onUnauthorized} />;
    case "settings":
      return (
        <AdminSettingsScreen
          access={state.access}
          apiStatus={state.apiStatus}
          currentUser={state.currentUser}
          health={state.health}
        />
      );
    case "users":
      return (
        <AdminUsersScreen currentUser={state.currentUser} onUnauthorized={state.onUnauthorized} />
      );
  }
}

async function resolveLoggedOutMode(): Promise<"bootstrap" | "login"> {
  const bootstrapStatus = await getBootstrapStatus();

  return bootstrapStatus.needsBootstrap ? "bootstrap" : "login";
}
