export {
  countAdminUsers,
  createAdminUser,
  findAdminUserById,
  findAdminUserByEmail,
  listAdminUsers,
  updateAdminLastLogin,
  updateAdminUserPasswordHash,
  updateAdminUserStatus,
} from "./database/adminUsers.js";
export type {
  AdminUserWithPasswordHash,
  CreateAdminUserInput,
  UpdateAdminUserStatusInput,
} from "./database/adminUsers.js";

export {
  adminUserHasPermission,
  createAdminPermission,
  deleteAdminPermission,
  deleteAdminPermissionsForUser,
  listAdminPermissionsForUser,
  replaceAdminPermissionsForUser,
} from "./database/adminPermissions.js";
export type {
  AdminPermissionCheckInput,
  CreateAdminPermissionInput,
} from "./database/adminPermissions.js";

export {
  createAdminSession,
  deleteAdminSession,
  findAdminSessionByTokenHash,
  touchAdminSession,
} from "./database/adminSessions.js";
export type { AdminSessionWithUser } from "./database/adminSessions.js";

export { getDashboardSummary } from "./database/dashboard.js";

export { checkDatabaseHealth, DATABASE_TABLES } from "./database/health.js";
export type { DatabaseHealth, DatabaseHealthStatus } from "./database/health.js";

export { createDatabasePool } from "./database/pool.js";
