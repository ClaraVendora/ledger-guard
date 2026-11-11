/**
 * Baseline replay as a background job, so the dashboard's demo control can load
 * the synthetic store without a terminal. One job per process; progress is polled.
 */
import { eq } from "drizzle-orm";
import { generateWorld, DEFAULTS, type GenerateOptions } from "@lg/data";
import { db } from "./db/client.js";
import { events, decisions, storeStats, ruleOverrides } from "./db/schema.js";
import { ingest } from "./ingest.js";
import { recomputeStoreStats } from "./engine/stats.js";

export type ReplayJob = {
  status: "idle" | "running" | "done" | "failed";
  store: string;
  total: number;
  done: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  summary: Record<string, unknown> | null;
};

const job: ReplayJob = { status: "idle", store: DEFAULTS.store, total: 0, done: 0, startedAt: null, finishedAt: null, error: null, summary: null };

export function replayStatus(): ReplayJob {
  return { ...job };
}

/** Start the job. Returns false if one is already running. */
export function startReplay(opts: GenerateOptions & { store: string; reset?: boolean }, log: (o: object, msg: string) => void): boolean {
  if (job.status === "running") return false;
  Object.assign(job, { status: "running", store: opts.store, total: 0, done: 0, startedAt: new Date().toISOString(), finishedAt: null, error: null, summary: null });
  void (async () => {
    try {
      if (opts.reset !== false) {
        await db.delete(decisions).where(eq(decisions.storeId, opts.store));
        await db.delete(events).where(eq(events.storeId, opts.store));
        await db.delete(storeStats).where(eq(storeStats.storeId, opts.store));
        await db.delete(ruleOverrides).where(eq(ruleOverrides.storeId, opts.store));
      }
      const { events: all, summary } = generateWorld(opts);
      job.total = all.length;
      job.summary = summary;
      for (const e of all) {
        await ingest(e);
        job.done += 1;
        if (job.done % 2000 === 0) log({ done: job.done, total: job.total }, "replay progress");
      }
      await recomputeStoreStats(opts.store);
      job.status = "done";
      job.finishedAt = new Date().toISOString();
      log({ total: job.total }, "replay done");
    } catch (err) {
      job.status = "failed";
      job.error = String(err);
      job.finishedAt = new Date().toISOString();
      log({ err: job.error }, "replay failed");
    }
  })();
  return true;
}
