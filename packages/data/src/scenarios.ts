/**
 * Labelled fraud scenarios injected into the baseline. Each scenario names the
 * events that should be flagged (labels[eventId] = scenario), so the report can
 * compute precision and recall against them.
 */
import type { Event, LineItem, Tender } from "@lg/events";
import type { Rng } from "./rng.js";
import type { Customer } from "./generate.js";

export type World = {
  rng: Rng;
  store: string;
  start: Date;
  end: Date;
  customers: Customer[];
  events: Event[];
  labels: Record<string, string>;
  eid: (p: string) => string;
  basket: (rng: Rng, mean: number) => LineItem[];
  orderTotal: (items: LineItem[]) => number;
  orderEvent: (c: Customer, at: Date, items: LineItem[], tenders: Tender[], opts?: any) => Event;
};

const DAY = 86400_000;
const HOUR = 3600_000;
const resalableBasket = (w: World): LineItem[] => [
  { sku: "WINE-BAROLO-21", category: "wine", unitPrice: 68, qty: 3, resalable: true },
  { sku: "SPIRIT-MEZCAL", category: "spirits", unitPrice: 55, qty: 2, resalable: true },
  { sku: "MEAT-WAGYU", category: "meat", unitPrice: 89, qty: 1, resalable: true },
];

/** Pick a customer with history and a gap at the end of the window so they read as dormant. */
function dormantVictim(w: World): Customer {
  const candidates = w.customers.filter((c) => c.orderCount >= 3 && c.lastOrderAt && w.end.getTime() - c.lastOrderAt.getTime() > 95 * DAY);
  if (candidates.length) return w.rng.pick(candidates);
  // force one: take a customer with history and pretend their last order was long ago
  const c = w.rng.pick(w.customers.filter((x) => x.orderCount >= 3));
  w.events = w.events.filter((e) => !(e.customerId === c.id && new Date(e.occurredAt).getTime() > w.end.getTime() - 100 * DAY));
  return c;
}

/** 1. Takeover then drain, with a linked mule account transferring in. */
function atoDrain(w: World, n: number) {
  for (let k = 0; k < n; k++) {
    const victim = dormantVictim(w);
    victim.points = Math.max(victim.points, 180);
    victim.credit = Math.max(victim.credit, 200);
    const attackerDevice = `dev_attacker_${k}`;
    const geo = { ipCountry: w.rng.pick(["NG", "RO", "ID"]), ipAsnType: "vpn" as const };
    const t0 = w.end.getTime() - w.rng.int(2, 20) * DAY;
    // mule created a day before, same device
    const mule: Customer = { ...w.customers[0], id: `cus_mule_${k}`, email: `mule${k}@example.com`, deviceId: attackerDevice, addressId: `addr_mule_${k}`, cardFingerprint: `card_mule_${k}`, points: 0, credit: 150, giftCards: [], createdAt: new Date(t0 - DAY), lastOrderAt: null, orderCount: 0 };
    w.customers.push(mule);
    w.events.push({ id: w.eid("auth"), source: "generator", storeId: w.store, occurredAt: new Date(t0 - DAY).toISOString(), customerId: mule.id, deviceId: attackerDevice, type: "auth.login" });
    w.events.push({ id: w.eid("iss"), source: "generator", storeId: w.store, occurredAt: new Date(t0 - DAY + HOUR).toISOString(), customerId: mule.id, deviceId: attackerDevice, type: "value.issue", kind: "credit", amount: 150, reason: "refund" });
    // reset on victim from attacker device
    w.events.push({ id: w.eid("auth"), source: "generator", storeId: w.store, occurredAt: new Date(t0).toISOString(), customerId: victim.id, deviceId: attackerDevice, ...geo, type: "auth.reset" });
    w.events.push({ id: w.eid("auth"), source: "generator", storeId: w.store, occurredAt: new Date(t0 + 60_000).toISOString(), customerId: victim.id, deviceId: attackerDevice, ...geo, type: "auth.new_device" });
    w.events.push({ id: w.eid("auth"), source: "generator", storeId: w.store, occurredAt: new Date(t0 + 90_000).toISOString(), customerId: victim.id, deviceId: attackerDevice, type: "auth.login" });
    // transfer in from mule
    const xfer = w.eid("xfer");
    w.events.push({ id: xfer, source: "generator", storeId: w.store, occurredAt: new Date(t0 + 10 * 60_000).toISOString(), customerId: mule.id, toCustomerId: victim.id, deviceId: attackerDevice, type: "value.transfer", kind: "credit", amount: 150 });
    w.labels[xfer] = "ato_drain";
    victim.credit += 150;
    // checkout: stored value covers most, small card leg, new address
    const items = resalableBasket(w);
    const total = w.orderTotal(items);
    const tenders: Tender[] = [];
    let rem = total;
    const pts = Math.min(victim.points, rem); tenders.push({ kind: "points", amount: pts }); rem -= pts;
    const cr = Math.min(victim.credit, rem); tenders.push({ kind: "credit", amount: Number(cr.toFixed(2)) }); rem -= cr;
    rem = Number(rem.toFixed(2));
    if (rem > 0) tenders.push({ kind: "card", amount: rem, cardFingerprint: `card_attacker_${k}`, avs: "fail", cvc: "pass" });
    const ord = w.orderEvent(victim, new Date(t0 + 25 * 60_000), items, tenders, { deviceId: attackerDevice, ...geo, shippingAddressId: `addr_drop_${k}`, newShippingAddress: true, platformRisk: "low" });
    (ord as any).orderId = ord.id;
    w.events.push(ord);
    w.labels[ord.id] = "ato_drain";
  }
}

