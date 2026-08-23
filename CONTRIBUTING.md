# Contributing

Development is integrated through the `DEV` branch. Create a focused branch from the current
`DEV`, keep unrelated changes out, and open a review before merging.

Use short commit subjects with the established prefixes:

- `[ADD]` for a new capability;
- `[FIX]` for a defect or security repair;
- `[UPDATE]` for a behavior, dependency, or organization change;
- `[DOCS]` for documentation only.

Before every potential push, run:

```sh
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm audit --audit-level=low
docker build -t epi-info-server:local .
```

For changes involving MySQL, startup, assets, authentication, or assignments, also run a fresh
Docker Compose stack and exercise the affected HTTP workflow.

Keep modules purpose-specific. Routes handle HTTP, services coordinate workflows, database modules
own SQL, and shared files define contracts. Avoid adding business logic to `index.ts` or React API
calls directly to page components. Prefer small focused tests beside the repository-level `tests/`
suite over replacing tests with a build command.

Database changes require a new ordered SQL file under `docker/mysql/migrations/`. Do not modify an
applied migration. Verify both a blank database and an upgrade from the previous release.

Do not commit `.env`, database volumes, uploaded assets, backups, client credentials, admin
credentials, or generated `dist/` output.
