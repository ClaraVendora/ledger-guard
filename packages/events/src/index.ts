/**
 * Common event model shared by the merchant API, the generator and Ledger Guard.
 *
 * Every adapter (Shopify, generic) maps its payload into one of these events.
 * Ledger Guard only ever sees this shape.
 */
import { z } from "zod";

export const InstrumentKind = z.enum(["points", "credit", "gift_card", "card"]);
export type InstrumentKind = z.infer<typeof InstrumentKind>;

export const StoredValueKind = z.enum(["points", "credit", "gift_card"]);
export type StoredValueKind = z.infer<typeof StoredValueKind>;

export const IssueReason = z.enum(["earn", "refund", "promo", "referral", "goodwill"]);
export type IssueReason = z.infer<typeof IssueReason>;

export const Tender = z.object({
  kind: InstrumentKind,
  amount: z.number().nonnegative(),
  instrumentId: z.string().optional(),
  /** card leg only */
  cardFingerprint: z.string().optional(),
  avs: z.enum(["pass", "fail", "unavailable"]).optional(),
  cvc: z.enum(["pass", "fail", "unavailable"]).optional(),
});
export type Tender = z.infer<typeof Tender>;

export const LineItem = z.object({
  sku: z.string(),
  category: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  /** easy to resell for cash: wine, spirits, formula, cosmetics */
  resalable: z.boolean().default(false),
});
export type LineItem = z.infer<typeof LineItem>;

const Base = z.object({
  /** source system event id; used as idempotency key */
  id: z.string(),
  source: z.enum(["shopify", "generic", "merchant", "generator"]),
  storeId: z.string(),
  occurredAt: z.string().datetime(),
  customerId: z.string().optional(),
  email: z.string().optional(),
  deviceId: z.string().optional(),
  ip: z.string().optional(),
  /** derived from the IP by the merchant's edge or a geo-IP lookup */
  ipCountry: z.string().length(2).optional(),
  ipAsnType: z.enum(["residential", "mobile", "datacentre", "vpn", "tor"]).optional(),
  /** browser fingerprint hash, distinct from the cookie-based deviceId */
  fingerprint: z.string().optional(),
});

export const AuthEvent = Base.extend({
  type: z.enum(["auth.login", "auth.reset", "auth.new_device", "auth.login_failed"]),
  customerId: z.string(),
});

export const ValueIssueEvent = Base.extend({
  type: z.literal("value.issue"),
  customerId: z.string(),
  kind: StoredValueKind,
  amount: z.number().positive(),
  reason: IssueReason,
  /** refund or order this issuance came from, if any */
  refOrderId: z.string().optional(),
  refRefundId: z.string().optional(),
});

export const ValueLoadEvent = Base.extend({
  type: z.literal("value.load"),
  customerId: z.string(),
  kind: z.enum(["credit", "gift_card"]),
  amount: z.number().positive(),
  instrumentId: z.string(),
  /** card used to fund the load */
  cardFingerprint: z.string().optional(),
  avs: z.enum(["pass", "fail", "unavailable"]).optional(),
  cvc: z.enum(["pass", "fail", "unavailable"]).optional(),
});

export const ValueTransferEvent = Base.extend({
  type: z.literal("value.transfer"),
  customerId: z.string(), // sender
  toCustomerId: z.string(),
  kind: z.enum(["points", "credit"]),
  amount: z.number().positive(),
});

export const ValueReverseEvent = Base.extend({
  type: z.literal("value.reverse"),
  customerId: z.string(),
  kind: StoredValueKind,
  amount: z.number().positive(),
  refOrderId: z.string(),
});

export const GiftCardCheckEvent = Base.extend({
  type: z.literal("giftcard.balance_check"),
  code: z.string(),
  valid: z.boolean(),
});

export const OrderCreatedEvent = Base.extend({
  type: z.literal("order.created"),
  customerId: z.string(),
  orderId: z.string(),
  total: z.number().nonnegative(),
  tenders: z.array(Tender),
  lineItems: z.array(LineItem),
  shippingAddressId: z.string(),
  newShippingAddress: z.boolean().default(false),
  /** the platform's own risk read, if any; passthrough feature */
  platformRisk: z.enum(["low", "medium", "high"]).optional(),
});

export const RefundCreatedEvent = Base.extend({
  type: z.literal("refund.created"),
  customerId: z.string(),
  refundId: z.string(),
  orderId: z.string(),
  amount: z.number().positive(),
  reason: z.enum(["item_not_received", "damaged", "spoiled", "wrong_item", "changed_mind", "other"]),
  /** where the refund went */
  destination: z.enum(["card", "credit", "gift_card", "points"]),
});

export const Event = z.discriminatedUnion("type", [
  AuthEvent,
  ValueIssueEvent,
  ValueLoadEvent,
  ValueTransferEvent,
  ValueReverseEvent,
  GiftCardCheckEvent,
  OrderCreatedEvent,
  RefundCreatedEvent,
]);
export type Event = z.infer<typeof Event>;
export type EventType = Event["type"];

export type AuthEvent = z.infer<typeof AuthEvent>;
export type ValueIssueEvent = z.infer<typeof ValueIssueEvent>;
export type ValueLoadEvent = z.infer<typeof ValueLoadEvent>;
export type ValueTransferEvent = z.infer<typeof ValueTransferEvent>;
export type ValueReverseEvent = z.infer<typeof ValueReverseEvent>;
export type GiftCardCheckEvent = z.infer<typeof GiftCardCheckEvent>;
export type OrderCreatedEvent = z.infer<typeof OrderCreatedEvent>;
export type RefundCreatedEvent = z.infer<typeof RefundCreatedEvent>;

/** Decision returned by Ledger Guard. */
export const Decision = z.object({
  eventId: z.string(),
  action: z.enum(["allow", "review", "block"]),
  score: z.number(),
  severity: z.enum(["none", "low", "medium", "high", "critical"]),
  firedRules: z.array(
    z.object({
      ruleId: z.string(),
      group: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      weight: z.number(),
      explanation: z.string(),
      evidence: z.record(z.unknown()),
    }),
  ),
  features: z.record(z.unknown()),
});
export type Decision = z.infer<typeof Decision>;

export const storedValueShare = (tenders: Tender[], total: number): number => {
  if (total <= 0) return 0;
  const sv = tenders.filter((t) => t.kind !== "card").reduce((a, t) => a + t.amount, 0);
  return Math.min(1, sv / total);
};
