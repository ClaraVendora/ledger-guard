import Fastify from "fastify";
import cors from "@fastify/cors";
import { and, desc, eq, gte, lte, ne, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import type { Event } from "@lg/events";
import { db, sql } from "./db/client.js";
import { events, decisions, storeStats, ruleOverrides } from "./db/schema.js";
import { adapt } from "./adapters/index.js";
import { decide, currentPack, reloadPack } from "./engine/decide.js";
import { recomputeStoreStats } from "./engine/stats.js";
import { getOverrides, setOverride, applyOverride, evalCondition, getStoreStats } from "./engine/rules.js";
import { computeFeatures } from "./engine/features.js";
import { ingest } from "./ingest.js";
import { startReplay, replayStatus } from "./replay.js";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, rules: currentPack().version }));

/**
 * Ingest. Accepts one event or an array, in common shape or a source's shape
 * (X-Source: shopify). Stores, decides, returns decisions. Idempotent on event id.
 */
app.post("/events", async (req, reply) => {
  const source = (req.headers["x-source"] as string | undefined) ?? "generic";
  let incoming: Event[];
  try {
    incoming = adapt(source, req.body);
  } catch (err) {
    return reply.code(400).send({ error: "invalid_event", detail: String(err) });
  }
  const out = [];
  for (const e of incoming) {
    const d = await ingest(e);
    if (!d.idempotent) req.log.info({ eventId: e.id, type: e.type, action: d.action, score: d.score, rules: d.firedRules.map((r) => r.ruleId) }, "decision");
    out.push(d);
  }
  return Array.isArray(req.body) ? out : out[0];
});

/** Decisions feed. ?store=&action=&limit=&since= */
app.get("/decisions", async (req) => {
  const q = z
    .object({ store: z.string(), action: z.enum(["allow", "review", "block"]).optional(), limit: z.coerce.number().default(100), since: z.string().optional() })
    .parse(req.query);
  const where = [eq(decisions.storeId, q.store)];
  if (q.action) where.push(eq(decisions.action, q.action));
  if (q.since) where.push(gte(decisions.occurredAt, new Date(q.since)));
  return db.select().from(decisions).where(and(...where)).orderBy(desc(decisions.occurredAt)).limit(q.limit);
});

/** Alerts = decisions that are not allow. Same filters. */
app.get("/alerts", async (req) => {
  const q = z.object({ store: z.string(), limit: z.coerce.number().default(100), status: z.enum(["open", "reviewed", "all"]).default("all") }).parse(req.query);
  const where = [eq(decisions.storeId, q.store), ne(decisions.action, "allow")];
  if (q.status === "open") where.push(dsql`${decisions.reviewStatus} is null`);
  if (q.status === "reviewed") where.push(dsql`${decisions.reviewStatus} is not null`);
  return db.select().from(decisions).where(and(...where)).orderBy(desc(decisions.occurredAt)).limit(q.limit);
});

/** One alert with the ordered event timeline for its customer around the event. */
app.get("/alerts/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const d = (await db.select().from(decisions).where(eq(decisions.id, id)).limit(1))[0];
  if (!d) return reply.code(404).send({ error: "not_found" });
  const at = d.occurredAt;
  const timeline = d.customerId
    ? await sql`
        select id, type, occurred_at, payload from ledger_guard.events
        where store_id = ${d.storeId} and (
          customer_id = ${d.customerId}
          or (type = 'value.transfer' and payload->>'toCustomerId' = ${d.customerId})
        ) and occurred_at <= ${at} and occurred_at >= ${new Date(at.getTime() - 14 * 86400_000)}
        order by occurred_at asc`
    : [];
  return { ...d, timeline };
});

app.post("/alerts/:id/review", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = z.object({ status: z.enum(["true_positive", "false_positive"]) }).parse(req.body);
  const r = await db.update(decisions).set({ reviewStatus: body.status, reviewedAt: new Date() }).where(eq(decisions.id, id)).returning({ id: decisions.id });
  if (!r[0]) return reply.code(404).send({ error: "not_found" });
  return { ok: true };
});

/** Account view: balances are the merchant's; here we return the risk side. */
app.get("/accounts/:customerId", async (req) => {
  const { customerId } = req.params as { customerId: string };
  const q = z.object({ store: z.string() }).parse(req.query);
  const recent = await sql`
    select id, type, occurred_at, payload from ledger_guard.events
    where store_id = ${q.store} and (customer_id = ${customerId} or (type='value.transfer' and payload->>'toCustomerId' = ${customerId}))
    order by occurred_at desc limit 200`;
  const alerts = await db.select().from(decisions).where(and(eq(decisions.storeId, q.store), eq(decisions.customerId, customerId), ne(decisions.action, "allow"))).orderBy(desc(decisions.occurredAt));
  const devices = await sql`
    select device_id, count(*)::int as n, max(occurred_at) as last_seen from ledger_guard.events
    where store_id = ${q.store} and customer_id = ${customerId} and device_id is not null group by device_id order by last_seen desc`;
  return { customerId, events: recent, alerts, devices };
});

