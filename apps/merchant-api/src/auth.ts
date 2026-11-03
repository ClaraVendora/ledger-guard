import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { customers, sessions, devices } from "./db/schema.js";
import { sendEvent, STORE_ID, newId, nowIso } from "./lg.js";
import { geoOf, type Geo } from "./geo.js";

export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(24).toString("hex");

export type Session = { customerId: string; deviceId: string; email: string };

export async function requireSession(req: FastifyRequest): Promise<Session> {
  const t = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || (req.cookies?.lg_session as string | undefined);
  if (!t) throw Object.assign(new Error("unauthenticated"), { statusCode: 401 });
  const s = (await db.select().from(sessions).where(eq(sessions.token, t)).limit(1))[0];
  if (!s) throw Object.assign(new Error("unauthenticated"), { statusCode: 401 });
  const c = (await db.select().from(customers).where(eq(customers.id, s.customerId)).limit(1))[0];
  return { customerId: s.customerId, deviceId: s.deviceId, email: c.email };
}

/** Records the device and emits auth.new_device the first time it is seen for this customer. */
export async function touchDevice(customerId: string, deviceId: string, geo?: Geo) {
  const existing = (await db.select().from(devices).where(eq(devices.id, `${customerId}:${deviceId}`)).limit(1))[0];
  if (existing) {
    await db.update(devices).set({ lastSeen: new Date() }).where(eq(devices.id, existing.id));
    return false;
  }
  await db.insert(devices).values({ id: `${customerId}:${deviceId}`, customerId, label: deviceId });
  await sendEvent({ id: newId("evt"), source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "auth.new_device", customerId, deviceId, ...geo });
  return true;
}
