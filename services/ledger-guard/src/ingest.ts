import { eq } from "drizzle-orm";
import type { Event, Decision } from "@lg/events";
import { db } from "./db/client.js";
import { events, decisions } from "./db/schema.js";
import { decide, currentPack } from "./engine/decide.js";

/** Store an event, decide on it, record the decision. Idempotent on event id. */
export async function ingest(e: Event): Promise<Decision & { idempotent?: boolean }> {
  const existing = await db
    .select({ id: decisions.id, action: decisions.action, score: decisions.score, severity: decisions.severity, firedRules: decisions.firedRules, features: decisions.features })
    .from(decisions)
    .where(eq(decisions.id, e.id))
    .limit(1);
  if (existing[0]) {
    const x = existing[0];
    return { eventId: e.id, action: x.action as Decision["action"], score: x.score, severity: x.severity as Decision["severity"], firedRules: x.firedRules as Decision["firedRules"], features: x.features as Decision["features"], idempotent: true };
  }
  // store first so features can see prior events of the same batch in time order
  await db
    .insert(events)
    .values({
      id: e.id,
      storeId: e.storeId,
      type: e.type,
      customerId: e.customerId ?? null,
      deviceId: e.deviceId ?? null,
      ip: e.ip ?? null,
      ipCountry: e.ipCountry ?? null,
      ipAsnType: e.ipAsnType ?? null,
      occurredAt: new Date(e.occurredAt),
      payload: e,
    })
    .onConflictDoNothing();
  const d = await decide(e);
  await db
    .insert(decisions)
    .values({
      id: e.id,
      storeId: e.storeId,
      customerId: e.customerId ?? null,
      eventType: e.type,
      occurredAt: new Date(e.occurredAt),
      action: d.action,
      score: d.score,
      severity: d.severity,
      firedRules: d.firedRules,
      features: d.features,
      ruleVersion: currentPack().version,
    })
    .onConflictDoNothing();
  return d;
}
