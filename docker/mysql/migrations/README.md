# Database Migration Notes

The project currently uses:

- `docker/mysql/init/001_schema.sql` for fresh Docker volumes;
- focused startup compatibility checks in TypeScript for existing local volumes.

Until a dedicated migration runner is added, every database change must follow this checklist:

1. Update `docker/mysql/init/001_schema.sql` so new installations get the current schema.
2. Add or update a focused startup compatibility check when an existing local volume needs to be upgraded.
3. Keep the compatibility code in the database module for the affected domain.
4. Back up the server with `npm run backup:docker` before testing the schema change on real data.
5. Verify restore with `npm run restore:docker -- <backup-directory> --yes` on a non-production copy before relying on the backup.
6. Document the new table, column, index, or constraint in the implementation plan or context docs.

Do not make manual database edits that are not represented in source control. If a schema change cannot be safely represented by the current startup compatibility pattern, add a real migration runner before making that change.
