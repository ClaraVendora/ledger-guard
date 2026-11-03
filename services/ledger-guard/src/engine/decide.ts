import type { Event, Decision } from "@lg/events";
import { computeFeatures, type Features } from "./features.js";
import { loadPack, getStoreStats, getOverrides, evalCondition, applyOverride, type Pack } from "./rules.js";

const SEV: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
const SEV_NAME = ["none", "low", "medium", "high", "critical"] as const;

let pack: Pack = loadPack();
export function reloadPack() {
  pack = loadPack();
  return pack;
}
export function currentPack() {
  return pack;
}

export async function decide(e: Event, precomputed?: Features): Promise<Decision> {
  const features = precomputed ?? (await computeFeatures(e));
  const stats = await getStoreStats(e.storeId);
  const overrides = await getOverrides(e.storeId);

  const fired: Decision["firedRules"] = [];
  for (const base of pack.rules) {
    if (!base.applies_to.includes(e.type)) continue;
    const o = overrides[base.id];
    if (o && !o.enabled) continue;
    const rule = applyOverride(base, o);
    const all = rule.when.every((c) => evalCondition(c, features, stats));
    const any = rule.any ? rule.any.some((c) => evalCondition(c, features, stats)) : true;
    if (!(all && any)) continue;
    const evidence: Record<string, unknown> = {};
    for (const k of rule.evidence) evidence[k] = features[k];
    fired.push({
      ruleId: rule.id,
      group: rule.group,
      severity: rule.severity,
      weight: rule.weight,
      explanation: rule.explanation,
      evidence,
    });
  }

  const score = fired.reduce((a, r) => a + r.weight, 0);
  const sevIdx = fired.reduce((m, r) => Math.max(m, SEV[r.severity]), 0);
  const severity = SEV_NAME[sevIdx];
  const anyCritical = fired.some((r) => r.severity === "critical");
  const action: Decision["action"] =
    anyCritical || score >= pack.thresholds.block_score ? "block" : score >= pack.thresholds.review_score ? "review" : "allow";

  return { eventId: e.id, action, score, severity, firedRules: fired, features };
}
