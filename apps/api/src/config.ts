import "dotenv/config";

export interface ServerConfig {
  adminAuth: {
    allowedOrigins: string[];
    passwordBcryptRounds: number;
    sessionCookieName: string;
    sessionTtlHours: number;
  };
  adminDistPath?: string;
  assetCleanup: {
    intervalHours: number;
    retentionDays: number;
  };
  assetUploadMaxBytes: number;
  assetStoragePath: string;
  databaseMigrationsPath: string;
  clientAuth: {
    enrollmentTokenTtlMinutes: number;
    heartbeatIntervalSeconds: number;
    offlineAfterSeconds: number;
    pairingPollIntervalSeconds: number;
    pairingSessionTtlMinutes: number;
  };
  mysql: {
    database: string;
    host: string;
    password: string;
    port: number;
    socketPath?: string;
    user: string;
  };
  port: number;
  publicBaseUrl: string;
  temporaryRecordCleanup: {
    intervalHours: number;
    usedEnrollmentTokenRetentionDays: number;
  };
}

function readNumber(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a number`);
  }

  return value;
}

function readPositiveNumber(name: string, fallback: number): number {
  const value = readNumber(name, fallback);

  if (value <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }

  return value;
}

function readCsv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function readConfig(): ServerConfig {
  const mysqlSocketPath = process.env.MYSQL_SOCKET_PATH?.trim();

  return {
    adminAuth: {
      allowedOrigins: readCsv("ADMIN_ALLOWED_ORIGINS"),
      passwordBcryptRounds: readPositiveNumber("ADMIN_PASSWORD_BCRYPT_ROUNDS", 12),
      sessionCookieName: process.env.ADMIN_SESSION_COOKIE_NAME ?? "epi_info_admin_session",
      sessionTtlHours: readPositiveNumber("ADMIN_SESSION_TTL_HOURS", 12),
    },
    adminDistPath: process.env.ADMIN_DIST_PATH,
    assetCleanup: {
      intervalHours: readPositiveNumber("ASSET_CLEANUP_INTERVAL_HOURS", 24),
      retentionDays: readPositiveNumber("ASSET_ARCHIVE_RETENTION_DAYS", 30),
    },
    assetUploadMaxBytes: readPositiveNumber("ASSET_UPLOAD_MAX_BYTES", 500 * 1024 * 1024),
    assetStoragePath: process.env.ASSET_STORAGE_PATH ?? "./data/assets",
    databaseMigrationsPath: process.env.DATABASE_MIGRATIONS_PATH ?? "docker/mysql/migrations",
    clientAuth: {
      enrollmentTokenTtlMinutes: readPositiveNumber("CLIENT_ENROLLMENT_TOKEN_TTL_MINUTES", 15),
      heartbeatIntervalSeconds: readPositiveNumber("CLIENT_HEARTBEAT_INTERVAL_SECONDS", 30),
      offlineAfterSeconds: readPositiveNumber("CLIENT_OFFLINE_AFTER_SECONDS", 90),
      pairingPollIntervalSeconds: readPositiveNumber("CLIENT_PAIRING_POLL_INTERVAL_SECONDS", 5),
      pairingSessionTtlMinutes: readPositiveNumber("CLIENT_PAIRING_SESSION_TTL_MINUTES", 10),
    },
    mysql: {
      database: process.env.MYSQL_DATABASE ?? "epi_info",
      host: process.env.MYSQL_HOST ?? "localhost",
      password: process.env.MYSQL_PASSWORD ?? "epi_info_dev_password",
      port: readNumber("MYSQL_PORT", 3306),
      ...(mysqlSocketPath ? { socketPath: mysqlSocketPath } : {}),
      user: process.env.MYSQL_USER ?? "epi_info",
    },
    port: readNumber("SERVER_PORT", 4000),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:4000",
    temporaryRecordCleanup: {
      intervalHours: readPositiveNumber("TEMPORARY_RECORD_CLEANUP_INTERVAL_HOURS", 24),
      usedEnrollmentTokenRetentionDays: readPositiveNumber(
        "USED_ENROLLMENT_TOKEN_RETENTION_DAYS",
        30,
      ),
    },
  };
}
