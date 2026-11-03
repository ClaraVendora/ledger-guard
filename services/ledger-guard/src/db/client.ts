import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.LG_DATABASE_URL ?? "postgres://lg:lg@localhost:5432/ledger_guard";

/**
 * Two clients on purpose. Drizzle rewrites the timestamp serialisers on the
 * client it is given (it passes dates as strings itself), which breaks raw
 * tagged-template queries that bind Date objects. The raw client keeps the
 * default serialisers.
 */
export const sql = postgres(url, { max: 10 });
export const db = drizzle(postgres(url, { max: 5 }), { schema });
export type Db = typeof db;
