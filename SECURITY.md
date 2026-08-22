# Security Policy

## Supported Versions

Security fixes are prepared for the latest `1.0.x` release line. Upgrade to the newest patch before
reporting a problem that may already be fixed.

## Reporting A Vulnerability

Do not open a public issue with exploit details, credentials, personal data, or uploaded content.
Use the repository's private vulnerability reporting option under **Security > Advisories > Report
a vulnerability**. Include the affected version, deployment shape, reproduction steps, expected
security boundary, and impact. Use placeholder credentials and the smallest safe proof of concept.

If private vulnerability reporting is unavailable, contact the repository owner privately before
sharing technical details. Do not test against systems or displays you do not own or administer.

## Deployment Responsibilities

- Terminate HTTPS before exposing the admin panel or client API outside a trusted network.
- Use unique MySQL passwords and keep port 3306 off untrusted networks.
- Restrict `ADMIN_ALLOWED_ORIGINS` to real admin origins.
- Protect backups because they contain password hashes, sessions, client credentials, and media.
- Remove enrollment tokens from client configuration after successful enrollment.
- Keep the host, Docker Engine, MySQL image, and Epi Info images patched.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the production boundary.
