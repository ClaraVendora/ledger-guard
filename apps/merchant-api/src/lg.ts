/**
 * The merchant's client for Ledger Guard. Everything the store does becomes an
 * event here. Checkout waits for the decision; everything else is fire and
 * forget with a short timeout so the store never blocks on the risk engine.
 */
import type { Event, Decision } from "@lg/events";

const base = process.env.LEDGER_GUARD_URL ?? "http://localhost:4100";
export const STORE_ID = process.env.STORE_ID ?? "demo-grocer";

export async function sendEvent(e: Event, opts: { wait?: boolean } = {}): Promise<Decision | null> {
  const p = fetch(`${base}/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-source": "merchant" },
    body: JSON.stringify(e),
    signal: AbortSignal.timeout(opts.wait ? 8000 : 2500),
  })
    .then(async (r) => (r.ok ? ((await r.json()) as Decision) : null))
    .catch(() => null);
  if (opts.wait) return p;
  void p;
  return null;
}

export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
export const nowIso = () => new Date().toISOString();