/** 2. Refund-to-credit farming: repeated item-not-received claims, credit spent immediately. */
function refundFarming(w: World, n: number) {
  for (let k = 0; k < n; k++) {
    const c = w.rng.pick(w.customers.filter((x) => x.orderCount >= 2));
    let t = w.end.getTime() - 30 * DAY;
    for (let i = 0; i < 4; i++) {
      const items = w.basket(w.rng, 120);
      const tenders: Tender[] = [{ kind: "card", amount: w.orderTotal(items), cardFingerprint: c.cardFingerprint, avs: "pass", cvc: "pass" }];
      const ord = w.orderEvent(c, new Date(t), items, tenders);
      (ord as any).orderId = ord.id;
      w.events.push(ord);
      const amount = Number((w.orderTotal(items) * 0.6).toFixed(2));
      const refundId = w.eid("ref");
      const rAt = t + 2 * DAY;
      w.events.push({ id: refundId, source: "generator", storeId: w.store, occurredAt: new Date(rAt).toISOString(), customerId: c.id, deviceId: c.deviceId, type: "refund.created", refundId, orderId: ord.id, amount, reason: "item_not_received", destination: "credit" });
      if (i >= 1) w.labels[refundId] = "refund_farming";
      w.events.push({ id: w.eid("iss"), source: "generator", storeId: w.store, occurredAt: new Date(rAt + 60_000).toISOString(), customerId: c.id, type: "value.issue", kind: "credit", amount, reason: "refund", refOrderId: ord.id, refRefundId: refundId });
      // spend the credit within minutes on resalable goods
      const items2 = resalableBasket(w).slice(0, 1);
      const total2 = w.orderTotal(items2);
      const useCr = Math.min(amount, total2);
      const tenders2: Tender[] = [{ kind: "credit", amount: useCr }];
      if (total2 - useCr > 0.01) tenders2.push({ kind: "card", amount: Number((total2 - useCr).toFixed(2)), cardFingerprint: c.cardFingerprint, avs: "pass", cvc: "pass" });
      const ord2 = w.orderEvent(c, new Date(rAt + 20 * 60_000), items2, tenders2);
      (ord2 as any).orderId = ord2.id;
      w.events.push(ord2);
      if (i >= 1) w.labels[ord2.id] = "refund_farming";
      t += 6 * DAY;
    }
  }
}

/** 3. Promo and referral linking: many accounts on one device, credit consolidated by transfer. */
function promoLinking(w: World, n: number) {
  for (let k = 0; k < n; k++) {
    const device = `dev_farm_${k}`;
    const t0 = w.end.getTime() - w.rng.int(5, 40) * DAY;
    const hub: Customer = { ...w.customers[0], id: `cus_hub_${k}`, email: `hub${k}@example.com`, deviceId: device, addressId: `addr_farm_${k}`, points: 0, credit: 0, giftCards: [], createdAt: new Date(t0 - 10 * DAY), lastOrderAt: null, orderCount: 0 };
    w.customers.push(hub);
    w.events.push({ id: w.eid("auth"), source: "generator", storeId: w.store, occurredAt: new Date(t0 - 10 * DAY).toISOString(), customerId: hub.id, deviceId: device, type: "auth.login" });
    for (let i = 0; i < 5; i++) {
      const sock: Customer = { ...hub, id: `cus_sock_${k}_${i}`, email: `sock${k}${i}@example.com`, createdAt: new Date(t0 + i * HOUR) };
      w.customers.push(sock);
      const at = t0 + i * HOUR;
      w.events.push({ id: w.eid("auth"), source: "generator", storeId: w.store, occurredAt: new Date(at).toISOString(), customerId: sock.id, deviceId: device, type: "auth.login" });
      const iss = w.eid("iss");
      w.events.push({ id: iss, source: "generator", storeId: w.store, occurredAt: new Date(at + 60_000).toISOString(), customerId: sock.id, deviceId: device, type: "value.issue", kind: "credit", amount: 10, reason: "referral" });
      if (i >= 2) w.labels[iss] = "promo_linking";
      const xfer = w.eid("xfer");
      w.events.push({ id: xfer, source: "generator", storeId: w.store, occurredAt: new Date(at + 5 * 60_000).toISOString(), customerId: sock.id, toCustomerId: hub.id, deviceId: device, type: "value.transfer", kind: "credit", amount: 10 });
      w.labels[xfer] = "promo_linking";
    }
  }
}

