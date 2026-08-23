import {
  Boxes,
  LayoutDashboard,
  Monitor,
  MonitorPlay,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { AdminScreen } from "./AdminShell";
import type { AdminAccess } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

interface AdminNavigationProps {
  access: AdminAccess;
  activeScreen: AdminScreen;
  onNavigate: (screen: AdminScreen) => void;
}

interface NavigationItem {
  icon: LucideIcon;
  id: AdminScreen;
  label: string;
}

interface NavigationSection {
  items: NavigationItem[];
  label: string;
}

export function AdminNavigation({ access, activeScreen, onNavigate }: AdminNavigationProps) {
  const { t } = useTranslation();
  const canDisplay =
    access.canAssignAllScreens || access.canAssignGroups || access.canAssignScreens;
  const administrationItems: NavigationItem[] = [
    ...(access.canManageScreens
      ? [{ icon: Monitor, id: "screens" as const, label: t.nav.screens }]
      : []),
    ...(access.canManageGroups
      ? [{ icon: UsersRound, id: "groups" as const, label: t.nav.groups }]
      : []),
    ...(access.canManageUsers ? [{ icon: Users, id: "users" as const, label: t.nav.users }] : []),
  ];
  const sections: NavigationSection[] = [
    {
      items: [
        { icon: LayoutDashboard, id: "dashboard", label: t.nav.dashboard },
        ...(canDisplay
          ? [{ icon: MonitorPlay, id: "display" as const, label: t.nav.display }]
          : []),
        ...(access.canManageContent
          ? [{ icon: Boxes, id: "content" as const, label: t.nav.content }]
          : []),
      ],
      label: t.nav.workspace,
    },
    ...(administrationItems.length
      ? [{ items: administrationItems, label: t.nav.administration }]
      : []),
    {
      items: [{ icon: Settings, id: "settings", label: t.nav.settings }],
      label: t.nav.preferences,
    },
  ];

  return (
    <nav className="admin-nav" aria-label={t.nav.sections}>
      {sections.map((section) => (
        <div className="admin-nav-section" key={section.label}>
          <span className="admin-nav-label">{section.label}</span>
          {section.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeScreen === item.id;

            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "active" : ""}
                key={item.id}
                onClick={() => onNavigate(item.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
