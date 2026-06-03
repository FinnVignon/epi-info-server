import { useEffect, useState } from "react";

import {
  formatPermissionActions,
  formatPermissionTarget,
  PermissionEditor,
} from "./PermissionEditor";
import { formatDate, permissionToGrant } from "../utils/adminPermissions";
import type {
  AdminPermissionGrant,
  AdminUserWithPermissions,
} from "../../../shared/adminContracts";

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
  const [displayName, setDisplayName] = useState("");
  const [resetPassword, setResetPassword] = useState("");

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
        <p className="metric">Select a user.</p>
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
          {user.status === "active" ? "Disable" : "Enable"}
        </button>
      </div>

      <div className="detail-grid">
        <p>
          <span>Status</span>
          <strong>{user.status}</strong>
        </p>
        <p>
          <span>Super admin</span>
          <strong>{user.isSuperAdmin ? "Yes" : "No"}</strong>
        </p>
        <p>
          <span>Last login</span>
          <strong>{formatDate(user.lastLoginAt)}</strong>
        </p>
      </div>

      <form
        className="form-grid compact-form"
        onSubmit={(event) => void handleUpdateProfile(event)}
      >
        <label>
          <span>Display name</span>
          <input
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <button className="secondary-button" type="submit">
          Save name
        </button>
      </form>

      <form
        className="form-grid compact-form"
        onSubmit={(event) => void handleResetPassword(event)}
      >
        <label>
          <span>New password</span>
          <input
            minLength={10}
            onChange={(event) => setResetPassword(event.target.value)}
            required
            type="password"
            value={resetPassword}
          />
        </label>
        <button className="secondary-button" type="submit">
          Reset password
        </button>
      </form>

      <section className="section-block">
        <div className="panel-header">
          <h3>Permissions</h3>
          <button
            className="secondary-button"
            disabled={isSavingPermissions || user.isSuperAdmin}
            onClick={onSavePermissions}
            type="button"
          >
            {isSavingPermissions ? "Saving" : "Save permissions"}
          </button>
        </div>
        {user.isSuperAdmin ? (
          <p className="metric">Super admins have all permissions.</p>
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
          <h3>Current Grants</h3>
          <ul className="permission-list readonly">
            {user.permissions.map((permission) => {
              const grant = permissionToGrant(permission);

              return (
                <li key={`${grant.targetType}:${grant.targetId ?? "global"}`}>
                  <div>
                    <span>{formatPermissionTarget(grant)}</span>
                    <small>{formatPermissionActions(grant.actions)}</small>
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
