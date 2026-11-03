/**
 * Demo control. Reset wipes both the merchant database and Ledger Guard's
 * store, then seeds the catalogue and the demo accounts. The baseline history
 * comes from the generator (pnpm data:generate && pnpm data:replay).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sql, db } from "../db/client.js";
import { customers, products, addresses, ledgerEntries, giftCards, devices } from "../db/schema.js";
import { hash } from "../auth.js";
import { STORE_ID } from "../lg.js";

export const CATALOGUE = [
  { sku: "WINE-BAROLO-21", name: "Barolo DOCG 2021", category: "wine", price: 68, resalable: true },
  { sku: "WINE-CHABLIS-22", name: "Chablis Premier Cru 2022", category: "wine", price: 42, resalable: true },
  { sku: "SPIRIT-MEZCAL", name: "Mezcal Artesanal 700ml", category: "spirits", price: 55, resalable: true },
  { sku: "SPIRIT-RYE", name: "Straight Rye Whiskey 750ml", category: "spirits", price: 49, resalable: true },
  { sku: "CHEESE-COMTE", name: "Comte 24 month, 250g", category: "cheese", price: 14, resalable: false },
  { sku: "MEAT-WAGYU", name: "Wagyu Ribeye 400g", category: "meat", price: 89, resalable: true },
  { sku: "FISH-SALMON", name: "Ora King Salmon 300g", category: "fish", price: 24, resalable: false },
  { sku: "PRODUCE-BERRIES", name: "Organic Berries Box", category: "produce", price: 11, resalable: false },
  { sku: "PANTRY-OLIVEOIL", name: "Sicilian Olive Oil 500ml", category: "pantry", price: 28, resalable: false },
  { sku: "PANTRY-FORMULA", name: "Infant Formula 800g", category: "baby", price: 36, resalable: true },
  { sku: "BAKERY-SOURDOUGH", name: "Country Sourdough", category: "bakery", price: 9, resalable: false },
  { sku: "DAIRY-BUTTER", name: "Cultured Butter 250g", category: "dairy", price: 7, resalable: false },
];

export const DEMO_ACCOUNTS = [
  // the victim: real history, dormant 6 months, sizeable balances
  { id: "cus_dana", email: "dana@example.com", name: "Dana Whitfield", password: "password123", points: 220, credit: 310, createdDaysAgo: 400 },
  // the mule: created yesterday on the fraudster's device
  { id: "cus_mule", email: "jj.quick@example.com", name: "J. Quick", password: "password123", points: 0, credit: 150, createdDaysAgo: 1 },
  // a normal weekly shopper for contrast
  { id: "cus_sam", email: "sam@example.com", name: "Sam Ortega", password: "password123", points: 45, credit: 0, createdDaysAgo: 200 },
];

export async function seedMerchant() {
  await db.insert(products).values(CATALOGUE).onConflictDoNothing();
  for (const a of DEMO_ACCOUNTS) {
    const createdAt = new Date(Date.now() - a.createdDaysAgo * 86400_000);
    await db.insert(customers).values({ id: a.id, email: a.email, name: a.name, passwordHash: hash(a.password), createdAt }).onConflictDoNothing();
    await db.insert(addresses).values({ id: `addr_${a.id}_home`, customerId: a.id, line1: "12 Orchard Lane", city: "Brooklyn", zip: "11201", createdAt }).onConflictDoNothing();
    await db.insert(devices).values({ id: `${a.id}:home-laptop`, customerId: a.id, label: "home-laptop", firstSeen: createdAt, lastSeen: createdAt }).onConflictDoNothing();
    if (a.points) await db.insert(ledgerEntries).values({ id: `seed_pts_${a.id}`, customerId: a.id, kind: "points", amount: a.points, reason: "earn", createdAt });
    if (a.credit) await db.insert(ledgerEntries).values({ id: `seed_cr_${a.id}`, customerId: a.id, kind: "credit", amount: a.credit, reason: a.id === "cus_mule" ? "refund" : "goodwill", createdAt });
  }
  await db.insert(giftCards).values({ id: "gc_dana_1", code: "GC-DANA-0001", purchaserId: "cus_dana", initialValue: 100, balance: 100, cardFingerprint: "visa-1111" }).onConflictDoNothing();
}

export async function adminRoutes(app: FastifyInstance) {
  app.post("/admin/reset", async (req) => {
    const b = z.object({ seed: z.boolean().default(true), resetLedgerGuard: z.boolean().default(true) }).parse(req.body ?? {});
    await sql`truncate merchant.customers, merchant.devices, merchant.addresses, merchant.sessions, merchant.password_resets, merchant.ledger_entries, merchant.gift_cards, merchant.products, merchant.orders, merchant.refunds, merchant.outbox, merchant.counters`;
    if (b.resetLedgerGuard) {
      await fetch(`${process.env.LEDGER_GUARD_URL ?? "http://localhost:4100"}/admin/reset`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ store: STORE_ID }) }).catch(() => null);
    }
    if (b.seed) await seedMerchant();
    return { ok: true, seeded: b.seed };
  });

  app.get("/admin/demo-accounts", async () => DEMO_ACCOUNTS.map(({ password, ...a }) => ({ ...a, password })));
}
