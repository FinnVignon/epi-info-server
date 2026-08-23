import { useEffect, useState } from "react";

import { formatPermissionTarget, PermissionEditor } from "./PermissionEditor";
import { permissionToGrant } from "../utils/adminPermissions";
import { getAdminUserAccountType } from "../utils/adminAccountType";
import { formatDate } from "../utils/formatDate";
import type {
  AdminPermissionGrant,
  AdminUserWithPermissions,
} from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

interface AdminUserDetailProps {
  currentUserId: string;
  isSavingPermissions: boolean;
  onPermissionDraftChange: (permissions: AdminPermissionGrant[]) => void;
  onResetPassword: (password: string) => Promise<boolean>;
  onSavePermissions: () => void;
  onStatusChange: (user: AdminUserWithPermissions) => void;
  onUpdateProfile: (displayName: string) => Promise<boolean>;
  permissionDraft: AdminPermissionGrant[];
  user: AdminUserWithPermissions | null;
}

export function AdminUserDetail({
  currentUserId,
  isSavingPermissions,
  onPermissionDraftChange,
  onResetPassword,
  onSavePermissions,
  onStatusChange,
  onUpdateProfile,
  permissionDraft,
  user,
}: AdminUserDetailProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const ACTION_LABELS: Record<string, string> = {
    manage_users: t.permissions.actionUsers,
    manage_clients: t.permissions.actionClients,
    manage_groups: t.permissions.actionGroups,
    manage_content: t.permissions.actionContent,
    manage_assignments: t.permissions.actionAssignments,
  };

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.id, user?.displayName]);

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (await onResetPassword(resetPassword)) {
      setResetPassword("");
    }
  }

  async function handleUpdateProfile(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await onUpdateProfile(displayName);
  }

  if (!user) {
    return (
      <article className="panel users-detail-panel">
        <p className="metric">{t.users.selectUser}</p>
      </article>
    );
  }

  return (
    <article className="panel users-detail-panel">
      <div className="panel-header">
        <div>
          <h2>{user.displayName}</h2>
          <p className="metric">{user.email}</p>
        </div>
        <button
          className="secondary-button"
          disabled={user.id === currentUserId}
          onClick={() => onStatusChange(user)}
          type="button"
        >
          {user.status === "active" ? t.users.disable : t.users.enable}
        </button>
      </div>

      <div className="detail-grid">
        <p>
          <span>{t.users.statusLabel}</span>
          <strong>
            {user.status === "active" ? t.users.statusActive : t.users.statusInactive}
          </strong>
        </p>
        <p>
          <span>{t.users.accountType}</span>
          <strong>{formatAccountType(user, t.accountTypes)}</strong>
        </p>
        <p>
          <span>{t.users.lastLogin}</span>
          <strong>{formatDate(user.lastLoginAt, t.users.never)}</strong>
        </p>
      </div>

      <form
        className="form-grid compact-form"
        onSubmit={(event) => void handleUpdateProfile(event)}
      >
        <label>
          <span>{t.users.displayNameLabel}</span>
          <input
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <button className="secondary-button" type="submit">
          {t.users.saveName}
        </button>
      </form>

      <form
        className="form-grid compact-form"
        onSubmit={(event) => void handleResetPassword(event)}
      >
        <label>
          <span>{t.users.newPassword}</span>
          <input
            minLength={10}
            onChange={(event) => setResetPassword(event.target.value)}
            required
            type="password"
            value={resetPassword}
          />
        </label>
        <button className="secondary-button" type="submit">
          {t.users.resetPassword}
        </button>
      </form>

      <section className="section-block">
        <div className="panel-header">
          <h3>{t.users.permissionsTitle}</h3>
          <button
            className="secondary-button"
            disabled={isSavingPermissions || user.isSuperAdmin}
            onClick={onSavePermissions}
            type="button"
          >
            {isSavingPermissions ? t.users.savingPermissions : t.users.savePermissions}
          </button>
        </div>
        {user.isSuperAdmin ? (
          <p className="metric">{t.users.superAdminAllPerms}</p>
        ) : (
          <PermissionEditor
            disabled={isSavingPermissions}
            onChange={onPermissionDraftChange}
            permissions={permissionDraft}
          />
        )}
      </section>

      {user.permissions.length ? (
        <section className="section-block">
          <h3>{t.users.currentGrants}</h3>
          <ul className="permission-list readonly">
            {user.permissions.map((permission) => {
              const grant = permissionToGrant(permission);
              return (
                <li key={`${grant.targetType}:${grant.targetId ?? "global"}`}>
                  <div>
                    <span>{formatPermissionTarget(grant, t)}</span>
                    <small>{grant.actions.map((a) => ACTION_LABELS[a] ?? a).join(", ")}</small>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function formatAccountType(
  user: AdminUserWithPermissions,
  labels: ReturnType<typeof useTranslation>["t"]["accountTypes"],
): string {
  switch (getAdminUserAccountType(user)) {
    case "admin":
      return labels.admin;
    case "super_admin":
      return labels.superAdmin;
    case "user":
      return labels.user;
  }
}
