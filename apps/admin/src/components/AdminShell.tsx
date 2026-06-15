import type { ReactNode } from "react";

import type { AdminUser } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

export type AdminScreen = "assets" | "clients" | "dashboard" | "global" | "groups" | "users";

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
  const { t, lang, setLang } = useTranslation();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>{t.brand}</h1>
          <span>{currentUser.email}</span>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${apiStatus}`}>API {t.apiStatus[apiStatus]}</span>
          <button
            className="secondary-button"
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            type="button"
          >
            {lang === "fr" ? "🇬🇧 EN" : "🇫🇷 FR"}
          </button>
          <button className="secondary-button" onClick={onLogout} type="button">
            {t.nav.logout}
          </button>
        </div>
      </header>

      <nav className="admin-nav" aria-label={t.nav.sections}>
        <button
          className={activeScreen === "dashboard" ? "active" : ""}
          onClick={() => onScreenChange("dashboard")}
          type="button"
        >
          {t.nav.dashboard}
        </button>
        <button
          className={activeScreen === "global" ? "active" : ""}
          onClick={() => onScreenChange("global")}
          type="button"
        >
          {t.nav.global}
        </button>
        <button
          className={activeScreen === "users" ? "active" : ""}
          onClick={() => onScreenChange("users")}
          type="button"
        >
          {t.nav.users}
        </button>
        <button
          className={activeScreen === "assets" ? "active" : ""}
          onClick={() => onScreenChange("assets")}
          type="button"
        >
          {t.nav.assets}
        </button>
        <button
          className={activeScreen === "clients" ? "active" : ""}
          onClick={() => onScreenChange("clients")}
          type="button"
        >
          {t.nav.clients}
        </button>
        <button
          className={activeScreen === "groups" ? "active" : ""}
          onClick={() => onScreenChange("groups")}
          type="button"
        >
          {t.nav.groups}
        </button>
      </nav>

      {children}
    </main>
  );
}
