import { ArrowLeft, Check, X } from "lucide-react";

import type {
  AdminClientPairing,
  ClientPairingGroupOption,
} from "../../../shared/clientPairingContracts";
import { formatTranslation, useTranslation } from "../i18n";

interface ClientPairingReviewProps {
  groupId: string;
  groups: ClientPairingGroupOption[];
  isWorking: boolean;
  name: string;
  onApprove: () => void;
  onBack: () => void;
  onGroupChange: (groupId: string) => void;
  onNameChange: (name: string) => void;
  onReject: () => void;
  pairing: AdminClientPairing;
}

export function ClientPairingReview({
  groupId,
  groups,
  isWorking,
  name,
  onApprove,
  onBack,
  onGroupChange,
  onNameChange,
  onReject,
  pairing,
}: ClientPairingReviewProps) {
  const { t } = useTranslation();

  return (
    <div className="pairing-review">
      <dl className="pairing-request-summary">
        <div>
          <dt>{t.clients.pairingRequestedName}</dt>
          <dd>{pairing.requestedName}</dd>
        </div>
        <div>
          <dt>{t.clients.pairingSoftware}</dt>
          <dd>{pairing.softwareVersion ?? t.common.unknown}</dd>
        </div>
        <div>
          <dt>{t.clients.pairingExpires}</dt>
          <dd>
            {formatTranslation(t.clients.tokenExpires, {
              date: new Date(pairing.expiresAt).toLocaleString(),
            })}
          </dd>
        </div>
      </dl>

      <div className="form-grid compact-form pairing-approval-form">
        <label>
          <span>{t.clients.clientName}</span>
          <input
            disabled={isWorking}
            maxLength={255}
            minLength={2}
            onChange={(event) => onNameChange(event.target.value)}
            required
            value={name}
          />
        </label>
        <label>
          <span>{t.clients.pairingGroup}</span>
          <select
            disabled={isWorking}
            onChange={(event) => onGroupChange(event.target.value)}
            value={groupId}
          >
            <option value="">{t.clients.pairingNoGroup}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pairing-actions">
        <button
          className="primary-button"
          disabled={isWorking || name.trim().length < 2}
          onClick={onApprove}
          type="button"
        >
          <Check aria-hidden="true" size={16} />
          {isWorking ? t.common.working : t.clients.pairingApprove}
        </button>
        <button className="danger-button" disabled={isWorking} onClick={onReject} type="button">
          <X aria-hidden="true" size={16} />
          {t.clients.pairingReject}
        </button>
        <button className="secondary-button" disabled={isWorking} onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={16} />
          {t.clients.pairingBack}
        </button>
      </div>
    </div>
  );
}
