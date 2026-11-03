import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, desc, sql as dsql } from "drizzle-orm";
import { db } from "../db/client.js";
import { customers, ledgerEntries, giftCards, addresses, orders, outbox } from "../db/schema.js";
import { requireSession } from "../auth.js";
import { sendEvent, STORE_ID, newId, nowIso } from "../lg.js";
import { geoOf } from "../geo.js";

export async function balances(customerId: string) {
  const rows = await db
    .select({ kind: ledgerEntries.kind, total: dsql<number>`coalesce(sum(${ledgerEntries.amount}),0)` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.customerId, customerId))
    .groupBy(ledgerEntries.kind);
  const b = { points: 0, credit: 0 };
  for (const r of rows) (b as any)[r.kind] = Number(r.total);
  const cards = await db.select().from(giftCards).where(eq(giftCards.purchaserId, customerId));
  return { ...b, giftCards: cards.map((c) => ({ id: c.id, code: c.code, balance: c.balance })) };
}

export async function accountRoutes(app: FastifyInstance) {
  app.get("/me", async (req) => {
    const s = await requireSession(req);
    const c = (await db.select().from(customers).where(eq(customers.id, s.customerId)).limit(1))[0];
    const addr = await db.select().from(addresses).where(eq(addresses.customerId, s.customerId));
    const hist = await db.select().from(ledgerEntries).where(eq(ledgerEntries.customerId, s.customerId)).orderBy(desc(ledgerEntries.createdAt)).limit(50);
    const ord = await db.select().from(orders).where(eq(orders.customerId, s.customerId)).orderBy(desc(orders.createdAt)).limit(20);
    return { customer: { id: c.id, email: c.email, name: c.name, createdAt: c.createdAt }, deviceId: s.deviceId, balances: await balances(s.customerId), addresses: addr, ledger: hist, orders: ord };
  });

  /** Transfer points or credit to another customer by email. */
  app.post("/value/transfer", async (req, reply) => {
    const s = await requireSession(req);
    const b = z.object({ toEmail: z.string().email(), kind: z.enum(["points", "credit"]), amount: z.number().positive() }).parse(req.body);
    const to = (await db.select().from(customers).where(eq(customers.email, b.toEmail.toLowerCase())).limit(1))[0];
    if (!to) return reply.code(404).send({ error: "recipient_not_found" });
    const bal = await balances(s.customerId);
    if ((bal as any)[b.kind] < b.amount) return reply.code(400).send({ error: "insufficient_balance" });
    const ref = newId("xfer");
    await db.insert(ledgerEntries).values([
      { id: newId("le"), customerId: s.customerId, kind: b.kind, amount: -b.amount, reason: "transfer_out", refId: ref },
      { id: newId("le"), customerId: to.id, kind: b.kind, amount: b.amount, reason: "transfer_in", refId: ref },
    ]);
    const d = await sendEvent(
      { id: ref, source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "value.transfer", customerId: s.customerId, toCustomerId: to.id, kind: b.kind, amount: b.amount, deviceId: s.deviceId, ...geoOf(req) },
      { wait: true },
    );
    return { ok: true, transferId: ref, decision: d?.action ?? "unknown" };
  });

  /** Buy a gift card with a card (test mode). Loads value into the ledger. */
  app.post("/giftcards/buy", async (req) => {
    const s = await requireSession(req);
    const b = z.object({ amount: z.number().positive(), cardFingerprint: z.string().default("visa-4242") }).parse(req.body);
    const id = newId("gc");
    const code = `GC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await db.insert(giftCards).values({ id, code, purchaserId: s.customerId, initialValue: b.amount, balance: b.amount, cardFingerprint: b.cardFingerprint });
    const d = await sendEvent(
      { id: `load_${id}`, source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "value.load", customerId: s.customerId, kind: "gift_card", amount: b.amount, instrumentId: id, cardFingerprint: b.cardFingerprint, deviceId: s.deviceId, ...geoOf(req) },
      { wait: true },
    );
    return { id, code, balance: b.amount, decision: d?.action ?? "unknown" };
  });

  /** Balance check by code. Emits an event whether or not the code exists; this is what enumeration looks like. */
  app.get("/giftcards/balance", async (req) => {
    const q = z.object({ code: z.string() }).parse(req.query);
    const deviceId = (req.headers["x-device-id"] as string | undefined) ?? "unknown-device";
    const gc = (await db.select().from(giftCards).where(eq(giftCards.code, q.code.toUpperCase())).limit(1))[0];
    await sendEvent({ id: newId("gcchk"), source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "giftcard.balance_check", code: q.code.toUpperCase(), valid: Boolean(gc), deviceId, ...geoOf(req) });
    return gc ? { valid: true, balance: gc.balance } : { valid: false };
  });

  app.post("/addresses", async (req) => {
    const s = await requireSession(req);
    const b = z.object({ line1: z.string(), city: z.string(), zip: z.string() }).parse(req.body);
    const id = newId("addr");
    await db.insert(addresses).values({ id, customerId: s.customerId, ...b });
    return { id };
  });

  app.get("/outbox", async () => db.select().from(outbox).orderBy(desc(outbox.createdAt)).limit(20));
}
