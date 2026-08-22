CREATE INDEX admin_sessions_expires_at_index ON admin_sessions (expires_at);

CREATE INDEX client_enrollment_tokens_used_at_index ON client_enrollment_tokens (used_at);
