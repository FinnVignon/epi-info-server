import type { Pool } from "mysql2/promise";

import { findClientById } from "../database.js";
import type { ManagedClient } from "../../../shared/clientContracts.js";

export async function loadClientDetail(
  pool: Pool,
  clientId: string,
  offlineAfterSeconds: number,
): Promise<ManagedClient | null> {
  return findClientById(pool, clientId, offlineAfterSeconds);
}

export async function requireClientDetail(
  pool: Pool,
  clientId: string,
  offlineAfterSeconds: number,
): Promise<ManagedClient> {
  const client = await loadClientDetail(pool, clientId, offlineAfterSeconds);

  if (!client) {
    throw new Error("Updated client could not be loaded");
  }

  return client;
}
