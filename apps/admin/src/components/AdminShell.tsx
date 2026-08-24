import { Languages, LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AdminNavigation } from "./AdminNavigation";
import type { AdminAccess, AdminUser } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

export type AdminScreen =
  | "content"
  | "dashboard"
  | "display"
  | "groups"
  | "screens"
  | "settings"
  | "users";

interface AdminShellProps {
  access: AdminAccess;
  activeScreen: AdminScreen;
  apiStatus: "checking" | "ok" | "error";
  children: ReactNode;
  currentUser: AdminUser;
  onLogout: () => void;
  onScreenChange: (screen: AdminScreen) => void;
}

export function AdminShell({
  access,
  activeScreen,
  apiStatus,
  children,
  currentUser,
  onLogout,
  onScreenChange,
}: AdminShellProps) {
  const { t, lang, setLang } = useTranslation();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  function handleNavigate(screen: AdminScreen): void {
    onScreenChange(screen);
    setIsNavigationOpen(false);
  }

  return (
    <main className="app-shell">
      <aside className={`admin-sidebar ${isNavigationOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            EI
          </span>
          <div>
            <strong>{t.brand}</strong>
            <span>{t.shell.controlPanel}</span>
          </div>
          <button
            aria-label={t.nav.closeMenu}
            className="icon-button sidebar-close"
            onClick={() => setIsNavigationOpen(false)}
            title={t.nav.closeMenu}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <AdminNavigation access={access} activeScreen={activeScreen} onNavigate={handleNavigate} />

        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">
            {getInitials(currentUser.displayName)}
          </span>
          <div>
            <strong>{currentUser.displayName}</strong>
            <span>{currentUser.email}</span>
          </div>
        </div>
      </aside>

      {isNavigationOpen ? (
        <button
          aria-label={t.nav.closeMenu}
          className="navigation-backdrop"
          onClick={() => setIsNavigationOpen(false)}
          type="button"
        />
      ) : null}

      <div className="admin-workspace">
        <header className="topbar">
          <button
            aria-label={t.nav.openMenu}
            className="icon-button mobile-menu"
            onClick={() => setIsNavigationOpen(true)}
            title={t.nav.openMenu}
            type="button"
          >
            <Menu aria-hidden="true" size={20} />
          </button>

          <div className="page-heading">
            <h1>{getScreenTitle(activeScreen, t.nav)}</h1>
          </div>

          <div className="topbar-actions">
            <span className={`api-indicator ${apiStatus}`}>
              <span aria-hidden="true" />
              API {t.apiStatus[apiStatus]}
            </span>
            <button
              aria-label={t.nav.changeLanguage}
              className="icon-button"
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              title={t.nav.changeLanguage}
              type="button"
            >
              <Languages aria-hidden="true" size={18} />
              <span className="icon-button-label">{lang.toUpperCase()}</span>
            </button>
            <button
              aria-label={t.nav.logout}
              className="icon-button"
              onClick={onLogout}
              title={t.nav.logout}
              type="button"
            >
              <LogOut aria-hidden="true" size={18} />
              <span className="icon-button-label">{t.nav.logout}</span>
            </button>
          </div>
        </header>

        <div className="admin-page">{children}</div>
      </div>
    </main>
  );
}

function getInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getScreenTitle(
  screen: AdminScreen,
  navigation: ReturnType<typeof useTranslation>["t"]["nav"],
): string {
  switch (screen) {
    case "content":
      return navigation.content;
    case "dashboard":
      return navigation.dashboard;
    case "display":
      return navigation.display;
    case "groups":
      return navigation.groups;
    case "screens":
      return navigation.screens;
    case "settings":
      return navigation.settings;
    case "users":
      return navigation.users;
  }
}