/** 4. Gift card enumeration: balance-check burst from one device, mostly invalid codes. */
function enumeration(w: World, n: number) {
  for (let k = 0; k < n; k++) {
    const device = `dev_bot_${k}`;
    const t0 = w.end.getTime() - w.rng.int(1, 30) * DAY;
    for (let i = 0; i < 60; i++) {
      const id = w.eid("gcchk");
      const valid = i === 57;
      w.events.push({ id, source: "generator", storeId: w.store, occurredAt: new Date(t0 + i * 20_000).toISOString(), deviceId: device, ip: `203.0.113.${k + 10}`, ipCountry: "US", ipAsnType: "datacentre", type: "giftcard.balance_check", code: valid ? "GC-REAL-0001" : `GC-${i.toString(16).toUpperCase().padStart(4, "0")}-ZZZZ`, valid });
      if (i >= 20) w.labels[id] = "gc_enumeration";
    }
  }
}

/** 5. Load and spend: several stolen cards load gift cards onto one account, spent on resalable goods within hours. */
function loadAndSpend(w: World, n: number) {
  for (let k = 0; k < n; k++) {
    const device = `dev_loader_${k}`;
    const t0 = w.end.getTime() - w.rng.int(3, 45) * DAY;
    const c: Customer = { ...w.customers[0], id: `cus_loader_${k}`, email: `loader${k}@example.com`, deviceId: device, addressId: `addr_loader_${k}`, points: 0, credit: 0, giftCards: [], createdAt: new Date(t0 - 2 * DAY), lastOrderAt: null, orderCount: 0 };
    w.customers.push(c);
    w.events.push({ id: w.eid("auth"), source: "generator", storeId: w.store, occurredAt: new Date(t0 - 2 * DAY).toISOString(), customerId: c.id, deviceId: device, type: "auth.login" });
    const cards: { id: string; balance: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const gcId = `gc_loader_${k}_${i}`;
      const load = w.eid("load");
      w.events.push({ id: load, source: "generator", storeId: w.store, occurredAt: new Date(t0 + i * 15 * 60_000).toISOString(), customerId: c.id, deviceId: device, type: "value.load", kind: "gift_card", amount: 100, instrumentId: gcId, cardFingerprint: `card_stolen_${k}_${i}`, avs: "fail", cvc: "pass" });
      if (i >= 2) w.labels[load] = "load_and_spend";
      cards.push({ id: gcId, balance: 100 });
    }
    const items = resalableBasket(w);
    const total = w.orderTotal(items);
    const tenders: Tender[] = [];
    let rem = total;
    for (const gc of cards) { const use = Math.min(gc.balance, rem); if (use > 0) { tenders.push({ kind: "gift_card", amount: use, instrumentId: gc.id }); rem -= use; } }
    rem = Number(rem.toFixed(2));
    if (rem > 0) tenders.push({ kind: "card", amount: rem, cardFingerprint: `card_stolen_${k}_9`, avs: "fail", cvc: "pass" });
    const ord = w.orderEvent(c, new Date(t0 + 2 * HOUR), items, tenders, { deviceId: device, shippingAddressId: `addr_loader_${k}`, newShippingAddress: true });
    (ord as any).orderId = ord.id;
    w.events.push(ord);
    w.labels[ord.id] = "load_and_spend";
  }
}

export function injectScenarios(w: World) {
  atoDrain(w, 3);
  refundFarming(w, 3);
  promoLinking(w, 2);
  enumeration(w, 2);
  loadAndSpend(w, 2);
}
