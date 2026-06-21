import type { Pool } from "mysql2/promise";

import { findGroupById, listClientsInGroup } from "../database.js";
import type { DisplayGroupDetail } from "../../../shared/groupContracts.js";

export async function loadGroupDetail(
  pool: Pool,
  groupId: string,
  offlineAfterSeconds: number,
): Promise<DisplayGroupDetail | null> {
  const group = await findGroupById(pool, groupId);

  if (!group) {
    return null;
  }

  return {
    ...group,
    members: await listClientsInGroup(pool, groupId, offlineAfterSeconds),
  };
}

export async function requireGroupDetail(
  pool: Pool,
  groupId: string,
  offlineAfterSeconds: number,
): Promise<DisplayGroupDetail> {
  const group = await loadGroupDetail(pool, groupId, offlineAfterSeconds);

  if (!group) {
    throw new Error("Updated group could not be loaded");
  }

  return group;
}
