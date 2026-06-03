import { useState } from "react";

import { PermissionEditor } from "./PermissionEditor";
import type { AdminPermissionGrant, CreateAdminUserRequest } from "../../../shared/adminContracts";

interface AdminUserCreateFormProps {
  onCreate: (request: CreateAdminUserRequest) => Promise<boolean>;
}

export function AdminUserCreateForm({ onCreate }: AdminUserCreateFormProps) {
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
      const didCreate = await onCreate({
        displayName,
        email,
        isSuperAdmin,
        password,
        permissions,
      });

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
      <h2>Create User</h2>
      <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>Display name</span>
          <input
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          <span>Password</span>
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
          <span>Super admin</span>
        </label>
        {!isSuperAdmin ? (
          <PermissionEditor
            disabled={isSubmitting}
            onChange={setPermissions}
            permissions={permissions}
          />
        ) : null}
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating" : "Create user"}
        </button>
      </form>
    </article>
  );
}
