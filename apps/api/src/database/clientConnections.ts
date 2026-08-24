export { ensureClientConnectionSchema } from "./clientConnectionSchema.js";
export {
  createClientEnrollmentToken,
  registerClientWithEnrollmentToken,
} from "./clientEnrollmentRecords.js";
export type {
  CreateClientEnrollmentTokenInput,
  RegisterClientInput,
  RegisterClientResult,
} from "./clientEnrollmentRecords.js";
export { findClientCredentialById, recordClientHeartbeat } from "./clientStatusRecords.js";
export type { ClientCredentialRecord } from "./clientStatusRecords.js";
