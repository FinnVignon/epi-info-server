# Database Migrations

The API applies the ordered SQL files in this directory before it starts listening. This is the
same path for repository builds and published Docker images, so fresh installations do not depend
on a host-mounted MySQL initialization directory.

Applied filenames and SHA-256 checksums are stored in `schema_migrations`. Startup fails when an
already-applied migration has been edited.

For every database change:

1. Add a new migration with the next zero-padded number, for example `002_add_schedule.sql`.
2. Make the migration safe to retry. MySQL commits many DDL statements implicitly, so a failed
   migration can be partially applied before it is recorded.
3. Do not edit an applied migration. Add a corrective migration instead.
4. Keep `001_initial_schema.sql` representative of the initial V1 schema.
5. Back up real data before applying a new migration and verify restoration on a non-production
   copy.
6. Add integration coverage for both a blank database and an existing database.

The focused TypeScript compatibility checks remain temporarily for databases created before the
migration runner. New schema changes should be represented by SQL migrations.
