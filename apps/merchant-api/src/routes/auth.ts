import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { customers, sessions, passwordResets } from "../db/schema.js";
import { hash, token, touchDevice, requireSession } from "../auth.js";
import { sendEvent, STORE_ID, newId, nowIso } from "../lg.js";
import { geoOf } from "../geo.js";
import { sendMail } from "../mail.js";

const deviceOf = (req: any) => (req.headers["x-device-id"] as string | undefined) ?? "unknown-device";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (req) => {
    const b = z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(6) }).parse(req.body);
    const id = newId("cus");
    await db.insert(customers).values({ id, email: b.email.toLowerCase(), name: b.name, passwordHash: hash(b.password) });
    const t = token();
    const deviceId = deviceOf(req);
    await db.insert(sessions).values({ token: t, customerId: id, deviceId });
    await touchDevice(id, deviceId, geoOf(req));
    await sendEvent({ id: newId("evt"), source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "auth.login", customerId: id, deviceId, ...geoOf(req), email: b.email });
    return { token: t, customerId: id };
  });

  app.post("/auth/login", async (req, reply) => {
    const b = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const c = (await db.select().from(customers).where(eq(customers.email, b.email.toLowerCase())).limit(1))[0];
    const deviceId = deviceOf(req);
    if (!c || c.passwordHash !== hash(b.password)) {
      if (c) await sendEvent({ id: newId("evt"), source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "auth.login_failed", customerId: c.id, deviceId, ...geoOf(req) });
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const t = token();
    await db.insert(sessions).values({ token: t, customerId: c.id, deviceId });
    const isNew = await touchDevice(c.id, deviceId, geoOf(req));
    await sendEvent({ id: newId("evt"), source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "auth.login", customerId: c.id, deviceId, ...geoOf(req), email: c.email });
    return { token: t, customerId: c.id, newDevice: isNew };
  });

  app.post("/auth/forgot", async (req) => {
    const b = z.object({ email: z.string().email() }).parse(req.body);
    const c = (await db.select().from(customers).where(eq(customers.email, b.email.toLowerCase())).limit(1))[0];
    if (!c) return { ok: true }; // do not leak existence
    const t = token();
    await db.insert(passwordResets).values({ token: t, customerId: c.id });
    const link = `${process.env.STOREFRONT_URL ?? "http://localhost:3000"}/reset?token=${t}`;
    const mail = await sendMail(c.email, "Reset your password", `Hi ${c.name}, reset your password here: ${link}`, link);
    return { ok: true, outboxId: mail.id, delivered: mail.delivered };
  });

  app.post("/auth/reset", async (req, reply) => {
    const b = z.object({ token: z.string(), password: z.string().min(6) }).parse(req.body);
    const r = (await db.select().from(passwordResets).where(eq(passwordResets.token, b.token)).limit(1))[0];
    if (!r || r.used) return reply.code(400).send({ error: "invalid_token" });
    await db.update(passwordResets).set({ used: true }).where(eq(passwordResets.token, b.token));
    await db.update(customers).set({ passwordHash: hash(b.password) }).where(eq(customers.id, r.customerId));
    const deviceId = deviceOf(req);
    // Reset signals the account may be in new hands. Emit before the login that follows.
    await sendEvent({ id: newId("evt"), source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "auth.reset", customerId: r.customerId, deviceId, ...geoOf(req) });
    const t = token();
    await db.insert(sessions).values({ token: t, customerId: r.customerId, deviceId });
    const isNew = await touchDevice(r.customerId, deviceId, geoOf(req));
    await sendEvent({ id: newId("evt"), source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "auth.login", customerId: r.customerId, deviceId, ...geoOf(req) });
    return { token: t, customerId: r.customerId, newDevice: isNew };
  });

  app.post("/auth/logout", async (req) => {
    const s = await requireSession(req);
    await db.delete(sessions).where(eq(sessions.customerId, s.customerId));
    return { ok: true };
  });
}
