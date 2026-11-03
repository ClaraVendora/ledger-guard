export const LG = process.env.NEXT_PUBLIC_LEDGER_GUARD_URL ?? "http://localhost:4100";
export const MERCHANT = process.env.NEXT_PUBLIC_MERCHANT_API_URL ?? "http://localhost:4000";
export const STORE = process.env.NEXT_PUBLIC_STORE_ID ?? "demo-grocer";

export type FiredRule = { ruleId: string; group: string; severity: string; weight: number; explanation: string; evidence: Record<string, unknown> };
export type Decision = {
  id: string;
  storeId: string;
  customerId: string | null;
  eventType: string;
  occurredAt: string;
  action: "allow" | "review" | "block";
  score: number;
  severity: string;
  firedRules: FiredRule[];
  features: Record<string, unknown>;
  reviewStatus: string | null;
};
export type TimelineEvent = { id: string; type: string; occurred_at: string; payload: Record<string, any> };
export type Rule = {
  id: string;
  group: string;
  severity: string;
  weight: number;
  applies_to: string[];
  explanation: string;
  when: { feature: string; op: string; value: unknown }[];
  any?: { feature: string; op: string; value: unknown }[];
  enabled: boolean;
  overrides: Record<string, unknown>;
  firedCount: number;
};

export async function get<T>(path: string, base = LG): Promise<T> {
  const r = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}
export async function post<T>(path: string, body: unknown, base = LG): Promise<T> {
  const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
export async function put<T>(path: string, body: unknown, base = LG): Promise<T> {
  const r = await fetch(`${base}${path}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const fmtNum = (v: unknown) => (typeof v === "number" ? (v > 1e8 ? "never" : Number.isInteger(v) ? String(v) : v.toFixed(2)) : v === null || v === undefined ? "" : String(v));
export const money = (v: number) => `$${v.toFixed(2)}`;

export function describeEvent(e: TimelineEvent): string {
  const p = e.payload;
  switch (e.type) {
    case "auth.login": return `Login from ${p.deviceId ?? "unknown device"}`;
    case "auth.login_failed": return `Failed login from ${p.deviceId ?? "unknown device"}`;
    case "auth.reset": return `Password reset from ${p.deviceId ?? "unknown device"}`;
    case "auth.new_device": return `New device ${p.deviceId}`;
    case "value.issue": return `${p.kind} issued: ${money(p.amount)} (${p.reason})`;
    case "value.load": return `${p.kind} loaded: ${money(p.amount)} on ${p.cardFingerprint ?? "card"}${p.avs === "fail" ? ", AVS fail" : ""}`;
    case "value.transfer": return `Transfer ${money(p.amount)} ${p.kind} from ${p.customerId} to ${p.toCustomerId}`;
    case "value.reverse": return `Reversed ${money(p.amount)} ${p.kind}`;
    case "giftcard.balance_check": return `Balance check ${p.code} (${p.valid ? "valid" : "invalid"})`;
    case "order.created": {
      const sv = (p.tenders ?? []).filter((t: any) => t.kind !== "card").reduce((a: number, t: any) => a + t.amount, 0);
      return `Order ${money(p.total)}, ${money(sv)} stored value${p.newShippingAddress ? ", new address" : ""}`;
    }
    case "refund.created": return `Refund ${money(p.amount)} to ${p.destination} (${p.reason})`;
    default: return e.type;
  }
}
