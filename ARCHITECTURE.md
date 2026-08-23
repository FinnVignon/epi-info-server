# Server Architecture

The server is the controller for displays. It owns admin authentication, permissions, clients,
groups, content, assignments, status reporting, and live update signals. A client remains
autonomous when this server is unavailable.

## Runtime Components

- `apps/api/src/index.ts` composes the process. It should contain wiring, not feature logic.
- `apps/api/src/routes/` validates HTTP input, applies authorization, and maps results to HTTP.
- `apps/api/src/services/` owns workflows that coordinate storage, database, or background work.
- `apps/api/src/database/` is the only layer that issues application SQL queries.
- `apps/api/src/auth/` owns credentials, sessions, permissions, rate limits, and origin protection.
- `apps/api/src/live/` signals assignment changes over authenticated WebSockets. It is an
  optimization; heartbeat polling remains the recovery path.
- `apps/admin/src/` is the React administration interface. API calls, pages, components, and
  translations remain separate.
- `apps/shared/` contains TypeScript contracts shared by the API and admin build.
- `docker/mysql/migrations/` is the ordered database history applied before the API listens.

## Data And Assignment Flow

An admin uploads an image or video, or creates a live web-link assignment. The server creates a
manifest and assigns it to a client, group, or all clients. The most recently updated applicable
assignment is effective; target type is not a priority hierarchy.

The server sends an authenticated WebSocket signal to affected online clients. Clients then fetch
the effective manifest through the normal authenticated HTTP API. If the signal is lost, the next
heartbeat performs the same synchronization.

Uploaded files live in the asset volume and metadata lives in MySQL. Archived assets are retained
for 30 days by default and removed only when they are no longer referenced by an assignment that
applies to an active client. Files are quarantined before database deletion so a failed database
recheck can restore them.

## Security Boundaries

Admin sessions use HTTP-only cookies. State-changing admin requests require an approved origin.
Client enrollment tokens are single-use and short-lived; enrolled clients use independent bearer
credentials. Upload MIME types and file signatures are both validated. Passwords are hashed with
bcrypt and limited to bcrypt's 72-byte input boundary.

Production deployments must terminate HTTPS in front of the server and keep MySQL private. See
[DEPLOYMENT.md](DEPLOYMENT.md).

## Change Rules

Add feature logic to the narrowest existing module. Split a file when it starts mixing validation,
transport, persistence, and orchestration. Add a new numbered migration for every schema change;
never edit a migration that has been applied. Preserve the client protocol or update the matching
contracts and client repository together.
