import { pgSchema, text, timestamp, jsonb, integer, real, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

/** Own schema so Ledger Guard can share one Postgres with the merchant without colliding. */
export const lg = pgSchema("ledger_guard");
const pgTable = lg.table;

/** Append-only event store. The payload is the common event model, verbatim. */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(), // source event id; idempotency key
    storeId: text("store_id").notNull(),
    type: text("type").notNull(),
    customerId: text("customer_id"),
    deviceId: text("device_id"),
    ip: text("ip"),
    ipCountry: text("ip_country"),
    ipAsnType: text("ip_asn_type"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [
    index("events_store_customer_time").on(t.storeId, t.customerId, t.occurredAt),
    index("events_store_type_time").on(t.storeId, t.type, t.occurredAt),
    index("events_store_device_time").on(t.storeId, t.deviceId, t.occurredAt),
  ],
);

/** One row per decision. Alerts are decisions with action != allow. */
export const decisions = pgTable(
  "decisions",
  {
    id: text("id").primaryKey(), // = event id
    storeId: text("store_id").notNull(),
    customerId: text("customer_id"),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    action: text("action").notNull(), // allow | review | block
    score: real("score").notNull(),
    severity: text("severity").notNull(),
    firedRules: jsonb("fired_rules").notNull(),
    features: jsonb("features").notNull(),
    reviewStatus: text("review_status"), // null | true_positive | false_positive
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ruleVersion: integer("rule_version").notNull(),
  },
  (t) => [
    index("decisions_store_action_time").on(t.storeId, t.action, t.occurredAt),
    index("decisions_store_customer").on(t.storeId, t.customerId),
  ],
);

/** Rule pack overrides edited from the dashboard; the YAML file is the default. */
export const ruleOverrides = pgTable(
  "rule_overrides",
  {
    storeId: text("store_id").notNull(),
    ruleId: text("rule_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    /** per-condition value overrides keyed by condition index */
    thresholds: jsonb("thresholds").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("rule_overrides_store_rule").on(t.storeId, t.ruleId)],
);

/** Store-relative percentiles, recomputed on replay or on demand. */
export const storeStats = pgTable("store_stats", {
  storeId: text("store_id").primaryKey(),
  stats: jsonb("stats").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});
