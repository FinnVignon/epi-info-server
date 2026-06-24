#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/restore-server-data.sh <backup-directory> --yes

Restores:
  - mysql.sql into the MySQL database
  - assets.tar.gz into the uploaded asset volume

This replaces the current server database tables and uploaded asset files.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 2 || "${2:-}" != "--yes" ]]; then
  usage >&2
  echo >&2
  echo "Restore is destructive. Re-run with --yes when you are sure." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$1"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_shared_network() {
  if ! docker network inspect epi-info-network >/dev/null 2>&1; then
    docker network create epi-info-network >/dev/null
  fi
}

wait_for_mysql() {
  echo "Waiting for MySQL..."
  until docker compose exec -T mysql sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqladmin ping -h 127.0.0.1 -uroot --silent' \
    >/dev/null 2>&1; do
    sleep 2
  done
}

require_backup_file() {
  if [[ ! -f "$BACKUP_DIR/$1" ]]; then
    echo "Missing backup file: $BACKUP_DIR/$1" >&2
    exit 1
  fi
}

require_command docker

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory does not exist: $BACKUP_DIR" >&2
  exit 1
fi

BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
require_backup_file mysql.sql
require_backup_file assets.tar.gz

if [[ -f "$BACKUP_DIR/SHA256SUMS" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then
    (
      cd "$BACKUP_DIR"
      sha256sum -c SHA256SUMS
    )
  else
    echo "Skipping checksum verification because sha256sum is not installed."
  fi
fi

cd "$ROOT_DIR"
ensure_shared_network

SERVER_WAS_RUNNING="no"
if docker compose ps --services --filter status=running | grep -qx "server"; then
  SERVER_WAS_RUNNING="yes"
fi

docker compose up -d mysql >/dev/null
wait_for_mysql

echo "Stopping server during restore..."
docker compose stop server >/dev/null 2>&1 || true

echo "Restoring MySQL dump..."
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  <"$BACKUP_DIR/mysql.sql"

echo "Restoring asset archive..."
docker compose run --rm --no-deps -v "$BACKUP_DIR:/backup:ro" server sh -c \
  'mkdir -p /data/assets && find /data/assets -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -C /data/assets -xzf /backup/assets.tar.gz'

if [[ "$SERVER_WAS_RUNNING" == "yes" ]]; then
  echo "Restarting server..."
  docker compose up -d server >/dev/null
fi

echo "Restore completed from $BACKUP_DIR"
