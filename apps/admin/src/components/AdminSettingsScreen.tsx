import { CheckCircle2, Languages, MonitorCog, Moon, Server, Sun, UserRound } from "lucide-react";

import type { AdminAccess, AdminUser } from "../../../shared/adminContracts";
import type { HealthResponse } from "../../../shared/dashboardContracts";
import { useTranslation } from "../i18n";
import { useTheme } from "../theme";

interface AdminSettingsScreenProps {
  access: AdminAccess;
  apiStatus: "checking" | "error" | "ok";
  currentUser: AdminUser;
  health: HealthResponse | null;
}

export function AdminSettingsScreen({
  access,
  apiStatus,
  currentUser,
  health,
}: AdminSettingsScreenProps) {
  const { lang, setLang, t } = useTranslation();
  const { preference, setPreference } = useTheme();

  return (
    <section className="content single-column settings-layout">
      <article className="panel settings-panel">
        <div className="panel-heading">
          <span className="panel-heading-icon">
            <Languages aria-hidden="true" size={18} />
          </span>
          <h2>{t.settings.languageTitle}</h2>
        </div>
        <div className="segmented-control" role="group" aria-label={t.settings.languageTitle}>
          <button
            aria-pressed={lang === "en"}
            className={lang === "en" ? "active" : ""}
            onClick={() => setLang("en")}
            type="button"
          >
            English
          </button>
          <button
            aria-pressed={lang === "fr"}
            className={lang === "fr" ? "active" : ""}
            onClick={() => setLang("fr")}
            type="button"
          >
            Français
          </button>
        </div>
      </article>

      <article className="panel settings-panel">
        <div className="panel-heading">
          <span className="panel-heading-icon">
            <Sun aria-hidden="true" size={18} />
          </span>
          <h2>{t.settings.appearanceTitle}</h2>
        </div>
        <div className="segmented-control theme-control" role="group" aria-label={t.settings.theme}>
          <ThemeButton
            active={preference === "light"}
            icon={Sun}
            label={t.settings.themeLight}
            onClick={() => setPreference("light")}
          />
          <ThemeButton
            active={preference === "dark"}
            icon={Moon}
            label={t.settings.themeDark}
            onClick={() => setPreference("dark")}
          />
          <ThemeButton
            active={preference === "system"}
            icon={MonitorCog}
            label={t.settings.themeSystem}
            onClick={() => setPreference("system")}
          />
        </div>
      </article>

      <article className="panel settings-panel">
        <div className="panel-heading">
          <span className="panel-heading-icon">
            <UserRound aria-hidden="true" size={18} />
          </span>
          <h2>{t.settings.accountTitle}</h2>
        </div>
        <dl className="settings-details">
          <div>
            <dt>{t.settings.displayName}</dt>
            <dd>{currentUser.displayName}</dd>
          </div>
          <div>
            <dt>{t.settings.email}</dt>
            <dd>{currentUser.email}</dd>
          </div>
          <div>
            <dt>{t.settings.access}</dt>
            <dd>{formatAccountType(access.accountType, t.accountTypes)}</dd>
          </div>
        </dl>
      </article>

      <article className="panel settings-panel">
        <div className="panel-heading">
          <span className="panel-heading-icon">
            <Server aria-hidden="true" size={18} />
          </span>
          <h2>{t.settings.systemTitle}</h2>
        </div>
        <dl className="settings-details">
          <div>
            <dt>{t.settings.api}</dt>
            <dd className={`inline-status ${apiStatus}`}>
              <CheckCircle2 aria-hidden="true" size={15} />
              {t.apiStatus[apiStatus]}
            </dd>
          </div>
          <div>
            <dt>{t.settings.service}</dt>
            <dd>{health?.service ?? t.common.unknown}</dd>
          </div>
          <div>
            <dt>{t.settings.database}</dt>
            <dd>{health?.database.status ?? t.common.unknown}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}

interface ThemeButtonProps {
  active: boolean;
  icon: typeof Sun;
  label: string;
  onClick: () => void;
}

function ThemeButton({ active, icon: Icon, label, onClick }: ThemeButtonProps) {
  return (
    <button
      aria-pressed={active}
      className={active ? "active" : ""}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={16} />
      {label}
    </button>
  );
}

function formatAccountType(
  accountType: AdminAccess["accountType"],
  labels: ReturnType<typeof useTranslation>["t"]["accountTypes"],
): string {
  switch (accountType) {
    case "admin":
      return labels.admin;
    case "super_admin":
      return labels.superAdmin;
    case "user":
      return labels.user;
  }
}
