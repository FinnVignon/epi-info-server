import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../api/adminApi";
import {
  createAdminUser,
  listAdminUsers,
  replaceAdminUserPermissions,
  resetAdminUserPassword,
  updateAdminUserProfile,
  updateAdminUserStatus,
} from "../api/adminUsersApi";
import { permissionToGrant } from "../utils/adminPermissions";
import { useTranslation } from "../i18n";
import { AdminUserCreateForm } from "./AdminUserCreateForm";
import { AdminUserDetail } from "./AdminUserDetail";
import { AdminUserTable } from "./AdminUserTable";
import type {
  AdminPermissionGrant,
  AdminUser,
  AdminUserWithPermissions,
  CreateAdminUserRequest,
} from "../../../shared/adminContracts";

interface AdminUsersScreenProps {
  currentUser: AdminUser;
  onUnauthorized: () => void;
}

export function AdminUsersScreen({ currentUser, onUnauthorized }: AdminUsersScreenProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<AdminPermissionGrant[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserWithPermissions[]>([]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null,
    [selectedUserId, users],
  );

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      setPermissionDraft(selectedUser.permissions.map(permissionToGrant));
    }
  }, [selectedUser?.id]);

  async function loadUsers(): Promise<void> {
    setError(null);
    setIsLoading(true);

    try {
      const response = await listAdminUsers();

      setUsers(response.users);
      setSelectedUserId((currentSelection) => currentSelection ?? response.users[0]?.id ?? null);
    } catch (loadError) {
      handleApiError(loadError, t.users.errorLoad);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUser(request: CreateAdminUserRequest): Promise<boolean> {
    setError(null);
    setNotice(null);

    try {
      const response = await createAdminUser(request);

      setUsers((currentUsers) => [response.user, ...currentUsers]);
      setSelectedUserId(response.user.id);
      setNotice(t.users.noticeCreated);
      return true;
    } catch (createError) {
      handleApiError(createError, t.users.errorCreate);
      return false;
    }
  }

  async function handleResetPassword(password: string): Promise<boolean> {
    if (!selectedUser) {
      return false;
    }

    setError(null);
    setNotice(null);

    try {
      await resetAdminUserPassword(selectedUser.id, {
        password,
      });
      setNotice(t.users.noticePasswordReset);
      return true;
    } catch (resetError) {
      handleApiError(resetError, t.users.errorPassword);
      return false;
    }
  }

  async function handleUpdateProfile(displayName: string): Promise<boolean> {
    if (!selectedUser) {
      return false;
    }

    setError(null);
    setNotice(null);

    try {
      const response = await updateAdminUserProfile(selectedUser.id, {
        displayName,
      });

      replaceUser(response.user);
      setNotice(t.users.noticeUpdated);
      return true;
    } catch (profileError) {
      handleApiError(profileError, t.users.errorUpdate);
      return false;
    }
  }

  async function handleSavePermissions(): Promise<void> {
    if (!selectedUser) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSavingPermissions(true);

    try {
      const response = await replaceAdminUserPermissions(selectedUser.id, {
        permissions: permissionDraft,
      });

      replaceUser(response.user);
      setPermissionDraft(response.user.permissions.map(permissionToGrant));
      setNotice(t.users.noticePermissionsSaved);
    } catch (saveError) {
      handleApiError(saveError, t.users.errorPermissions);
    } finally {
      setIsSavingPermissions(false);
    }
  }

  async function handleStatusChange(user: AdminUserWithPermissions): Promise<void> {
    setError(null);
    setNotice(null);

    try {
      const response = await updateAdminUserStatus(user.id, {
        status: user.status === "active" ? "disabled" : "active",
      });

      replaceUser(response.user);
      setNotice(response.user.status === "active" ? t.users.noticeEnabled : t.users.noticeDisabled);
    } catch (statusError) {
      handleApiError(statusError, t.users.errorStatus);
    }
  }

  function replaceUser(user: AdminUserWithPermissions): void {
    setUsers((currentUsers) =>
      currentUsers.map((currentUserEntry) =>
        currentUserEntry.id === user.id ? user : currentUserEntry,
      ),
    );
  }

  function handleApiError(apiError: unknown, fallback: string): void {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized();
      return;
    }

    setError(apiError instanceof Error ? apiError.message : fallback);
  }

  if (!currentUser.isSuperAdmin) {
    return (
      <section className="content single-column">
        <article className="panel">
          <h2>{t.users.title}</h2>
          <p className="metric">Super admin access is required.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="content users-layout">
      {error || notice ? (
        <div className="screen-alerts">
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}
        </div>
      ) : null}

      <AdminUserTable
        isLoading={isLoading}
        onRefresh={() => void loadUsers()}
        onSelectUser={setSelectedUserId}
        selectedUserId={selectedUser?.id ?? null}
        users={users}
      />

      <AdminUserDetail
        currentUserId={currentUser.id}
        isSavingPermissions={isSavingPermissions}
        onPermissionDraftChange={setPermissionDraft}
        onResetPassword={handleResetPassword}
        onSavePermissions={() => void handleSavePermissions()}
        onStatusChange={(user) => void handleStatusChange(user)}
        onUpdateProfile={handleUpdateProfile}
        permissionDraft={permissionDraft}
        user={selectedUser}
      />

      <AdminUserCreateForm onCreate={handleCreateUser} />
    </section>
  );
}
