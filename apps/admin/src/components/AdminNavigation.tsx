import {
  Boxes,
  LayoutDashboard,
  Monitor,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { AdminScreen } from "./AdminShell";
import type { AdminUser } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

interface AdminNavigationProps {
  activeScreen: AdminScreen;
  currentUser: AdminUser;
  onNavigate: (screen: AdminScreen) => void;
}

interface NavigationItem {
  icon: LucideIcon;
  id: AdminScreen;
  label: string;
}

export function AdminNavigation({ activeScreen, currentUser, onNavigate }: AdminNavigationProps) {
  const { t } = useTranslation();
  const items: NavigationItem[] = [
    { icon: LayoutDashboard, id: "dashboard", label: t.nav.dashboard },
    { icon: Monitor, id: "screens", label: t.nav.screens },
    { icon: UsersRound, id: "groups", label: t.nav.groups },
    { icon: Boxes, id: "content", label: t.nav.content },
    ...(currentUser.isSuperAdmin
      ? [{ icon: Users, id: "users" as const, label: t.nav.users }]
      : []),
    { icon: Settings, id: "settings", label: t.nav.settings },
  ];

  return (
    <nav className="admin-nav" aria-label={t.nav.sections}>
      {items.map((item) => {
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
    </nav>
  );
}
