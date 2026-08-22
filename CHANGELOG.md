# Changelog

## 1.0.1 - Unreleased

- Initialize and upgrade MySQL through bundled, checksummed migrations.
- Package migration and backup support in the server image.
- Upgrade the runtime to Node.js 24 and resolve npm advisories.
- Reject new passwords that exceed bcrypt's 72-byte input boundary.
- Quarantine archived asset files while their records are deleted.
- Repair asset archive and restore request validation.
- Purge expired sessions and old enrollment tokens periodically.
- Close background tasks, WebSockets, HTTP, and MySQL cleanly on shutdown.
- Add automated tests, CI checks, container smoke tests, and maintainer guidance.

## 1.0.0

- Initial server and administration-panel release.
