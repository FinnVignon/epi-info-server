#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/backup-server-data.sh [backup-root]

Creates a timestamped backup directory containing:
  - mysql.sql
  - assets.tar.gz
  - SHA256SUMS

The default backup root is ./backups.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${1:-$ROOT_DIR/backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

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

require_command docker

umask 077
mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT="$(cd "$BACKUP_ROOT" && pwd)"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

cd "$ROOT_DIR"
ensure_shared_network
docker compose up -d mysql >/dev/null
wait_for_mysql

echo "Writing MySQL dump..."
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --routines --triggers --events --add-drop-table -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  >"$BACKUP_DIR/mysql.sql"

echo "Writing asset archive..."
docker compose run --rm --no-deps -v "$BACKUP_DIR:/backup" server sh -c \
  'mkdir -p /data/assets && tar -C /data/assets -czf /backup/assets.tar.gz .'

if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "$BACKUP_DIR"
    sha256sum mysql.sql assets.tar.gz >SHA256SUMS
  )
fi

cat >"$BACKUP_DIR/README.txt" <<README
Epi Info server backup
Created at: $TIMESTAMP UTC

Contents:
- mysql.sql: MySQL database dump.
- assets.tar.gz: uploaded asset files from the server asset volume.
- SHA256SUMS: optional integrity checksums when sha256sum is available.

This backup can contain admin account data, password hashes, sessions, client
credentials, and uploaded media. Keep it private.

Restore with:
  scripts/restore-server-data.sh "$BACKUP_DIR" --yes
README

echo "Backup written to $BACKUP_DIR"
