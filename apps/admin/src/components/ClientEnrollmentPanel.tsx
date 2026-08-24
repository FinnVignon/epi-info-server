import { useState } from "react";

import { createClientEnrollmentToken } from "../api/adminClientsApi";
import { ApiError } from "../api/adminApi";
import { useTemporaryNotice } from "../hooks/useTemporaryNotice";
import { formatTranslation, useTranslation } from "../i18n";
import { AdminFeedback } from "./AdminFeedback";
import type { ClientEnrollmentToken } from "../../../shared/clientContracts";

interface ClientEnrollmentPanelProps {
  onUnauthorized: () => void;
}

export function ClientEnrollmentPanel({ onUnauthorized }: ClientEnrollmentPanelProps) {
  const { t } = useTranslation();
  const [enrollmentToken, setEnrollmentToken] = useState<ClientEnrollmentToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useTemporaryNotice();

  async function handleCreateToken(): Promise<void> {
    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const response = await createClientEnrollmentToken();

      setEnrollmentToken(response.enrollmentToken);
      setNotice(t.clients.noticeTokenCreated);
    } catch (createError) {
      if (createError instanceof ApiError && createError.status === 401) {
        onUnauthorized();
        return;
      }

      setError(createError instanceof Error ? createError.message : t.clients.errorToken);
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
      setNotice(t.clients.noticeTokenCopied);
    } catch {
      setError(t.clients.errorTokenCopy);
    }
  }

  return (
    <article className="panel client-enrollment-panel">
      <div className="panel-header">
        <h2>{t.clients.connectTitle}</h2>
        <button
          className="primary-button"
          disabled={isCreating}
          onClick={() => void handleCreateToken()}
          type="button"
        >
          {isCreating ? t.clients.generating : t.clients.generateToken}
        </button>
      </div>

      <AdminFeedback error={error} notice={notice} />

      {enrollmentToken ? (
        <div className="enrollment-token-result">
          <div>
            <span>{t.clients.enrollmentToken}</span>
            <code>{enrollmentToken.token}</code>
          </div>
          <p className="metric">
            {formatTranslation(t.clients.tokenExpires, {
              date: new Date(enrollmentToken.expiresAt).toLocaleString(),
            })}
          </p>
          <button className="secondary-button" onClick={() => void handleCopyToken()} type="button">
            {t.clients.copyToken}
          </button>
        </div>
      ) : null}
    </article>
  );
}
