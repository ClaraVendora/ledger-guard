import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  schemaFilter: ["ledger_guard"],
  dbCredentials: { url: process.env.LG_DATABASE_URL ?? "postgres://lg:lg@localhost:5432/ledger_guard" },
});
