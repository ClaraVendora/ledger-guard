import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.MERCHANT_DATABASE_URL ?? "postgres://lg:lg@localhost:5432/merchant" },
});
