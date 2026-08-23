import type { Pool } from "mysql2/promise";

import { findAdminUserById, listAdminPermissionsForUser } from "../database.js";
import type { AdminUser, AdminUserWithPermissions } from "../../../shared/adminContracts.js";

export async function loadAdminUserWithPermissions(
  pool: Pool,
  user: AdminUser,
): Promise<AdminUserWithPermissions> {
  return {
    ...user,
    permissions: await listAdminPermissionsForUser(pool, user.id),
  };
}

export async function findAdminUserWithPermissions(
  pool: Pool,
  userId: string,
): Promise<AdminUserWithPermissions | null> {
  const user = await findAdminUserById(pool, userId);

  return user ? loadAdminUserWithPermissions(pool, user) : null;
}
