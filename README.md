# epi-info-server

Controller server and admin panel for Epi Info.

Use this repository to run the API, admin UI, MySQL database, asset storage, and client update notifications.

## Requirements

- Docker and Docker Compose
- Git, for repository installs
- npm, only for local development without Docker

## Run From The Repository

Create the shared Docker network once:

```sh
docker network create epi-info-network
```

Clone or update the repository, then start the server stack:

```sh
git clone <server-repository-url> epi-info-server
cd epi-info-server
```

If the repository is already cloned, update it instead:

```sh
git pull
```

Start the server:

```sh
docker compose up -d --build
```

Open the admin panel:

```text
http://localhost:4000
```

On a fresh database, the admin panel asks you to create the first super admin.

## Run From Docker Hub

Create a folder for the server deployment:

```sh
mkdir epi-info-server
cd epi-info-server
```

Create the shared Docker network once:

```sh
docker network create epi-info-network
```

Pull the published image:

```sh
docker pull shortplanet/epi-info-server:1.0.0
```

Create `docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8.4
    command: ["--bind-address=0.0.0.0"]
    environment:
      MYSQL_DATABASE: epi_info
      MYSQL_USER: epi_info
      MYSQL_PASSWORD: change_this_database_password
      MYSQL_ROOT_PASSWORD: change_this_root_password
    healthcheck:
      test:
        [
          "CMD-SHELL",
          'MYSQL_PWD="$$MYSQL_PASSWORD" mysqladmin ping -h 127.0.0.1 -u"$$MYSQL_USER" --silent',
        ]
      interval: 5s
      timeout: 3s
      retries: 20
    volumes:
      - mysql-data:/var/lib/mysql

  server:
    image: shortplanet/epi-info-server:1.0.0
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      SERVER_PORT: 4000
      MYSQL_HOST: mysql
      MYSQL_PORT: 3306
      MYSQL_DATABASE: epi_info
      MYSQL_USER: epi_info
      MYSQL_PASSWORD: change_this_database_password
      ASSET_STORAGE_PATH: /data/assets
      PUBLIC_BASE_URL: http://localhost:4000
      ADMIN_DIST_PATH: /app/dist/admin
    ports:
      - "4000:4000"
    volumes:
      - server-assets:/data/assets
    networks:
      default:
      epi-info:
        aliases:
          - epi-info-server

volumes:
  mysql-data:
  server-assets:

networks:
  epi-info:
    external: true
    name: epi-info-network
```

Start the server:

```sh
docker compose up -d
```

Then open:

```text
http://localhost:4000
```

MySQL data and uploaded assets are stored in Docker volumes, so they survive container restarts.

Archived assets are kept for 30 days by default, then deleted automatically once they no longer apply to any active client.

## Admin Request Protection

Admin `POST`, `PUT`, `PATCH`, and `DELETE` requests are accepted only from the same host, `PUBLIC_BASE_URL`, local Vite development origins, or comma-separated origins listed in `ADMIN_ALLOWED_ORIGINS`.

For example, when serving the admin panel behind a hostname:

```env
PUBLIC_BASE_URL=https://screens.example.com
ADMIN_ALLOWED_ORIGINS=https://screens.example.com
```

## Backup And Restore

Create a backup of the MySQL database and uploaded assets:

```sh
npm run backup:docker
```

Backups are written to `backups/<timestamp>/` by default. The `backups/` folder is ignored by Git.

Backups contain admin account data, password hashes, sessions, client credentials, and uploaded media. Keep them private.

Restore a backup:

```sh
npm run restore:docker -- backups/<timestamp> --yes
```

Restore replaces the current server database tables and uploaded asset files. Stop clients or avoid changing assignments while restoring.

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

Create a Docker-volume backup:

```sh
npm run backup:docker
```

Stop Docker containers:

```sh
docker compose down
```

To reset local server data, remove the Docker volumes intentionally.
