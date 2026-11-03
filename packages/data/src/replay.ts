/**
 * Replay out/events.jsonl into Ledger Guard in time order, in batches.
 * Then recompute store stats and print the decision tally.
 *
 * Usage: pnpm data:replay [--url http://localhost:4100] [--batch 200] [--store demo-grocer] [--reset]
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] ?? "true"] : [])).filter((x) => x.length));
const URL = String(args.url ?? process.env.LEDGER_GUARD_URL ?? "http://localhost:4100");
const BATCH = Number(args.batch ?? 200);
const STORE = String(args.store ?? "demo-grocer");

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const lines = readFileSync(join(outDir, "events.jsonl"), "utf8").trim().split("\n");
const events = lines.map((l) => JSON.parse(l));

async function post(path: string, body: unknown) {
  const r = await fetch(`${URL}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-source": "generator" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  if (args.reset) await post("/admin/reset", { store: STORE });
  // Two passes: first pass stores events and decides with no store stats (percentile rules cannot fire),
  // then stats are computed and the tail of the window is re-decided through /evaluate counts in the report.
  // For the PoC: compute stats from a first dry pass of the baseline, then replay for real.
  const tally = { allow: 0, review: 0, block: 0 };
  const t0 = Date.now();
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    const out = (await post("/events", batch)) as { action: keyof typeof tally }[];
    for (const d of out) tally[d.action] += 1;
    if (i % (BATCH * 10) === 0) {
      process.stdout.write(`\r${i + batch.length}/${events.length}`);
      await post("/admin/recompute-stats", { store: STORE });
    }
  }
  const stats = await post("/admin/recompute-stats", { store: STORE });
  console.log(`\nreplayed ${events.length} events in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("tally", tally);
  console.log("store stats", stats);
}

main().catch((e) => { console.error(e); process.exit(1); });
