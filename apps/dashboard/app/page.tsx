"use client";
import { useEffect, useRef, useState } from "react";
import { get, STORE, type Decision } from "@/lib/api";
import { DecisionTable } from "@/components/DecisionTable";

export default function LiveFeed() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [filter, setFilter] = useState<"all" | "review" | "block">("all");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const q = filter === "all" ? "" : `&action=${filter}`;
        const data = await get<Decision[]>(`/decisions?store=${STORE}&limit=60${q}`);
        if (!alive) return;
        const fresh = new Set<string>();
        for (const d of data) if (!seen.current.has(d.id)) { fresh.add(d.id); seen.current.add(d.id); }
        if (seen.current.size > 100000) seen.current = new Set(data.map((d) => d.id));
        setRows(data);
        if (fresh.size && rows.length) setNewIds(fresh);
      } catch {}
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const counts = { block: rows.filter((r) => r.action === "block").length, review: rows.filter((r) => r.action === "review").length, allow: rows.filter((r) => r.action === "allow").length };

  return (
    <>
      <div className="flex">
        <h1>Live feed</h1>
        <span className="live" style={{ marginLeft: 8 }} />
        <span className="muted">polling every 2s</span>
        <div className="sp" />
        <div className="filters">
          {(["all", "review", "block"] as const).map((f) => (
            <button key={f} className={`btn ${filter === f ? "primary" : ""}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>
      <p className="sub">Every event the store sends, with Ledger Guard's decision. Click a row for the evidence.</p>
      <div className="stats">
        <div className="panel stat"><div className="k">Last 60 events</div><div className="v">{rows.length}</div></div>
        <div className="panel stat"><div className="k">Blocked</div><div className="v" style={{ color: "var(--block)" }}>{counts.block}</div></div>
        <div className="panel stat"><div className="k">For review</div><div className="v" style={{ color: "var(--review)" }}>{counts.review}</div></div>
        <div className="panel stat"><div className="k">Allowed</div><div className="v" style={{ color: "var(--allow)" }}>{counts.allow}</div></div>
      </div>
      <div className="panel">
        <DecisionTable rows={rows} newIds={newIds} />
      </div>
    </>
  );
}
