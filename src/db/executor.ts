import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/**
 * The database or a transaction on it. Helpers that must run inside a caller's
 * transaction take one of these instead of importing `db`.
 */
export type Executor = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;
