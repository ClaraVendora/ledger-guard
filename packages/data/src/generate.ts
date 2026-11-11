/**
 * Synthetic specialty grocer: 90 days, N customers, realistic repeat cadence,
 * split tenders, normal refund and promo rates, plus labelled fraud scenarios.
 *
 * Output: out/events.jsonl (time ordered) and out/labels.json ({ eventId: scenario }).
 *
 * Usage: pnpm data:generate [--customers 2000] [--days 90] [--seed 7] [--store demo-grocer]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Event, Tender, LineItem } from "@lg/events";
import { makeRng, type Rng } from "./rng.js";
import { injectScenarios, type World } from "./scenarios.js";

import { pathToFileURL } from "node:url";

export type GenerateOptions = { customers?: number; days?: number; seed?: number; store?: string };
export const DEFAULTS = { customers: 300, days: 180, seed: 7, store: "demo-grocer" };

// Set per generateWorld() call; the event builders below read it.
let STORE = DEFAULTS.store;

const CATALOGUE: Omit<LineItem, "qty">[] = [
  { sku: "WINE-BAROLO-21", category: "wine", unitPrice: 68, resalable: true },
  { sku: "WINE-CHABLIS-22", category: "wine", unitPrice: 42, resalable: true },
  { sku: "SPIRIT-MEZCAL", category: "spirits", unitPrice: 55, resalable: true },
  { sku: "SPIRIT-RYE", category: "spirits", unitPrice: 49, resalable: true },
  { sku: "CHEESE-COMTE", category: "cheese", unitPrice: 14, resalable: false },
  { sku: "MEAT-WAGYU", category: "meat", unitPrice: 89, resalable: true },
  { sku: "FISH-SALMON", category: "fish", unitPrice: 24, resalable: false },
  { sku: "PRODUCE-BERRIES", category: "produce", unitPrice: 11, resalable: false },
  { sku: "PANTRY-OLIVEOIL", category: "pantry", unitPrice: 28, resalable: false },
  { sku: "PANTRY-FORMULA", category: "baby", unitPrice: 36, resalable: true },
  { sku: "BAKERY-SOURDOUGH", category: "bakery", unitPrice: 9, resalable: false },
  { sku: "DAIRY-BUTTER", category: "dairy", unitPrice: 7, resalable: false },
];

export type Customer = {
  id: string;
  country: string;
  email: string;
  deviceId: string;
  addressId: string;
  cardFingerprint: string;
  cadenceDays: number; // typical days between orders
  basketMean: number;
  svPropensity: number; // share of orders that use stored value
  refundPropensity: number;
  points: number;
  credit: number;
  giftCards: { id: string; balance: number }[];
  createdAt: Date;
  lastOrderAt: Date | null;
  orderCount: number;
};

const DAY = 86400_000;
let seq = 0;
export const eid = (p: string) => `${p}_${(++seq).toString(36).padStart(6, "0")}`;

export function makeCustomer(rng: Rng, i: number, start: Date): Customer {
  const createdAt = new Date(start.getTime() - rng.int(30, 720) * DAY);
  return {
    id: `cus_${i.toString(36).padStart(5, "0")}`,
    email: `customer${i}@example.com`,
    deviceId: `dev_${i.toString(36)}`,
    addressId: `addr_${i.toString(36)}_home`,
    cardFingerprint: `card_${i.toString(36)}`,
    country: "US",
    cadenceDays: Math.max(3, rng.normal(10, 5)),
    basketMean: Math.max(25, rng.normal(85, 35)),
    svPropensity: Math.min(0.6, Math.max(0, rng.normal(0.25, 0.15))),
    refundPropensity: Math.min(0.08, Math.max(0, rng.normal(0.02, 0.015))),
    points: rng.int(0, 150),
    credit: rng.chance(0.3) ? rng.int(5, 60) : 0,
    giftCards: rng.chance(0.15) ? [{ id: `gc_${i.toString(36)}`, balance: rng.pick([25, 50, 100]) }] : [],
    createdAt,
    lastOrderAt: null,
    orderCount: 0,
  };
}

export function basket(rng: Rng, mean: number): LineItem[] {
  const n = rng.int(2, 7);
  const items: LineItem[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const p = rng.pick(CATALOGUE);
    const qty = rng.int(1, 3);
    items.push({ ...p, qty });
    total += p.unitPrice * qty;
  }
  // scale toward the customer's mean by trimming quantities
  while (total > mean * 1.6 && items.length > 1) {
    const it = items.pop()!;
    total -= it.unitPrice * it.qty;
  }
  return items;
}

export const orderTotal = (items: LineItem[]) => Number(items.reduce((a, l) => a + l.qty * l.unitPrice, 0).toFixed(2));

/** Split a total across stored value and card the way a normal customer would. */
export function tendersFor(rng: Rng, c: Customer, total: number, useSv: boolean, maxSvShare = 0.4): Tender[] {
  const t: Tender[] = [];
  let remaining = total;
  if (useSv) {
    const cap = total * maxSvShare;
    const usePts = Math.min(c.points, cap, remaining);
    if (usePts > 0) { t.push({ kind: "points", amount: Number(usePts.toFixed(2)) }); remaining -= usePts; c.points -= usePts; }
    const useCr = Math.min(c.credit, cap - usePts, remaining);
    if (useCr > 0) { t.push({ kind: "credit", amount: Number(useCr.toFixed(2)) }); remaining -= useCr; c.credit -= useCr; }
    const gc = c.giftCards[0];
    if (gc && gc.balance > 0 && rng.chance(0.5)) {
      const use = Math.min(gc.balance, remaining);
      if (use > 0) { t.push({ kind: "gift_card", amount: Number(use.toFixed(2)), instrumentId: gc.id }); remaining -= use; gc.balance -= use; }
    }
  }
  remaining = Number(remaining.toFixed(2));
  if (remaining > 0) t.push({ kind: "card", amount: remaining, cardFingerprint: c.cardFingerprint, avs: "pass", cvc: "pass" });
  return t;
}

