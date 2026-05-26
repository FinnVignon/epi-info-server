import "dotenv/config";

export interface ServerConfig {
  adminDistPath?: string;
  assetStoragePath: string;
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

export function readConfig(): ServerConfig {
  return {
    adminDistPath: process.env.ADMIN_DIST_PATH,
    assetStoragePath: process.env.ASSET_STORAGE_PATH ?? "./data/assets",
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
