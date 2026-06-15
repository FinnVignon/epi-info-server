# epi-info-server

Controller server for Epi Info.

This repository will contain:

- an Express API;
- a React admin interface;
- MySQL persistence;
- local asset storage for uploaded media;
- WebSocket notifications for connected clients.

## Development

```sh
npm install
npm run dev
```

Run the admin UI in another terminal:

```sh
npm run dev:admin
```

## Docker

Create the shared Epi Info network once:

```sh
docker network create epi-info-network
```

Then start the server:

```sh
docker compose up --build
```

The server listens on `http://localhost:4000`.

Docker Compose starts MySQL with a persistent volume and runs the SQL files in
`docker/mysql/init` when the database volume is created for the first time. This
means contributors do not need MySQL installed on their machine for local
development. MySQL is only exposed inside the Docker network by default, so it
does not conflict with a local database already using port `3306`.

The Compose stack shares the MySQL Unix socket with the API container. This
avoids dependence on host Docker bridge firewall rules. Outside Compose, leave
`MYSQL_SOCKET_PATH` empty and configure `MYSQL_HOST` and `MYSQL_PORT`.

The API also joins the external `epi-info-network` network under the
`epi-info-server` hostname. Client Compose stacks use this network for
registration, heartbeats, and content synchronization.

The Clients admin screen can assign an active image or video directly to one
registered client. The server updates an internal manifest revision so the
authenticated client can detect and download changed content. This revision is
not shown as an admin control.

The Groups admin screen manages display groups and client memberships.
Membership changes require permission for both the target group and client.
It can also send an active image or video to a permitted group.

The All Displays admin screen assigns an active image or video as the global
display command. It requires super-admin access or global `manage_assignments`
permission. For each client, the newest applicable individual, group, or global
send is displayed; the target scope does not have a priority.

If the schema changes after the MySQL volume already exists, use a migration or
recreate the local volume intentionally.
