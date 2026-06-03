import type { ReactNode } from "react";

import type { AdminUser } from "../../../shared/adminContracts";

export type AdminScreen = "assets" | "dashboard" | "users";

interface AdminShellProps {
  activeScreen: AdminScreen;
  apiStatus: "checking" | "ok" | "error";
  children: ReactNode;
  currentUser: AdminUser;
  onLogout: () => void;
  onScreenChange: (screen: AdminScreen) => void;
}

export function AdminShell({
  activeScreen,
  apiStatus,
  children,
  currentUser,
  onLogout,
  onScreenChange,
}: AdminShellProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Epi Info Admin</h1>
          <span>{currentUser.email}</span>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${apiStatus}`}>API {apiStatus}</span>
          <button className="secondary-button" onClick={onLogout} type="button">
            Log out
          </button>
        </div>
      </header>

      <nav className="admin-nav" aria-label="Admin sections">
        <button
          className={activeScreen === "dashboard" ? "active" : ""}
          onClick={() => onScreenChange("dashboard")}
          type="button"
        >
          Dashboard
        </button>
        <button
          className={activeScreen === "users" ? "active" : ""}
          onClick={() => onScreenChange("users")}
          type="button"
        >
          Users
        </button>
        <button
          className={activeScreen === "assets" ? "active" : ""}
          onClick={() => onScreenChange("assets")}
          type="button"
        >
          Assets
        </button>
      </nav>

      {children}
    </main>
  );
}
