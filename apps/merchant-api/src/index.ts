import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/account.js";
import { checkoutRoutes } from "./routes/checkout.js";
import { adminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
await app.register(cors, { origin: true, credentials: true });
await app.register(cookie);

app.get("/health", async () => ({ ok: true }));
await app.register(authRoutes);
await app.register(accountRoutes);
await app.register(checkoutRoutes);
await app.register(adminRoutes);

app.setErrorHandler((err: unknown, _req, reply) => {
  const e = err as { statusCode?: number; message?: string };
  const code = e.statusCode ?? 500;
  if (code >= 500) app.log.error(err);
  reply.code(code).send({ error: e.message ?? "error" });
});

const port = Number(process.env.PORT ?? process.env.MERCHANT_PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
