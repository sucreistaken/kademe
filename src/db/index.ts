import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Serverless-friendly: no prepared statements, a small pool. Cloud Run scales to
// zero, so holding a large pool open buys nothing.
const client = postgres(connectionString, { prepare: false, max: 5 });

export const db = drizzle(client, { schema });
export { schema };
