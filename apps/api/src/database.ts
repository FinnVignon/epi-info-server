export {
  countAdminUsers,
  createAdminUser,
  findAdminUserById,
  findAdminUserByEmail,
  listAdminUsers,
  updateAdminLastLogin,
  updateAdminUserPasswordHash,
  updateAdminUserProfile,
  updateAdminUserStatus,
} from "./database/adminUsers.js";
export type {
  AdminUserWithPasswordHash,
  CreateAdminUserInput,
  UpdateAdminUserProfileInput,
  UpdateAdminUserStatusInput,
} from "./database/adminUsers.js";

export {
  adminUserHasAnyPermission,
  adminUserHasPermission,
  createAdminPermission,
  deleteAdminPermission,
  deleteAdminPermissionsForUser,
  listAdminPermissionsForUser,
  replaceAdminPermissionsForUser,
} from "./database/adminPermissions.js";
export type {
  AdminAnyPermissionCheckInput,
  AdminPermissionCheckInput,
  CreateAdminPermissionInput,
} from "./database/adminPermissions.js";

export {
  createAdminSession,
  deleteAdminSession,
  deleteAdminSessionsForUser,
  findAdminSessionByTokenHash,
  touchAdminSession,
} from "./database/adminSessions.js";
export type { AdminSessionWithUser } from "./database/adminSessions.js";

export { MysqlNamedLockTimeoutError, withMysqlNamedLock } from "./database/mysqlLocks.js";

export { getDashboardSummary } from "./database/dashboard.js";
export type { DashboardSummaryInput } from "./database/dashboard.js";

export {
  createAsset,
  deleteArchivedAssetIfEligible,
  ensureAssetSchema,
  findAssetById,
  findAssetBySha256,
  listArchivedAssetCleanupCandidates,
  listAssets,
  updateAssetStatus,
} from "./database/assets.js";
export type {
  ArchivedAssetCleanupCandidate,
  AssetWithStoragePath,
  CreateAssetInput,
  UpdateAssetStatusInput,
} from "./database/assets.js";

export {
  createClientEnrollmentToken,
  ensureClientConnectionSchema,
  findClientCredentialById,
  recordClientHeartbeat,
  registerClientWithEnrollmentToken,
} from "./database/clientConnections.js";
export type {
  ClientCredentialRecord,
  CreateClientEnrollmentTokenInput,
  RegisterClientInput,
  RegisterClientResult,
} from "./database/clientConnections.js";

export {
  findClientById,
  listActiveClientIdsForAssignmentTarget,
  listClientsInGroup,
  listClientsForAdmin,
  updateClientProfile,
  updateClientStatus,
} from "./database/clients.js";
export type {
  ClientAdminAction,
  ListClientsForAdminInput,
  UpdateClientProfileInput,
  UpdateClientStatusInput,
} from "./database/clients.js";

export {
  assignAssetToTarget,
  assignManifestItemToTarget,
  ensureAssignmentContentSchema,
  ensureAssignmentSchema,
  findEffectiveManifestForClient,
} from "./database/manifests.js";
export type {
  AssignmentTarget,
  AssignAssetToTargetInput,
  AssignManifestItemToTargetInput,
} from "./database/manifests.js";

export {
  addClientToGroup,
  createGroup,
  deleteGroup,
  findGroupById,
  listGroupsForAdmin,
  removeClientFromGroup,
  updateGroup,
} from "./database/groups.js";
export type {
  CreateGroupInput,
  GroupAdminAction,
  ListGroupsForAdminInput,
  UpdateGroupInput,
} from "./database/groups.js";

export { checkDatabaseHealth, DATABASE_TABLES } from "./database/health.js";
export type { DatabaseHealth, DatabaseHealthStatus } from "./database/health.js";

export { isDuplicateEntryError } from "./database/utils.js";

export { createDatabasePool } from "./database/pool.js";
