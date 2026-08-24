import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";

import {
  createClientPairingDeviceCode,
  createClientPairingUserCode,
  normalizeClientPairingUserCode,
} from "../auth/clientPairingCodes.js";
import { hashClientCredential } from "../auth/clientCredentials.js";
import { createClientPairingSession, isDuplicateEntryError } from "../database.js";
import type { CreateClientPairingResponse } from "../../../shared/clientPairingContracts.js";

const MAX_CODE_GENERATION_ATTEMPTS = 4;

export interface ClientPairingSessionCreationOptions {
  pollIntervalSeconds: number;
  requestedName: string;
  softwareVersion: string | null;
  ttlMinutes: number;
}

export async function createNewClientPairingSession(
  pool: Pool,
  options: ClientPairingSessionCreationOptions,
): Promise<CreateClientPairingResponse> {
  const expiresAt = new Date(Date.now() + options.ttlMinutes * 60 * 1000);

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const deviceCode = createClientPairingDeviceCode();
    const userCode = createClientPairingUserCode();
    const normalizedUserCode = normalizeClientPairingUserCode(userCode);

    if (!normalizedUserCode) {
      throw new Error("Generated client pairing code is invalid");
    }

    try {
      await createClientPairingSession(pool, {
        deviceCodeHash: hashClientCredential(deviceCode),
        expiresAt,
        id: randomUUID(),
        pollIntervalSeconds: options.pollIntervalSeconds,
        requestedName: options.requestedName,
        softwareVersion: options.softwareVersion,
        userCodeHash: hashClientCredential(normalizedUserCode),
      });

      return {
        deviceCode,
        expiresAt: expiresAt.toISOString(),
        pollIntervalSeconds: options.pollIntervalSeconds,
        userCode,
      };
    } catch (error) {
      if (!isDuplicateEntryError(error) || attempt === MAX_CODE_GENERATION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to generate a unique client pairing code");
}
