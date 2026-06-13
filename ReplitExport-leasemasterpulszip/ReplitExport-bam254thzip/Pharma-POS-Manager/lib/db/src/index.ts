import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? process.env.MYSQL_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or MYSQL_URL must be set to a MySQL connection string.",
  );
}

export const pool = createPool(databaseUrl);
export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
