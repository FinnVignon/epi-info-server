import { createPool, Pool } from "mysql2/promise";

import { ServerConfig } from "../config.js";

export function createDatabasePool(config: ServerConfig["mysql"]): Pool {
  return createPool({
    database: config.database,
    host: config.host,
    password: config.password,
    port: config.port,
    user: config.user,
    waitForConnections: true,
    connectionLimit: 5,
  });
}
