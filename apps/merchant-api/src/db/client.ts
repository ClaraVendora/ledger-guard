import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.MERCHANT_DATABASE_URL ?? "postgres://lg:lg@localhost:5432/merchant";

/** Separate raw client: Drizzle rewrites timestamp serialisers on the client it owns. */
export const sql = postgres(url, { max: 5 });
export const db = drizzle(postgres(url, { max: 5 }), { schema });
