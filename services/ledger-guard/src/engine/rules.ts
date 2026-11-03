import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { Features } from "./features.js";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { ruleOverrides, storeStats } from "../db/schema.js";

const Condition = z.object({
  feature: z.string(),
  op: z.enum(["eq", "neq", "gte", "lte", "gt", "lt", "in"]),
  value: z.unknown(),
});
export type Condition = z.infer<typeof Condition>;

const Rule = z.object({
  id: z.string(),
  group: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  weight: z.number(),
  applies_to: z.array(z.string()),
  explanation: z.string(),
  when: z.array(Condition),
  any: z.array(Condition).optional(),
  evidence: z.array(z.string()).default([]),
});
export type Rule = z.infer<typeof Rule>;

const Pack = z.object({
  version: z.number(),
  thresholds: z.object({ block_score: z.number(), review_score: z.number() }),
  rules: z.array(Rule),
});
export type Pack = z.infer<typeof Pack>;

const here = dirname(fileURLToPath(import.meta.url));

export function loadPack(): Pack {
  const raw = readFileSync(join(here, "..", "rules", "pack.yaml"), "utf8");
  return Pack.parse(YAML.parse(raw));
}

export type StoreStatsMap = Record<string, number>;

export async function getStoreStats(storeId: string): Promise<StoreStatsMap> {
  const rows = await db.select().from(storeStats).where(eq(storeStats.storeId, storeId)).limit(1);
  return (rows[0]?.stats as StoreStatsMap) ?? {};
}

export type Override = { enabled: boolean; thresholds: Record<string, unknown> };

export async function getOverrides(storeId: string): Promise<Record<string, Override>> {
  const rows = await db.select().from(ruleOverrides).where(eq(ruleOverrides.storeId, storeId));
  const out: Record<string, Override> = {};
  for (const r of rows) out[r.ruleId] = { enabled: r.enabled, thresholds: (r.thresholds as Record<string, unknown>) ?? {} };
  return out;
}

export async function setOverride(storeId: string, ruleId: string, o: Partial<Override>) {
  const existing = await db
    .select()
    .from(ruleOverrides)
    .where(and(eq(ruleOverrides.storeId, storeId), eq(ruleOverrides.ruleId, ruleId)))
    .limit(1);
  const merged: Override = {
    enabled: o.enabled ?? existing[0]?.enabled ?? true,
    thresholds: { ...((existing[0]?.thresholds as Record<string, unknown>) ?? {}), ...(o.thresholds ?? {}) },
  };
  if (existing[0]) {
    await db
      .update(ruleOverrides)
      .set({ enabled: merged.enabled, thresholds: merged.thresholds, updatedAt: new Date() })
      .where(and(eq(ruleOverrides.storeId, storeId), eq(ruleOverrides.ruleId, ruleId)));
  } else {
    await db.insert(ruleOverrides).values({ storeId, ruleId, enabled: merged.enabled, thresholds: merged.thresholds });
  }
  return merged;
}

/** Resolve "p95:<stat>" against the store's stats; literal otherwise. */
function resolveValue(v: unknown, stats: StoreStatsMap): unknown {
  if (typeof v === "string" && v.startsWith("p")) {
    const m = /^p(\d+):(.+)$/.exec(v);
    if (m) {
      const key = `${m[2]}_p${m[1]}`;
      return stats[key] ?? Number.POSITIVE_INFINITY; // no stats yet means the percentile rule cannot fire
    }
  }
  return v;
}

export function evalCondition(c: Condition, f: Features, stats: StoreStatsMap): boolean {
  const left = f[c.feature];
  const right = resolveValue(c.value, stats);
  if (left === undefined || left === null) return false;
  switch (c.op) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "in":
      return Array.isArray(right) && right.includes(left);
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
  }
}

/** Apply dashboard overrides to a rule's condition values. thresholds keys are "when.<i>" or "any.<i>". */
export function applyOverride(rule: Rule, o?: Override): Rule {
  if (!o) return rule;
  const when = rule.when.map((c, i) => (o.thresholds[`when.${i}`] !== undefined ? { ...c, value: o.thresholds[`when.${i}`] } : c));
  const any = rule.any?.map((c, i) => (o.thresholds[`any.${i}`] !== undefined ? { ...c, value: o.thresholds[`any.${i}`] } : c));
  return { ...rule, when, any };
}
