import "dotenv/config";

export interface ServerConfig {
  adminAuth: {
    passwordBcryptRounds: number;
    sessionCookieName: string;
    sessionTtlHours: number;
  };
  adminDistPath?: string;
  assetUploadMaxBytes: number;
  assetStoragePath: string;
  clientAuth: {
    enrollmentTokenTtlMinutes: number;
    heartbeatIntervalSeconds: number;
    offlineAfterSeconds: number;
  };
  mysql: {
    database: string;
    host: string;
    password: string;
    port: number;
    user: string;
  };
  port: number;
  publicBaseUrl: string;
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

export function readConfig(): ServerConfig {
  return {
    adminAuth: {
      passwordBcryptRounds: readPositiveNumber("ADMIN_PASSWORD_BCRYPT_ROUNDS", 12),
      sessionCookieName: process.env.ADMIN_SESSION_COOKIE_NAME ?? "epi_info_admin_session",
      sessionTtlHours: readPositiveNumber("ADMIN_SESSION_TTL_HOURS", 12),
    },
    adminDistPath: process.env.ADMIN_DIST_PATH,
    assetUploadMaxBytes: readPositiveNumber("ASSET_UPLOAD_MAX_BYTES", 500 * 1024 * 1024),
    assetStoragePath: process.env.ASSET_STORAGE_PATH ?? "./data/assets",
    clientAuth: {
      enrollmentTokenTtlMinutes: readPositiveNumber("CLIENT_ENROLLMENT_TOKEN_TTL_MINUTES", 15),
      heartbeatIntervalSeconds: readPositiveNumber("CLIENT_HEARTBEAT_INTERVAL_SECONDS", 30),
      offlineAfterSeconds: readPositiveNumber("CLIENT_OFFLINE_AFTER_SECONDS", 90),
    },
    mysql: {
      database: process.env.MYSQL_DATABASE ?? "epi_info",
      host: process.env.MYSQL_HOST ?? "localhost",
      password: process.env.MYSQL_PASSWORD ?? "epi_info_dev_password",
      port: readNumber("MYSQL_PORT", 3306),
      user: process.env.MYSQL_USER ?? "epi_info",
    },
    port: readNumber("SERVER_PORT", 4000),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:4000",
  };
}
