import type { CreateClientEnrollmentTokenResponse } from "../../../shared/clientContracts";
import { readJsonResponse } from "./adminApi";

export async function createClientEnrollmentToken(): Promise<CreateClientEnrollmentTokenResponse> {
  return readJsonResponse<CreateClientEnrollmentTokenResponse>(
    await fetch("/api/admin/client-enrollment-tokens", {
      method: "POST",
    }),
  );
}
