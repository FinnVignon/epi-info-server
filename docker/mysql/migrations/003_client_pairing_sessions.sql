CREATE TABLE client_pairing_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_code_hash CHAR(64) NOT NULL,
  device_code_hash CHAR(64) NOT NULL,
  requested_name VARCHAR(255) NOT NULL,
  software_version VARCHAR(64) NULL,
  status ENUM('pending', 'approved', 'rejected', 'consumed') NOT NULL DEFAULT 'pending',
  poll_interval_seconds SMALLINT UNSIGNED NOT NULL,
  last_polled_at TIMESTAMP(6) NULL,
  approved_name VARCHAR(255) NULL,
  approved_group_id VARCHAR(64) NULL,
  approved_by_user_id VARCHAR(64) NULL,
  approved_at TIMESTAMP(6) NULL,
  rejected_by_user_id VARCHAR(64) NULL,
  rejected_at TIMESTAMP(6) NULL,
  consumed_at TIMESTAMP(6) NULL,
  used_by_client_id VARCHAR(64) NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY client_pairing_sessions_user_code_hash_unique (user_code_hash),
  UNIQUE KEY client_pairing_sessions_device_code_hash_unique (device_code_hash),
  INDEX client_pairing_sessions_expires_at_index (expires_at),
  INDEX client_pairing_sessions_status_index (status),
  CONSTRAINT client_pairing_sessions_approved_group_id_fk
    FOREIGN KEY (approved_group_id) REFERENCES display_groups (id)
    ON DELETE SET NULL,
  CONSTRAINT client_pairing_sessions_approved_by_user_id_fk
    FOREIGN KEY (approved_by_user_id) REFERENCES admin_users (id)
    ON DELETE SET NULL,
  CONSTRAINT client_pairing_sessions_rejected_by_user_id_fk
    FOREIGN KEY (rejected_by_user_id) REFERENCES admin_users (id)
    ON DELETE SET NULL,
  CONSTRAINT client_pairing_sessions_used_by_client_id_fk
    FOREIGN KEY (used_by_client_id) REFERENCES clients (id)
    ON DELETE SET NULL
);
