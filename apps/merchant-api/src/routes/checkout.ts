import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import type { Tender, LineItem } from "@lg/events";
import { db } from "../db/client.js";
import { products, orders, ledgerEntries, giftCards, addresses, refunds } from "../db/schema.js";
import { requireSession } from "../auth.js";
import { balances } from "./account.js";
import { sendEvent, STORE_ID, newId, nowIso } from "../lg.js";
import { geoOf } from "../geo.js";
import { chargeCardLeg } from "../stripe.js";

export async function checkoutRoutes(app: FastifyInstance) {
  app.get("/products", async () => db.select().from(products));

  /**
   * Checkout. Order of operations is the whole point of the product:
   *   1. price the basket and the split tender
   *   2. ask Ledger Guard (sync)
   *   3. block -> no payment, no order written, customer sees a block screen
   *      review -> charge, write order with status review, merchant sees it in the queue
   *      allow  -> charge, write order, debit stored value, earn points
   */
  app.post("/checkout", async (req, reply) => {
    const s = await requireSession(req);
    const b = z
      .object({
        items: z.array(z.object({ sku: z.string(), qty: z.number().int().positive() })).min(1),
        shippingAddressId: z.string(),
        usePoints: z.number().nonnegative().default(0),
        useCredit: z.number().nonnegative().default(0),
        giftCardCodes: z.array(z.string()).default([]),
        cardFingerprint: z.string().default("visa-4242"),
        avs: z.enum(["pass", "fail", "unavailable"]).default("pass"),
        paymentMethodId: z.string().optional(),
      })
      .parse(req.body);

    const skus = b.items.map((i) => i.sku);
    const prods = await db.select().from(products).where(inArray(products.sku, skus));
    const lineItems: LineItem[] = b.items.map((i) => {
      const p = prods.find((x) => x.sku === i.sku)!;
      return { sku: p.sku, category: p.category, qty: i.qty, unitPrice: p.price, resalable: p.resalable };
    });
    const total = Number(lineItems.reduce((a, l) => a + l.qty * l.unitPrice, 0).toFixed(2));

    const bal = await balances(s.customerId);
    const tenders: Tender[] = [];
    let remaining = total;
    const usePoints = Math.min(b.usePoints, bal.points, remaining);
    if (usePoints > 0) { tenders.push({ kind: "points", amount: usePoints }); remaining -= usePoints; }
    const useCredit = Math.min(b.useCredit, bal.credit, remaining);
    if (useCredit > 0) { tenders.push({ kind: "credit", amount: useCredit }); remaining -= useCredit; }
    const cards = b.giftCardCodes.length ? await db.select().from(giftCards).where(inArray(giftCards.code, b.giftCardCodes.map((c) => c.toUpperCase()))) : [];
    for (const gc of cards) {
      const use = Math.min(gc.balance, remaining);
      if (use > 0) { tenders.push({ kind: "gift_card", amount: use, instrumentId: gc.id }); remaining -= use; }
    }
    remaining = Number(remaining.toFixed(2));
    if (remaining > 0) tenders.push({ kind: "card", amount: remaining, cardFingerprint: b.cardFingerprint, avs: b.avs, cvc: "pass" });

    const addr = (await db.select().from(addresses).where(eq(addresses.id, b.shippingAddressId)).limit(1))[0];
    if (!addr || addr.customerId !== s.customerId) return reply.code(400).send({ error: "bad_address" });
    const prior = await db.select({ id: orders.id }).from(orders).where(eq(orders.shippingAddressId, b.shippingAddressId)).limit(1);
    const newShippingAddress = prior.length === 0;

    const orderId = newId("ord");
    const decision = await sendEvent(
      {
        id: orderId,
        source: "merchant",
        storeId: STORE_ID,
        occurredAt: nowIso(),
        type: "order.created",
        customerId: s.customerId,
        email: s.email,
        deviceId: s.deviceId,
        ...geoOf(req),
        orderId,
        total,
        tenders,
        lineItems,
        shippingAddressId: b.shippingAddressId,
        newShippingAddress,
        platformRisk: "low", // what a card-only risk score would say about a small card leg
      },
      { wait: true },
    );
    const action = decision?.action ?? "allow"; // engine down: fail open, log it

    if (action === "block") {
      await db.insert(orders).values({ id: orderId, customerId: s.customerId, total, tenders, lineItems, shippingAddressId: b.shippingAddressId, status: "blocked", lgDecision: decision });
      return reply.code(402).send({
        status: "blocked",
        orderId,
        message: "We could not complete this order. Reference " + orderId.slice(-6).toUpperCase() + ". Please contact support.",
        reasonCode: decision?.firedRules[0]?.ruleId ?? "risk",
      });
    }

    const cardLeg = tenders.find((t) => t.kind === "card")?.amount ?? 0;
    const pi = await chargeCardLeg(cardLeg, orderId, b.paymentMethodId);

    // debit stored value
    const entries = [] as (typeof ledgerEntries.$inferInsert)[];
    if (usePoints > 0) entries.push({ id: newId("le"), customerId: s.customerId, kind: "points", amount: -usePoints, reason: "redeem", refId: orderId });
    if (useCredit > 0) entries.push({ id: newId("le"), customerId: s.customerId, kind: "credit", amount: -useCredit, reason: "redeem", refId: orderId });
    for (const t of tenders.filter((t) => t.kind === "gift_card")) {
      await db.update(giftCards).set({ balance: (cards.find((c) => c.id === t.instrumentId)!.balance - t.amount) }).where(eq(giftCards.id, t.instrumentId!));
    }
    // earn points: 1 point per dollar on the card leg only
    const earned = Math.floor(cardLeg);
    if (earned > 0) entries.push({ id: newId("le"), customerId: s.customerId, kind: "points", amount: earned, reason: "earn", refId: orderId });
    if (entries.length) await db.insert(ledgerEntries).values(entries);
    if (earned > 0) await sendEvent({ id: `earn_${orderId}`, source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "value.issue", customerId: s.customerId, kind: "points", amount: earned, reason: "earn", refOrderId: orderId });

    await db.insert(orders).values({ id: orderId, customerId: s.customerId, total, tenders, lineItems, shippingAddressId: b.shippingAddressId, status: action === "review" ? "review" : "placed", stripePaymentIntentId: pi?.id ?? null, lgDecision: decision });
    return { status: action === "review" ? "review" : "placed", orderId, total, tenders, paymentIntent: pi };
  });

  /** Refund claim. Destination credit means the merchant issues store credit: the issuance path. */
  app.post("/orders/:id/refund", async (req, reply) => {
    const s = await requireSession(req);
    const { id } = req.params as { id: string };
    const b = z.object({ amount: z.number().positive(), reason: z.enum(["item_not_received", "damaged", "spoiled", "wrong_item", "changed_mind", "other"]), destination: z.enum(["card", "credit"]) }).parse(req.body);
    const o = (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0];
    if (!o || o.customerId !== s.customerId) return reply.code(404).send({ error: "not_found" });
    const refundId = newId("ref");
    await db.insert(refunds).values({ id: refundId, orderId: id, customerId: s.customerId, amount: b.amount, reason: b.reason, destination: b.destination });
    await sendEvent({ id: refundId, source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "refund.created", customerId: s.customerId, refundId, orderId: id, amount: b.amount, reason: b.reason, destination: b.destination, deviceId: s.deviceId });
    if (b.destination === "credit") {
      await db.insert(ledgerEntries).values({ id: newId("le"), customerId: s.customerId, kind: "credit", amount: b.amount, reason: "refund", refId: refundId });
      await sendEvent({ id: `issue_${refundId}`, source: "merchant", storeId: STORE_ID, occurredAt: nowIso(), type: "value.issue", customerId: s.customerId, kind: "credit", amount: b.amount, reason: "refund", refOrderId: id, refRefundId: refundId, deviceId: s.deviceId });
    }
    return { ok: true, refundId };
  });
}
