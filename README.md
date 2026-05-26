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

```sh
docker compose up --build
```

The server listens on `http://localhost:4000`.