export function orderEvent(c: Customer, at: Date, items: LineItem[], tenders: Tender[], opts: Partial<Event & { type: "order.created" }> = {}): Event {
  const total = orderTotal(items);
  return {
    id: eid("ord"),
    source: "generator",
    storeId: STORE,
    occurredAt: at.toISOString(),
    customerId: c.id,
    email: c.email,
    deviceId: c.deviceId,
    type: "order.created",
    orderId: "",
    total,
    tenders,
    lineItems: items,
    shippingAddressId: c.addressId,
    newShippingAddress: false,
    platformRisk: "low",
    ...opts,
  } as Event;
}

/**
 * Build the synthetic store in memory. Used by the CLI below and by the engine's
 * /admin/replay endpoint, so the dashboard can load the baseline without a terminal.
 */
export function generateWorld(opts: GenerateOptions = {}) {
  const N = opts.customers ?? DEFAULTS.customers;
  const DAYS = opts.days ?? DEFAULTS.days;
  const SEED = opts.seed ?? DEFAULTS.seed;
  STORE = opts.store ?? DEFAULTS.store;
  seq = 0;
  const rng = makeRng(SEED);
  const end = new Date();
  const start = new Date(end.getTime() - DAYS * DAY);
  const customers: Customer[] = Array.from({ length: N }, (_, i) => makeCustomer(rng, i, start));
  const events: Event[] = [];
  const labels: Record<string, string> = {};

  /**
   * Named demo customers, matching apps/merchant-api/src/routes/admin.ts, so the
   * live demo accounts have history in Ledger Guard. Dana is a real customer who
   * stopped ordering 100 days before the end of the window: the dormant victim.
   * Sam keeps shopping weekly: the control. Both use card-heavy tenders, so a
   * stored-value-heavy order later stands out against their own history.
   */
  const named: Array<Customer & { stopDaysBeforeEnd: number }> = [
    { ...makeCustomer(rng, 999_001, start), id: "cus_dana", email: "dana@example.com", deviceId: "home-laptop", addressId: "addr_cus_dana_home", cadenceDays: 9, basketMean: 110, svPropensity: 0.2, refundPropensity: 0.01, points: 220, credit: 310, giftCards: [{ id: "gc_dana_1", balance: 100 }], createdAt: new Date(start.getTime() - 220 * DAY), stopDaysBeforeEnd: 100 },
    { ...makeCustomer(rng, 999_002, start), id: "cus_sam", email: "sam@example.com", deviceId: "home-laptop", addressId: "addr_cus_sam_home", cadenceDays: 7, basketMean: 70, svPropensity: 0.2, refundPropensity: 0.01, points: 45, credit: 0, giftCards: [], createdAt: new Date(start.getTime() - 20 * DAY), stopDaysBeforeEnd: 0 },
  ];
  customers.push(...named);

  // baseline: for each customer, walk the window
  for (const c of customers) {
    const stopAt = end.getTime() - ((c as any).stopDaysBeforeEnd ?? 0) * DAY;
    // seed gift card loads before the window so they exist
    for (const gc of c.giftCards) {
      events.push({ id: eid("load"), source: "generator", storeId: STORE, occurredAt: new Date(start.getTime() - rng.int(1, 20) * DAY).toISOString(), customerId: c.id, deviceId: c.deviceId, type: "value.load", kind: "gift_card", amount: gc.balance, instrumentId: gc.id, cardFingerprint: c.cardFingerprint, avs: "pass", cvc: "pass" });
    }
    let t = start.getTime() + rng.next() * c.cadenceDays * DAY;
    while (t < stopAt) {
      const at = new Date(t);
      // login on own device
      const net = rng.chance(0.85) ? "residential" : "mobile";
      events.push({ id: eid("auth"), source: "generator", storeId: STORE, occurredAt: new Date(t - rng.int(1, 20) * 60_000).toISOString(), customerId: c.id, deviceId: c.deviceId, ipCountry: c.country, ipAsnType: net, type: "auth.login" });
      const items = basket(rng, c.basketMean);
      const useSv = rng.chance(c.svPropensity) && (c.points + c.credit + (c.giftCards[0]?.balance ?? 0)) > 5;
      const tenders = tendersFor(rng, c, orderTotal(items), useSv);
      const ord = orderEvent(c, at, items, tenders, { ipCountry: c.country, ipAsnType: net });
      (ord as any).orderId = ord.id;
      events.push(ord);
      c.lastOrderAt = at;
      c.orderCount += 1;
      // earn points on card leg
      const cardLeg = tenders.find((x) => x.kind === "card")?.amount ?? 0;
      const earned = Math.floor(cardLeg);
      if (earned > 0) {
        c.points += earned;
        events.push({ id: eid("earn"), source: "generator", storeId: STORE, occurredAt: new Date(t + 60_000).toISOString(), customerId: c.id, type: "value.issue", kind: "points", amount: earned, reason: "earn", refOrderId: ord.id });
      }
      // occasional honest refund, mostly to card
      if (rng.chance(c.refundPropensity)) {
        const amount = Number((orderTotal(items) * rng.pick([0.15, 0.3, 0.5])).toFixed(2));
        const dest = rng.chance(0.7) ? "card" : "credit";
        const rAt = new Date(t + rng.int(1, 3) * DAY);
        const refundId = eid("ref");
        events.push({ id: refundId, source: "generator", storeId: STORE, occurredAt: rAt.toISOString(), customerId: c.id, deviceId: c.deviceId, type: "refund.created", refundId, orderId: ord.id, amount, reason: rng.pick(["damaged", "wrong_item", "spoiled", "item_not_received"]), destination: dest });
        if (dest === "credit") {
          c.credit += amount;
          events.push({ id: eid("iss"), source: "generator", storeId: STORE, occurredAt: new Date(rAt.getTime() + 60_000).toISOString(), customerId: c.id, type: "value.issue", kind: "credit", amount, reason: "refund", refOrderId: ord.id, refRefundId: refundId });
        }
      }
      // occasional promo credit
      if (rng.chance(0.03)) {
        const amount = rng.pick([5, 10]);
        c.credit += amount;
        events.push({ id: eid("promo"), source: "generator", storeId: STORE, occurredAt: new Date(t + 2 * 60_000).toISOString(), customerId: c.id, deviceId: c.deviceId, type: "value.issue", kind: "credit", amount, reason: "promo" });
      }
      // occasional gift to a friend
      if (rng.chance(0.01) && c.points > 20) {
        const to = rng.pick(customers);
        const amount = rng.int(10, Math.min(50, Math.floor(c.points)));
        c.points -= amount;
        to.points += amount;
        events.push({ id: eid("xfer"), source: "generator", storeId: STORE, occurredAt: new Date(t + 3 * 60_000).toISOString(), customerId: c.id, toCustomerId: to.id, deviceId: c.deviceId, type: "value.transfer", kind: "points", amount });
      }
      t += Math.max(1, rng.normal(c.cadenceDays, c.cadenceDays / 3)) * DAY;
    }
  }

  // scenarios must not pick the named demo accounts; those are played live
  const scenarioPool = customers.filter((c) => !c.id.startsWith("cus_dana") && !c.id.startsWith("cus_sam"));
  const world: World = { rng, store: STORE, start, end, customers: scenarioPool, events, labels, eid, basket, orderTotal, orderEvent };
  injectScenarios(world);
  const all = world.events; // scenarios may replace the array when trimming a victim's recent history

  all.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const byType = all.reduce<Record<string, number>>((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
  return { events: all, labels, summary: { store: STORE, customers: N, days: DAYS, events: all.length, labelled: Object.keys(labels).length, byType } };
}

function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : [])).filter((x) => x.length));
  const { events: all, labels, summary } = generateWorld({
    customers: args.customers ? Number(args.customers) : undefined,
    days: args.days ? Number(args.days) : undefined,
    seed: args.seed ? Number(args.seed) : undefined,
    store: args.store ? String(args.store) : undefined,
  });
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "events.jsonl"), all.map((e) => JSON.stringify(e)).join("\n") + "\n");
  writeFileSync(join(outDir, "labels.json"), JSON.stringify(labels, null, 2));
  console.log(`store=${summary.store} customers=${summary.customers} days=${summary.days} events=${summary.events} labelled=${summary.labelled}`);
  console.log(summary.byType);
}

// Run the CLI only when executed directly, not when imported by the engine.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
