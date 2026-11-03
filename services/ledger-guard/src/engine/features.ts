/**
 * Feature builder.
 *
 * Every feature is a number or boolean computed from the event store for the
 * entity the incoming event belongs to, over a window ending at the event's
 * occurredAt. Nothing here is learned; it is counters and ratios, and every
 * value can be reproduced with one SQL query.
 */
import type { Event, OrderCreatedEvent, Tender } from "@lg/events";
import { storedValueShare } from "@lg/events";
import { sql } from "../db/client.js";

export type Features = Record<string, number | boolean | string | null>;

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const far = 1e9; // "never" sentinel for time-since features, in hours

const hoursSince = (from: Date | null, to: Date) => (from ? (to.getTime() - from.getTime()) / HOUR : far);

async function lastEventAt(storeId: string, customerId: string, types: string[], before: Date): Promise<Date | null> {
  const rows = await sql<{ t: Date }[]>`
    select max(occurred_at) as t from ledger_guard.events
    where store_id = ${storeId} and customer_id = ${customerId}
      and type = any(${types}) and occurred_at < ${before}`;
  return rows[0]?.t ?? null;
}

async function countSince(storeId: string, where: ReturnType<typeof sql>, since: Date, before: Date): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from ledger_guard.events
    where store_id = ${storeId} and occurred_at >= ${since} and occurred_at <= ${before} and ${where}`;
  return rows[0]?.n ?? 0;
}

async function customerFirstSeen(storeId: string, customerId: string): Promise<Date | null> {
  const rows = await sql<{ t: Date }[]>`
    select min(occurred_at) as t from ledger_guard.events where store_id = ${storeId} and customer_id = ${customerId}`;
  return rows[0]?.t ?? null;
}

async function customerAccountAgeDays(storeId: string, customerId: string, at: Date): Promise<number> {
  const first = await customerFirstSeen(storeId, customerId);
  return first ? (at.getTime() - first.getTime()) / DAY : 0;
}

/** Features shared by every event that carries a customer. */
async function customerFeatures(e: Event, at: Date): Promise<Features> {
  const f: Features = {};
  if (!e.customerId) return f;
  const { storeId, customerId } = e;

  const reset = await lastEventAt(storeId, customerId, ["auth.reset"], at);
  const newDevice = await lastEventAt(storeId, customerId, ["auth.new_device"], at);
  const prevOrder = await lastEventAt(storeId, customerId, ["order.created"], at);

  f.hours_since_reset = hoursSince(reset, at);
  f.hours_since_new_device = hoursSince(newDevice, at);
  f.days_since_prev_order = prevOrder ? hoursSince(prevOrder, at) / 24 : far;
  f.account_age_days = await customerAccountAgeDays(storeId, customerId, at);

  // transfers in, last 24h
  const tin = await sql<{ amount: number; n: number }[]>`
    select coalesce(sum((payload->>'amount')::float),0) as amount, count(*)::int as n from ledger_guard.events
    where store_id = ${storeId} and type = 'value.transfer'
      and payload->>'toCustomerId' = ${customerId}
      and occurred_at >= ${new Date(at.getTime() - DAY)} and occurred_at < ${at}`;
  f.transfer_in_24h_amount = tin[0]?.amount ?? 0;
  f.transfer_in_24h_count = tin[0]?.n ?? 0;

  // youngest counterparty that transferred in, last 7d
  const cp = await sql<{ customer_id: string }[]>`
    select distinct customer_id from ledger_guard.events
    where store_id = ${storeId} and type = 'value.transfer'
      and payload->>'toCustomerId' = ${customerId}
      and occurred_at >= ${new Date(at.getTime() - 7 * DAY)} and occurred_at < ${at}`;
  let youngest = far;
  for (const r of cp) youngest = Math.min(youngest, await customerAccountAgeDays(storeId, r.customer_id, at));
  f.transfer_counterparty_min_age_days = youngest;

  // refunds last 90d and refund value ratio
  const since90 = new Date(at.getTime() - 90 * DAY);
  const ref = await sql<{ n: number; amount: number }[]>`
    select count(*)::int as n, coalesce(sum((payload->>'amount')::float),0) as amount from ledger_guard.events
    where store_id = ${storeId} and customer_id = ${customerId} and type = 'refund.created'
      and occurred_at >= ${since90} and occurred_at < ${at}`;
  const ord = await sql<{ amount: number }[]>`
    select coalesce(sum((payload->>'total')::float),0) as amount from ledger_guard.events
    where store_id = ${storeId} and customer_id = ${customerId} and type = 'order.created'
      and occurred_at >= ${since90} and occurred_at < ${at}`;
  f.refunds_90d_count = ref[0]?.n ?? 0;
  f.refund_value_ratio_90d = (ord[0]?.amount ?? 0) > 0 ? (ref[0]?.amount ?? 0) / (ord[0]?.amount ?? 1) : 0;

  // credit issued from refund claims, last 24h, and minutes since last issue
  const lastIssue = await sql<{ t: Date; reason: string; amount: number }[]>`
    select occurred_at as t, payload->>'reason' as reason, (payload->>'amount')::float as amount from ledger_guard.events
    where store_id = ${storeId} and customer_id = ${customerId} and type = 'value.issue'
      and occurred_at < ${at} order by occurred_at desc limit 1`;
  f.minutes_since_last_issue = lastIssue[0] ? (at.getTime() - lastIssue[0].t.getTime()) / 60_000 : far;
  f.last_issue_reason = lastIssue[0]?.reason ?? null;
  f.refund_credit_issued_24h = await countSince(
    storeId,
    sql`customer_id = ${customerId} and type = 'value.issue' and payload->>'reason' = 'refund'`,
    new Date(at.getTime() - DAY),
    at,
  );

  // loads: distinct cards last 7d, hours since last load
  const loads = await sql<{ cards: number; last: Date | null }[]>`
    select count(distinct payload->>'cardFingerprint')::int as cards, max(occurred_at) as last from ledger_guard.events
    where store_id = ${storeId} and customer_id = ${customerId} and type = 'value.load'
      and occurred_at >= ${new Date(at.getTime() - 7 * DAY)} and occurred_at < ${at}`;
  f.load_distinct_cards_7d = loads[0]?.cards ?? 0;
  f.hours_since_last_load = hoursSince(loads[0]?.last ?? null, at);

  // customer's historical stored-value share (mean over prior orders)
  const hist = await sql<{ share: number | null; n: number }[]>`
    select avg(sv.share) as share, count(*)::int as n from (
      select coalesce((
        select sum((t->>'amount')::float) from jsonb_array_elements(payload->'tenders') t where t->>'kind' <> 'card'
      ),0) / nullif((payload->>'total')::float,0) as share
      from ledger_guard.events
      where store_id = ${storeId} and customer_id = ${customerId} and type = 'order.created' and occurred_at < ${at}
    ) sv`;
  f.hist_stored_value_share = hist[0]?.share ?? 0;
  f.hist_order_count = hist[0]?.n ?? 0;

  // refund of a card-paid order pushed to stored value, then any transfer out within 24h of that refund
  const refSv = await sql<{ t: Date }[]>`
    select occurred_at as t from ledger_guard.events
    where store_id = ${storeId} and customer_id = ${customerId} and type = 'refund.created'
      and payload->>'destination' in ('credit','gift_card','points')
      and occurred_at >= ${new Date(at.getTime() - DAY)} and occurred_at < ${at}
    order by occurred_at desc limit 1`;
  f.hours_since_refund_to_stored_value = hoursSince(refSv[0]?.t ?? null, at);

  return f;
}

async function geoFeatures(e: Event, at: Date): Promise<Features> {
  const f: Features = {};
  f.ip_country = e.ipCountry ?? null;
  f.ip_asn_type = e.ipAsnType ?? null;
  f.ip_risky_network = e.ipAsnType === "datacentre" || e.ipAsnType === "vpn" || e.ipAsnType === "tor";
  if (!e.customerId) { f.ip_country_is_new = false; return f; }
  // the customer's usual country: most frequent across their past orders. Orders only, because an
  // attacker's own logins minutes earlier must not count, and a dormant account's orders sit outside any rolling window.
  const rows = await sql<{ c: string; n: number }[]>`
    select ip_country as c, count(*)::int as n from ledger_guard.events
    where store_id = ${e.storeId} and customer_id = ${e.customerId} and ip_country is not null
      and type = 'order.created' and occurred_at < ${at}
    group by ip_country order by n desc limit 1`;
  f.usual_country = rows[0]?.c ?? null;
  f.ip_country_is_new = Boolean(e.ipCountry && rows[0] && rows[0].c !== e.ipCountry);
  return f;
}

async function deviceFeatures(e: Event, at: Date): Promise<Features> {
  const f: Features = {};
  const since30 = new Date(at.getTime() - 30 * DAY);
  if (e.deviceId) {
    const d = await sql<{ n: number }[]>`
      select count(distinct customer_id)::int as n from ledger_guard.events
      where store_id = ${e.storeId} and device_id = ${e.deviceId} and customer_id is not null
        and occurred_at >= ${since30} and occurred_at <= ${at}`;
    f.distinct_accounts_per_device_30d = d[0]?.n ?? 0;

    const checks = await sql<{ n: number; invalid: number }[]>`
      select count(*)::int as n, count(*) filter (where (payload->>'valid')::boolean = false)::int as invalid
      from ledger_guard.events
      where store_id = ${e.storeId} and device_id = ${e.deviceId} and type = 'giftcard.balance_check'
        and occurred_at >= ${new Date(at.getTime() - HOUR)} and occurred_at <= ${at}`;
    f.balance_checks_1h_device = checks[0]?.n ?? 0;
    f.balance_check_invalid_ratio_1h = (checks[0]?.n ?? 0) > 0 ? (checks[0]?.invalid ?? 0) / (checks[0]?.n ?? 1) : 0;
  } else {
    f.distinct_accounts_per_device_30d = 0;
    f.balance_checks_1h_device = 0;
    f.balance_check_invalid_ratio_1h = 0;
  }
  return f;
}

async function orderFeatures(e: OrderCreatedEvent, at: Date): Promise<Features> {
  const f: Features = {};
  f.order_total = e.total;
  f.stored_value_share = storedValueShare(e.tenders as Tender[], e.total);
  f.card_leg_amount = e.tenders.filter((t) => t.kind === "card").reduce((a, t) => a + t.amount, 0);
  f.card_avs_fail = e.tenders.some((t) => t.kind === "card" && t.avs === "fail");
  f.new_shipping_address = e.newShippingAddress;
  const resalable = e.lineItems.filter((l) => l.resalable).reduce((a, l) => a + l.qty * l.unitPrice, 0);
  f.resalable_share = e.total > 0 ? resalable / e.total : 0;
  f.gift_card_count_in_order = e.tenders.filter((t) => t.kind === "gift_card").length;
  f.platform_risk = e.platformRisk ?? "unknown";

  // distinct accounts at this shipping address, 30d
  const a = await sql<{ n: number }[]>`
    select count(distinct customer_id)::int as n from ledger_guard.events
    where store_id = ${e.storeId} and type = 'order.created'
      and payload->>'shippingAddressId' = ${e.shippingAddressId}
      and occurred_at >= ${new Date(at.getTime() - 30 * DAY)} and occurred_at < ${at}`;
  f.distinct_accounts_per_address_30d = (a[0]?.n ?? 0) + 1;

  // gift card tendered that was loaded by a different customer
  let foreign = 0;
  for (const t of e.tenders) {
    if (t.kind !== "gift_card" || !t.instrumentId) continue;
    const l = await sql<{ customer_id: string }[]>`
      select customer_id from ledger_guard.events
      where store_id = ${e.storeId} and type = 'value.load' and payload->>'instrumentId' = ${t.instrumentId}
      order by occurred_at asc limit 1`;
    if (l[0] && l[0].customer_id !== e.customerId) foreign += 1;
  }
  f.gift_cards_loaded_by_other = foreign;
  return f;
}

export async function computeFeatures(e: Event): Promise<Features> {
  const at = new Date(e.occurredAt);
  const f: Features = { event_type: e.type };
  Object.assign(f, await customerFeatures(e, at));
  Object.assign(f, await deviceFeatures(e, at));
  Object.assign(f, await geoFeatures(e, at));
  if (e.type === "order.created") Object.assign(f, await orderFeatures(e, at));
  if (e.type === "value.transfer") {
    f.transfer_amount = e.amount;
    f.sender_hours_since_reset = f.hours_since_reset;
    const recvReset = await lastEventAt(e.storeId, e.toCustomerId, ["auth.reset", "auth.new_device"], at);
    f.receiver_hours_since_reset = hoursSince(recvReset, at);
    f.receiver_account_age_days = await customerAccountAgeDays(e.storeId, e.toCustomerId, at);
  }
  if (e.type === "value.issue") {
    f.issue_amount = e.amount;
    f.issue_reason = e.reason;
  }
  if (e.type === "refund.created") {
    f.refund_amount = e.amount;
    f.refund_destination = e.destination;
    f.refund_reason = e.reason;
  }
  if (e.type === "giftcard.balance_check") {
    f.balance_check_valid = e.valid;
  }
  return f;
}
