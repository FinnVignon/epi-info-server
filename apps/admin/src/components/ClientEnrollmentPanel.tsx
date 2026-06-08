import { useState } from "react";

import { createClientEnrollmentToken } from "../api/adminClientsApi";
import { ApiError } from "../api/adminApi";
import type { ClientEnrollmentToken } from "../../../shared/clientContracts";

interface ClientEnrollmentPanelProps {
  onUnauthorized: () => void;
}

export function ClientEnrollmentPanel({ onUnauthorized }: ClientEnrollmentPanelProps) {
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
      setError(null);
      setNotice("Enrollment token copied.");
    } catch {
      setError("Unable to copy the token. Select it manually.");
    }
  }

  return (
    <article className="panel client-enrollment-panel">
      <div className="panel-header">
        <h2>Connect A Client</h2>
        <button
          className="primary-button"
          disabled={isCreating}
          onClick={() => void handleCreateToken()}
          type="button"
        >
          {isCreating ? "Generating" : "Generate token"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}

      {enrollmentToken ? (
        <div className="enrollment-token-result">
          <div>
            <span>Enrollment token</span>
            <code>{enrollmentToken.token}</code>
          </div>
          <p className="metric">Expires {new Date(enrollmentToken.expiresAt).toLocaleString()}.</p>
          <button className="secondary-button" onClick={() => void handleCopyToken()} type="button">
            Copy token
          </button>
        </div>
      ) : null}
    </article>
  );
}
