import { createPool, Pool } from "mysql2/promise";

import { ServerConfig } from "../config.js";

export function createDatabasePool(config: ServerConfig["mysql"]): Pool {
  return createPool({
    ...(config.socketPath
      ? {
          socketPath: config.socketPath,
        }
      : {
          host: config.host,
          port: config.port,
        }),
    database: config.database,
    password: config.password,
    user: config.user,
    waitForConnections: true,
    connectionLimit: 5,
  });
}
