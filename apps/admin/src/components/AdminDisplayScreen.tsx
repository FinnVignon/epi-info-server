import { Monitor, MonitorUp, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ClientAssignmentPanel } from "./ClientAssignmentPanel";
import { GlobalAssignmentPanel } from "./GlobalAssignmentPanel";
import { GroupAssignmentPanel } from "./GroupAssignmentPanel";
import type { AdminAccess } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

type DisplayTargetType = "all" | "group" | "screen";

interface AdminDisplayScreenProps {
  access: AdminAccess;
  onUnauthorized: () => void;
}

export function AdminDisplayScreen({ access, onUnauthorized }: AdminDisplayScreenProps) {
  const { t } = useTranslation();
  const availableTargets = useMemo(
    () => [
      ...(access.canAssignGroups
        ? [{ icon: UsersRound, id: "group" as const, label: t.display.groups }]
        : []),
      ...(access.canAssignScreens
        ? [{ icon: Monitor, id: "screen" as const, label: t.display.screens }]
        : []),
      ...(access.canAssignAllScreens
        ? [{ icon: MonitorUp, id: "all" as const, label: t.display.allScreens }]
        : []),
    ],
    [access, t],
  );
  const [targetType, setTargetType] = useState<DisplayTargetType>(
    availableTargets[0]?.id ?? "screen",
  );

  useEffect(() => {
    if (!availableTargets.some((target) => target.id === targetType)) {
      setTargetType(availableTargets[0]?.id ?? "screen");
    }
  }, [availableTargets, targetType]);

  if (availableTargets.length === 0) {
    return (
      <section className="content single-column display-layout">
        <article className="panel">
          <p className="metric">{t.display.unavailable}</p>
        </article>
      </section>
    );
  }

  return (
    <section className="content single-column display-layout">
      <div className="target-tabs" role="tablist" aria-label={t.display.targetType}>
        {availableTargets.map((target) => {
          const Icon = target.icon;

          return (
            <button
              aria-selected={targetType === target.id}
              className={targetType === target.id ? "active" : ""}
              key={target.id}
              onClick={() => setTargetType(target.id)}
              role="tab"
              type="button"
            >
              <Icon aria-hidden="true" size={18} />
              {target.label}
            </button>
          );
        })}
      </div>

      <div className="display-assignment-workspace" role="tabpanel">
        {targetType === "group" ? (
          <GroupAssignmentPanel onUnauthorized={onUnauthorized} preferredGroupId={null} />
        ) : null}
        {targetType === "screen" ? (
          <ClientAssignmentPanel onUnauthorized={onUnauthorized} preferredClientId={null} />
        ) : null}
        {targetType === "all" ? <GlobalAssignmentPanel onUnauthorized={onUnauthorized} /> : null}
      </div>
    </section>
  );
}
