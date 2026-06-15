import { useState } from "react";

import { PermissionEditor } from "./PermissionEditor";
import type { AdminPermissionGrant, CreateAdminUserRequest } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

interface AdminUserCreateFormProps {
  onCreate: (request: CreateAdminUserRequest) => Promise<boolean>;
}

export function AdminUserCreateForm({ onCreate }: AdminUserCreateFormProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<AdminPermissionGrant[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const didCreate = await onCreate({ displayName, email, isSuperAdmin, password, permissions });
      if (didCreate) {
        setDisplayName("");
        setEmail("");
        setIsSuperAdmin(false);
        setPassword("");
        setPermissions([]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="panel">
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
        <label className="checkbox-row">
          <input
            checked={isSuperAdmin}
            onChange={(event) => setIsSuperAdmin(event.target.checked)}
            type="checkbox"
          />
          <span>{t.users.superAdminCheckbox}</span>
        </label>
        {!isSuperAdmin ? (
          <PermissionEditor
            disabled={isSubmitting}
            onChange={setPermissions}
            permissions={permissions}
          />
        ) : null}
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? t.users.creating : t.users.createButton}
        </button>
      </form>
    </article>
  );
}
