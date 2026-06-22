CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY admin_users_email_unique (email)
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  target_type ENUM('global', 'group', 'client') NOT NULL,
  target_id VARCHAR(64) NULL,
  target_key VARCHAR(64) GENERATED ALWAYS AS (COALESCE(target_id, 'global')) STORED,
  can_manage_users BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_clients BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_groups BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_content BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_assignments BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY admin_permissions_scope_unique (user_id, target_type, target_key),
  CONSTRAINT admin_permissions_user_id_fk
    FOREIGN KEY (user_id) REFERENCES admin_users (id)
    ON DELETE CASCADE,
  CONSTRAINT admin_permissions_target_consistency_check
    CHECK (
      (target_type = 'global' AND target_id IS NULL)
      OR (target_type IN ('group', 'client') AND target_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL,
  UNIQUE KEY admin_sessions_token_hash_unique (token_hash),
  CONSTRAINT admin_sessions_user_id_fk
    FOREIGN KEY (user_id) REFERENCES admin_users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status ENUM('online', 'offline', 'unknown') NOT NULL DEFAULT 'unknown',
  access_status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  credential_hash CHAR(64) NULL,
  software_version VARCHAR(64) NULL,
  current_manifest_id VARCHAR(64) NULL,
  current_manifest_version INT UNSIGNED NULL,
  last_seen_at TIMESTAMP NULL,
  last_sync_result VARCHAR(255) NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY clients_credential_hash_unique (credential_hash)
);

CREATE TABLE IF NOT EXISTS client_enrollment_tokens (
  id VARCHAR(64) PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  created_by_user_id VARCHAR(64) NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  used_by_client_id VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY client_enrollment_tokens_hash_unique (token_hash),
  INDEX client_enrollment_tokens_expires_at_index (expires_at),
  CONSTRAINT client_enrollment_tokens_created_by_user_id_fk
    FOREIGN KEY (created_by_user_id) REFERENCES admin_users (id)
    ON DELETE SET NULL,
  CONSTRAINT client_enrollment_tokens_used_by_client_id_fk
    FOREIGN KEY (used_by_client_id) REFERENCES clients (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS display_groups (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY display_groups_name_unique (name)
);

CREATE TABLE IF NOT EXISTS client_groups (
  client_id VARCHAR(64) NOT NULL,
  group_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, group_id),
  CONSTRAINT client_groups_client_id_fk
    FOREIGN KEY (client_id) REFERENCES clients (id)
    ON DELETE CASCADE,
  CONSTRAINT client_groups_group_id_fk
    FOREIGN KEY (group_id) REFERENCES display_groups (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR(64) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  type ENUM('image', 'video') NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  storage_path VARCHAR(1024) NOT NULL,
  public_url VARCHAR(1024) NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  uploaded_by_user_id VARCHAR(64) NULL,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY assets_sha256_unique (sha256),
  INDEX assets_uploaded_by_user_id_index (uploaded_by_user_id),
  INDEX assets_status_index (status),
  CONSTRAINT assets_uploaded_by_user_id_fk
    FOREIGN KEY (uploaded_by_user_id) REFERENCES admin_users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS manifests (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manifest_items (
  id VARCHAR(64) PRIMARY KEY,
  manifest_id VARCHAR(64) NOT NULL,
  position INT UNSIGNED NOT NULL,
  type ENUM('image', 'video', 'text', 'live_web_link') NOT NULL,
  asset_id VARCHAR(64) NULL,
  remote_url VARCHAR(1024) NULL,
  local_path VARCHAR(1024) NULL,
  duration_seconds INT UNSIGNED NOT NULL,
  fit ENUM('contain', 'cover') NULL,
  sha256 CHAR(64) NULL,
  text_body TEXT NULL,
  url VARCHAR(2048) NULL,
  refresh_seconds INT UNSIGNED NULL,
  presentation_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY manifest_items_manifest_position_unique (manifest_id, position),
  CONSTRAINT manifest_items_manifest_id_fk
    FOREIGN KEY (manifest_id) REFERENCES manifests (id)
    ON DELETE CASCADE,
  CONSTRAINT manifest_items_asset_id_fk
    FOREIGN KEY (asset_id) REFERENCES assets (id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS assignments (
  id VARCHAR(64) PRIMARY KEY,
  target_type ENUM('client', 'group', 'global') NOT NULL,
  target_id VARCHAR(64) NULL,
  target_key VARCHAR(64) GENERATED ALWAYS AS (COALESCE(target_id, 'global')) STORED,
  manifest_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY assignments_target_unique (target_type, target_key),
  CONSTRAINT assignments_manifest_id_fk
    FOREIGN KEY (manifest_id) REFERENCES manifests (id)
    ON DELETE CASCADE,
  CONSTRAINT assignments_target_consistency_check
    CHECK (
      (target_type = 'global' AND target_id IS NULL)
      OR (target_type IN ('client', 'group') AND target_id IS NOT NULL)
    )
);
