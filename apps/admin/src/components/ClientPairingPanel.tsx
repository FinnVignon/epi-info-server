import { MonitorUp, Search } from "lucide-react";
import { useState } from "react";

import {
  approveClientPairing,
  lookupClientPairing,
  rejectClientPairing,
} from "../api/adminClientPairingsApi";
import { ApiError } from "../api/adminApi";
import { useTemporaryNotice } from "../hooks/useTemporaryNotice";
import { useTranslation } from "../i18n";
import type {
  AdminClientPairing,
  ClientPairingGroupOption,
} from "../../../shared/clientPairingContracts";
import { AdminFeedback } from "./AdminFeedback";
import { ClientPairingReview } from "./ClientPairingReview";

interface ClientPairingPanelProps {
  onApproved: () => void;
  onUnauthorized: () => void;
}

export function ClientPairingPanel({ onApproved, onUnauthorized }: ClientPairingPanelProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<ClientPairingGroupOption[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [name, setName] = useState("");
  const [notice, setNotice] = useTemporaryNotice();
  const [pairing, setPairing] = useState<AdminClientPairing | null>(null);

  async function handleLookup(): Promise<void> {
    setError(null);
    setNotice(null);
    setIsWorking(true);

    try {
      const response = await lookupClientPairing({ userCode: code });

      setPairing(response.pairing);
      setGroups(response.groups);
      setName(response.pairing.requestedName);
      setGroupId("");
    } catch (lookupError) {
      handleError(lookupError, t.clients.pairingErrorLookup);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleApprove(): Promise<void> {
    if (!pairing) return;
    setError(null);
    setNotice(null);
    setIsWorking(true);

    try {
      await approveClientPairing(pairing.id, { groupId: groupId || null, name });
      resetReview();
      setNotice(t.clients.pairingNoticeApproved);
      onApproved();
    } catch (approvalError) {
      handleError(approvalError, t.clients.pairingErrorApprove);
    } finally {
      setIsWorking(false);
    }
  }

  async function handleReject(): Promise<void> {
    if (!pairing) return;
    setError(null);
    setNotice(null);
    setIsWorking(true);

    try {
      await rejectClientPairing(pairing.id);
      resetReview();
      setNotice(t.clients.pairingNoticeRejected);
    } catch (rejectionError) {
      handleError(rejectionError, t.clients.pairingErrorReject);
    } finally {
      setIsWorking(false);
    }
  }

  function handleError(apiError: unknown, fallback: string): void {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized();
      return;
    }

    setError(apiError instanceof Error ? apiError.message : fallback);
  }

  function resetReview(): void {
    setPairing(null);
    setCode("");
    setGroups([]);
    setName("");
    setGroupId("");
  }

  return (
    <article className="panel client-pairing-panel">
      <div className="panel-header pairing-panel-heading">
        <div>
          <h2>{t.clients.pairingTitle}</h2>
          <p className="metric">{t.clients.pairingDescription}</p>
        </div>
        <MonitorUp aria-hidden="true" size={20} />
      </div>

      <AdminFeedback error={error} notice={notice} />

      {pairing ? (
        <ClientPairingReview
          groupId={groupId}
          groups={groups}
          isWorking={isWorking}
          name={name}
          onApprove={() => void handleApprove()}
          onBack={resetReview}
          onGroupChange={setGroupId}
          onNameChange={setName}
          onReject={() => void handleReject()}
          pairing={pairing}
        />
      ) : (
        <form
          className="pairing-code-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleLookup();
          }}
        >
          <label>
            <span>{t.clients.pairingCode}</span>
            <input
              autoComplete="off"
              disabled={isWorking}
              maxLength={9}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder={t.clients.pairingCodePlaceholder}
              value={code}
            />
          </label>
          <button
            className="primary-button"
            disabled={isWorking || code.trim().length < 8}
            type="submit"
          >
            <Search aria-hidden="true" size={16} />
            {isWorking ? t.clients.pairingFinding : t.clients.pairingFind}
          </button>
        </form>
      )}
    </article>
  );
}
