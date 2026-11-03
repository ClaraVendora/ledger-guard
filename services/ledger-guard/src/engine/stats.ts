/**
 * Store-relative statistics. Percentiles of per-customer aggregates over the
 * store's own history, so thresholds follow the store instead of a fixed cap.
 */
import { sql, db } from "../db/client.js";
import { storeStats } from "../db/schema.js";

export async function recomputeStoreStats(storeId: string) {
  const rows = await sql<{ p95_ratio: number | null; p95_count: number | null; p95_sv: number | null }[]>`
    with per_customer as (
      select
        customer_id,
        coalesce(sum((payload->>'amount')::float) filter (where type = 'refund.created'), 0) as refund_amount,
        coalesce(sum((payload->>'total')::float) filter (where type = 'order.created'), 0) as order_amount,
        count(*) filter (where type = 'refund.created') as refund_count
      from events
      where store_id = ${storeId} and customer_id is not null
        and occurred_at >= now() - interval '90 days'
      group by customer_id
    ),
    sv as (
      select coalesce((
        select sum((t->>'amount')::float) from jsonb_array_elements(payload->'tenders') t where t->>'kind' <> 'card'
      ),0) / nullif((payload->>'total')::float,0) as share
      from events where store_id = ${storeId} and type = 'order.created'
    )
    select
      (select percentile_cont(0.95) within group (order by case when order_amount > 0 then refund_amount / order_amount else 0 end) from per_customer) as p95_ratio,
      (select percentile_cont(0.95) within group (order by refund_count) from per_customer) as p95_count,
      (select percentile_cont(0.95) within group (order by share) from sv where share is not null) as p95_sv`;
  const r = rows[0];
  const stats = {
    refund_value_ratio_90d_p95: r?.p95_ratio ?? 0.15,
    refunds_90d_count_p95: r?.p95_count ?? 2,
    stored_value_share_p95: r?.p95_sv ?? 0.5,
  };
  await db
    .insert(storeStats)
    .values({ storeId, stats, computedAt: new Date() })
    .onConflictDoUpdate({ target: storeStats.storeId, set: { stats, computedAt: new Date() } });
  return stats;
}
