"use client";
import { useState } from "react";
import { get, post, LG, MERCHANT, STORE } from "@/lib/api";

export default function Admin() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const say = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l].slice(0, 40));

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    say(`${label}…`);
    try { const r = await fn(); say(`${label}: ${typeof r === "string" ? r : JSON.stringify(r)}`); } catch (e) { say(`${label} failed: ${String(e)}`); }
    setBusy(false);
  };

  return (
    <>
      <h1>Demo control</h1>
      <p className="sub">Reset state between rehearsals. The baseline replay runs from the terminal (<span className="mono">pnpm data:replay -- --reset</span>) because it streams tens of thousands of events.</p>
      <div className="panel" style={{ padding: 16 }}>
        <div className="flex" style={{ flexWrap: "wrap" }}>
          <button className="btn" disabled={busy} onClick={() => run("Health", async () => ({ engine: await get("/health"), merchant: await get("/health", MERCHANT) }))}>Check health</button>
          <button className="btn" disabled={busy} onClick={() => run("Reset merchant and seed demo accounts", () => post("/admin/reset", { seed: true, resetLedgerGuard: false }, MERCHANT))}>Reset merchant (keep baseline)</button>
          <button className="btn" disabled={busy} onClick={() => run("Recompute store stats", () => post("/admin/recompute-stats", { store: STORE }))}>Recompute store p95s</button>
          <button className="btn" disabled={busy} onClick={() => run("Reload rule pack", () => post("/admin/reload-rules", {}))}>Reload rules from YAML</button>
          <button className="btn danger" disabled={busy} onClick={() => { if (confirm("Wipe Ledger Guard history for this store? You will need to replay the baseline.")) run("Reset Ledger Guard", () => post("/admin/reset", { store: STORE })); }}>Reset Ledger Guard (wipe history)</button>
        </div>
        <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>Engine {LG} · Merchant {MERCHANT} · Store {STORE}</div>
      </div>
      <h2>Run script</h2>
      <div className="panel" style={{ padding: 16 }}>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>Reset merchant (keep baseline). Open the live feed in this window.</li>
          <li>Storefront, second window: log in as <span className="mono">sam@example.com</span>, buy cheese and bread with a few points. Feed shows <span className="badge allow">allow</span>.</li>
          <li>Storefront, incognito: Forgot password for <span className="mono">dana@example.com</span>. Open the email (or /outbox), set a new password. Feed shows reset and new device.</li>
          <li>Still incognito, second tab: log in as <span className="mono">jj.quick@example.com</span>, transfer $150 credit to Dana. Feed shows <span className="badge block">block</span> on the transfer.</li>
          <li>As Dana: add a new address, cart three Barolo, two mezcal, one wagyu, pay with points, credit and the gift card, leave about $20 on the card. Checkout returns the block screen.</li>
          <li>Here: open the alert, walk the three rules and the timeline. Then Rules: raise <span className="mono">redeem_after_reset</span> stored-value share to 1.0 and watch the counts change.</li>
        </ol>
      </div>
      <h2>Log</h2>
      <div className="log">{log.join("\n") || "—"}</div>
    </>
  );
}
