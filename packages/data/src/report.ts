/** Precision and recall of Ledger Guard's decisions against the generator's labels. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const URL = process.env.LEDGER_GUARD_URL ?? "http://localhost:4100";
const STORE = process.env.STORE_ID ?? "demo-grocer";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const labels = JSON.parse(readFileSync(join(outDir, "labels.json"), "utf8"));

const r = await fetch(`${URL}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ store: STORE, labels }) });
const rep = await r.json();
console.log(JSON.stringify(rep, null, 2));
