import { pgTable, text, timestamp, real, boolean, jsonb, integer, index } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  label: text("label"),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  line1: text("line1").notNull(),
  city: text("city").notNull(),
  zip: text("zip").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  customerId: text("customer_id").notNull(),
  deviceId: text("device_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  token: text("token").primaryKey(),
  customerId: text("customer_id").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every stored-value movement. Balance = sum(amount) per customer per kind. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").notNull(),
    kind: text("kind").notNull(), // points | credit
    amount: real("amount").notNull(), // positive in, negative out
    reason: text("reason").notNull(), // earn | refund | promo | referral | goodwill | transfer_in | transfer_out | redeem | reverse | load
    refId: text("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ledger_customer_kind").on(t.customerId, t.kind)],
);

export const giftCards = pgTable("gift_cards", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  purchaserId: text("purchaser_id"),
  initialValue: real("initial_value").notNull(),
  balance: real("balance").notNull(),
  cardFingerprint: text("card_fingerprint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  sku: text("sku").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: real("price").notNull(),
  resalable: boolean("resalable").notNull().default(false),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  total: real("total").notNull(),
  tenders: jsonb("tenders").notNull(),
  lineItems: jsonb("line_items").notNull(),
  shippingAddressId: text("shipping_address_id").notNull(),
  status: text("status").notNull(), // placed | blocked | review | refunded
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  lgDecision: jsonb("lg_decision"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refunds = pgTable("refunds", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  customerId: text("customer_id").notNull(),
  amount: real("amount").notNull(),
  reason: text("reason").notNull(),
  destination: text("destination").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sent emails, so the demo can show the reset link even if delivery lags. */
export const outbox = pgTable("outbox", {
  id: text("id").primaryKey(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  delivered: boolean("delivered").notNull().default(false),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const counters = pgTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0),
});
