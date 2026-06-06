import { useState } from "react";

import { createClientEnrollmentToken } from "../api/adminClientsApi";
import { ApiError } from "../api/adminApi";
import type { ClientEnrollmentToken } from "../../../shared/clientContracts";

interface AdminClientsScreenProps {
  onUnauthorized: () => void;
}

export function AdminClientsScreen({ onUnauthorized }: AdminClientsScreenProps) {
  const [enrollmentToken, setEnrollmentToken] = useState<ClientEnrollmentToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreateToken(): Promise<void> {
    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const response = await createClientEnrollmentToken();

      setEnrollmentToken(response.enrollmentToken);
      setNotice("Enrollment token created.");
    } catch (createError) {
      if (createError instanceof ApiError && createError.status === 401) {
        onUnauthorized();
        return;
      }

      setError(
        createError instanceof Error ? createError.message : "Unable to create an enrollment token",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopyToken(): Promise<void> {
    if (!enrollmentToken) {
      return;
    }

    try {
      await navigator.clipboard.writeText(enrollmentToken.token);
      setNotice("Enrollment token copied.");
    } catch {
      setError("Unable to copy the token. Select it manually.");
    }
  }

  return (
    <section className="content single-column">
      {error || notice ? (
        <div className="screen-alerts">
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}
        </div>
      ) : null}

      <article className="panel client-enrollment-panel">
        <div className="panel-header">
          <div>
            <h2>Connect A Client</h2>
            <p className="metric">Generate a single-use token for one new display client.</p>
          </div>
          <button
            className="primary-button"
            disabled={isCreating}
            onClick={() => void handleCreateToken()}
            type="button"
          >
            {isCreating ? "Generating" : "Generate token"}
          </button>
        </div>

        {enrollmentToken ? (
          <div className="enrollment-token-result">
            <div>
              <span>Enrollment token</span>
              <code>{enrollmentToken.token}</code>
            </div>
            <p className="metric">
              Expires {new Date(enrollmentToken.expiresAt).toLocaleString()}. It is shown only here
              and can enroll one client.
            </p>
            <button
              className="secondary-button"
              onClick={() => void handleCopyToken()}
              type="button"
            >
              Copy token
            </button>
          </div>
        ) : (
          <p className="metric">
            Token generation requires super-admin access or global client-management permission.
          </p>
        )}
      </article>
    </section>
  );
}
