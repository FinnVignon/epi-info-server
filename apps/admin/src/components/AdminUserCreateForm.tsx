import { useState } from "react";

import { PermissionEditor } from "./PermissionEditor";
import { getAccountTypeActions } from "../utils/adminAccountType";
import type { AdminPermissionGrant, CreateAdminUserRequest } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

interface AdminUserCreateFormProps {
  onCreate: (request: CreateAdminUserRequest) => Promise<boolean>;
}

export function AdminUserCreateForm({ onCreate }: AdminUserCreateFormProps) {
  const { t } = useTranslation();
  const [accountType, setAccountType] = useState<CreateAdminUserRequest["accountType"]>("user");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<AdminPermissionGrant[]>([]);
  const permissionActions = new Set(permissions.flatMap((permission) => permission.actions));
  const hasRequiredPermissions =
    accountType === "user"
      ? permissionActions.has("manage_content") && permissionActions.has("manage_assignments")
      : permissionActions.has("manage_clients") || permissionActions.has("manage_groups");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const didCreate = await onCreate({
        accountType,
        displayName,
        email,
        password,
        permissions,
      });
      if (didCreate) {
        setAccountType("user");
        setDisplayName("");
        setEmail("");
        setPassword("");
        setPermissions([]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAccountTypeChange(nextAccountType: CreateAdminUserRequest["accountType"]): void {
    const allowedActions = getAccountTypeActions(nextAccountType);

    setAccountType(nextAccountType);
    setPermissions((currentPermissions) =>
      currentPermissions
        .map((permission) => ({
          ...permission,
          actions: permission.actions.filter((action) => allowedActions.includes(action)),
        }))
        .filter((permission) => permission.actions.length > 0),
    );
  }

  return (
    <article className="panel users-create-panel">
      <h2>{t.users.createTitle}</h2>
      <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>{t.users.displayNameLabel}</span>
          <input
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <label>
          <span>{t.users.emailLabel}</span>
          <input
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          <span>{t.users.passwordLabel}</span>
          <input
            minLength={10}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label>
          <span>{t.users.accountType}</span>
          <select
            onChange={(event) =>
              handleAccountTypeChange(event.target.value as CreateAdminUserRequest["accountType"])
            }
            value={accountType}
          >
            <option value="user">{t.accountTypes.user}</option>
            <option value="admin">{t.accountTypes.admin}</option>
          </select>
        </label>
        <PermissionEditor
          allowedActions={getAccountTypeActions(accountType)}
          disabled={isSubmitting}
          initialActions={getAccountTypeActions(accountType)}
          key={accountType}
          onChange={setPermissions}
          permissions={permissions}
        />
        {!hasRequiredPermissions ? (
          <p className="metric">{t.users.accountPermissionsRequired}</p>
        ) : null}
        <button
          className="primary-button"
          disabled={isSubmitting || !hasRequiredPermissions}
          type="submit"
        >
          {isSubmitting ? t.users.creating : t.users.createButton}
        </button>
      </form>
    </article>
  );
}
