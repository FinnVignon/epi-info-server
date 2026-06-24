# epi-info-server

Controller server and admin panel for Epi Info.

Use this repository to run the API, admin UI, MySQL database, asset storage, and client update notifications.

## Requirements

- Docker and Docker Compose
- npm, only for local development without Docker

## Start With Docker

Create the shared Docker network once:

```sh
docker network create epi-info-network
```

Start the server:

```sh
docker compose up --build
```

Open the admin panel:

```text
http://localhost:4000
```

On a fresh database, the admin panel asks you to create the first super admin.

MySQL data and uploaded assets are stored in Docker volumes, so they survive container restarts.

Archived assets are kept for 30 days by default, then deleted automatically once they no longer apply to any active client.

## Connect A Client

1. Start this server.
2. Log in to the admin panel.
3. Open the `Clients` page.
4. Generate an enrollment token.
5. Put that token in the client `.env` file before first client startup.

After the client enrolls, it appears in the admin panel and can receive individual, group, or global display assignments.

## Content Supported In 1.0

- uploaded images;
- uploaded videos;
- live web links with a refresh interval.

Text content and playlists are planned after 1.0.

## Useful Commands

Install dependencies:

```sh
npm install
```

Run the API locally:

```sh
npm run dev
```

Run the admin UI locally:

```sh
npm run dev:admin
```

Run checks:

```sh
npm run lint
npm test
npm audit --audit-level=low
```

Stop Docker containers:

```sh
docker compose down
```

To reset local server data, remove the Docker volumes intentionally.
