# Changelog

## 1.0.1 - Unreleased

- Initialize and upgrade MySQL through bundled, checksummed migrations.
- Package migration and backup support in the server image.
- Upgrade the runtime to Node.js 24 and resolve npm advisories.
- Reject new passwords that exceed bcrypt's 72-byte input boundary.
- Store new passwords in a versioned exact-input format and upgrade legacy bcrypt hashes after a
  successful login.
- Quarantine archived asset files while their records are deleted.
- Confine asset download and cleanup paths to the configured storage directory.
- Repair asset archive and restore request validation.
- Purge expired sessions and old enrollment tokens periodically.
- Close background tasks, WebSockets, HTTP, and MySQL cleanly on shutdown.
- Add automated tests, CI checks, container smoke tests, and maintainer guidance.
- Pin CI actions to immutable revisions and exclude local backup data from Docker build contexts.

## 1.0.0

- Initial server and administration-panel release.