/** Rules screen: pack with overrides and the count of alerts each rule contributes on the store's history. */
app.get("/rules", async (req) => {
  const q = z.object({ store: z.string() }).parse(req.query);
  const overrides = await getOverrides(q.store);
  const stats = await getStoreStats(q.store);
  const counts = await sql<{ rule_id: string; n: number }[]>`
    select r->>'ruleId' as rule_id, count(*)::int as n
    from ledger_guard.decisions, jsonb_array_elements(fired_rules) r
    where store_id = ${q.store} group by 1`;
  const countMap = Object.fromEntries(counts.map((c) => [c.rule_id, c.n]));
  return {
    version: currentPack().version,
    thresholds: currentPack().thresholds,
    stats,
    rules: currentPack().rules.map((r) => ({ ...applyOverride(r, overrides[r.id]), enabled: overrides[r.id]?.enabled ?? true, overrides: overrides[r.id]?.thresholds ?? {}, firedCount: countMap[r.id] ?? 0 })),
  };
});

app.put("/rules/:ruleId", async (req) => {
  const { ruleId } = req.params as { ruleId: string };
  const body = z.object({ store: z.string(), enabled: z.boolean().optional(), thresholds: z.record(z.unknown()).optional() }).parse(req.body);
  return setOverride(body.store, ruleId, { enabled: body.enabled, thresholds: body.thresholds });
});

/**
 * What-if: re-evaluate every stored decision's features against the current
 * rules (with overrides). Returns how many events would be allow/review/block
 * now, so the rules screen can show the effect of a slider without replaying.
 */
app.get("/rules/simulate", async (req) => {
  const q = z.object({ store: z.string() }).parse(req.query);
  const rows = await db.select({ id: decisions.id, eventType: decisions.eventType, features: decisions.features }).from(decisions).where(eq(decisions.storeId, q.store));
  const overrides = await getOverrides(q.store);
  const stats = await getStoreStats(q.store);
  const pack = currentPack();
  const tally = { allow: 0, review: 0, block: 0 };
  const perRule: Record<string, number> = {};
  for (const r of rows) {
    const f = r.features as Record<string, any>;
    let score = 0;
    let critical = false;
    for (const base of pack.rules) {
      if (!base.applies_to.includes(r.eventType)) continue;
      const o = overrides[base.id];
      if (o && !o.enabled) continue;
      const rule = applyOverride(base, o);
      const all = rule.when.every((c) => evalCondition(c, f, stats));
      const any = rule.any ? rule.any.some((c) => evalCondition(c, f, stats)) : true;
      if (all && any) {
        score += rule.weight;
        if (rule.severity === "critical") critical = true;
        perRule[rule.id] = (perRule[rule.id] ?? 0) + 1;
      }
    }
    const action = critical || score >= pack.thresholds.block_score ? "block" : score >= pack.thresholds.review_score ? "review" : "allow";
    tally[action] += 1;
  }
  return { total: rows.length, tally, perRule };
});

/** Precision and recall against generator labels. Body: { store, labels: { [eventId]: scenario } } */
app.post("/report", async (req) => {
  const body = z.object({ store: z.string(), labels: z.record(z.string()) }).parse(req.body);
  const rows = await db.select({ id: decisions.id, action: decisions.action, eventType: decisions.eventType }).from(decisions).where(eq(decisions.storeId, body.store));
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const byScenario: Record<string, { labelled: number; caught: number }> = {};
  for (const r of rows) {
    const label = body.labels[r.id];
    const flagged = r.action !== "allow";
    if (label) {
      byScenario[label] ??= { labelled: 0, caught: 0 };
      byScenario[label].labelled += 1;
      if (flagged) { tp += 1; byScenario[label].caught += 1; } else fn += 1;
    } else if (flagged) fp += 1; else tn += 1;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { tp, fp, fn, tn, precision, recall, byScenario };
});

app.post("/admin/recompute-stats", async (req) => {
  const body = z.object({ store: z.string() }).parse(req.body);
  return recomputeStoreStats(body.store);
});

app.post("/admin/reset", async (req) => {
  const body = z.object({ store: z.string() }).parse(req.body);
  await db.delete(decisions).where(eq(decisions.storeId, body.store));
  await db.delete(events).where(eq(events.storeId, body.store));
  await db.delete(storeStats).where(eq(storeStats.storeId, body.store));
  await db.delete(ruleOverrides).where(eq(ruleOverrides.storeId, body.store));
  return { ok: true };
});

app.post("/admin/reload-rules", async () => ({ version: reloadPack().version }));

/**
 * Replay the synthetic baseline into this store, in the background. Wipes the
 * store first unless reset=false. Poll GET /admin/replay for progress.
 */
app.post("/admin/replay", async (req, reply) => {
  const body = z.object({ store: z.string(), customers: z.number().int().positive().max(5000).optional(), days: z.number().int().positive().max(365).optional(), seed: z.number().int().optional(), reset: z.boolean().optional() }).parse(req.body ?? {});
  const started = startReplay(body, (o, m) => req.log.info(o, m));
  if (!started) return reply.code(409).send({ ...replayStatus(), error: "replay_running" });
  return reply.code(202).send(replayStatus());
});
app.get("/admin/replay", async () => replayStatus());

/** Dry run a single event without storing it. Useful for the storefront's "what would happen" and for tests. */
app.post("/evaluate", async (req, reply) => {
  const source = (req.headers["x-source"] as string | undefined) ?? "generic";
  let incoming: Event[];
  try {
    incoming = adapt(source, req.body);
  } catch (err) {
    return reply.code(400).send({ error: "invalid_event", detail: String(err) });
  }
  const e = incoming[0];
  const f = await computeFeatures(e);
  return decide(e, f);
});

const port = Number(process.env.PORT ?? process.env.LG_PORT ?? 4100);
await app.listen({ port, host: "0.0.0.0" });
