"use client";
import { useEffect, useState } from "react";
import { get, put, STORE, type Rule } from "@/lib/api";

type RulesResp = { version: number; thresholds: { block_score: number; review_score: number }; stats: Record<string, number>; rules: Rule[] };
type Sim = { total: number; tally: { allow: number; review: number; block: number }; perRule: Record<string, number> };

const OPS: Record<string, string> = { gte: "≥", lte: "≤", gt: ">", lt: "<", eq: "=", neq: "≠", in: "in" };

export default function Rules() {
  const [data, setData] = useState<RulesResp | null>(null);
  const [sim, setSim] = useState<Sim | null>(null);
  const [base, setBase] = useState<Sim | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const d = await get<RulesResp>(`/rules?store=${STORE}`);
    setData(d);
    const s = await get<Sim>(`/rules/simulate?store=${STORE}`);
    setSim(s);
    setBase((b) => b ?? s);
  };
  useEffect(() => { load(); }, []);

  const change = async (ruleId: string, patch: { enabled?: boolean; thresholds?: Record<string, unknown> }) => {
    setBusy(true);
    await put(`/rules/${ruleId}`, { store: STORE, ...patch });
    await load();
    setBusy(false);
  };

  if (!data || !sim) return <div className="empty">Loading…</div>;
  const delta = (k: "allow" | "review" | "block") => (base ? sim.tally[k] - base.tally[k] : 0);

  return (
    <>
      <h1>Rules</h1>
      <p className="sub">Pack v{data.version}. Block at {data.thresholds.block_score} or any critical, review at {data.thresholds.review_score}. Move a threshold and the counts below re-score the store's whole history without replaying it.</p>
      <div className="stats">
        <div className="panel stat"><div className="k">Events scored</div><div className="v">{sim.total}</div></div>
        <div className="panel stat"><div className="k">Would block</div><div className="v" style={{ color: "var(--block)" }}>{sim.tally.block} <small className="muted">{delta("block") ? (delta("block") > 0 ? `+${delta("block")}` : delta("block")) : ""}</small></div></div>
        <div className="panel stat"><div className="k">Would review</div><div className="v" style={{ color: "var(--review)" }}>{sim.tally.review} <small className="muted">{delta("review") ? (delta("review") > 0 ? `+${delta("review")}` : delta("review")) : ""}</small></div></div>
        <div className="panel stat"><div className="k">Store p95s</div><div className="v mono" style={{ fontSize: 12, marginTop: 6 }}>refund ratio {Number(data.stats.refund_value_ratio_90d_p95 ?? 0).toFixed(3)}<br />refund count {data.stats.refunds_90d_count_p95 ?? "-"}<br />stored-value share {Number(data.stats.stored_value_share_p95 ?? 0).toFixed(2)}</div></div>
      </div>
      <div className="panel">
        {data.rules.map((r) => (
          <div key={r.id} className="rule" style={{ opacity: r.enabled ? 1 : 0.45 }}>
            <div>
              <div className="flex">
                <label className="switch"><input type="checkbox" checked={r.enabled} disabled={busy} onChange={(e) => change(r.id, { enabled: e.target.checked })} /></label>
                <span className={`badge ${r.group}`}>{r.group}</span>
                <strong className="mono">{r.id}</strong>
                <span className={`badge ${r.severity}`}>{r.severity}</span>
                <span className="muted">+{r.weight}</span>
                <span className="muted mono" style={{ fontSize: 11 }}>on {r.applies_to.join(", ")}</span>
              </div>
              <p className="muted" style={{ margin: "6px 0 4px" }}>{r.explanation}</p>
              {r.when.map((c, i) => <Cond key={`w${i}`} c={c} k={`when.${i}`} rule={r} busy={busy} onChange={change} />)}
              {r.any && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>and any of:</div>}
              {r.any?.map((c, i) => <Cond key={`a${i}`} c={c} k={`any.${i}`} rule={r} busy={busy} onChange={change} />)}
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted" style={{ fontSize: 12 }}>fired in history</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{sim.perRule[r.id] ?? 0}</div>
              {base && (sim.perRule[r.id] ?? 0) !== (base.perRule[r.id] ?? 0) && <div className="muted">was {base.perRule[r.id] ?? 0}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Cond({ c, k, rule, busy, onChange }: { c: { feature: string; op: string; value: unknown }; k: string; rule: Rule; busy: boolean; onChange: (id: string, p: { thresholds: Record<string, unknown> }) => void }) {
  const numeric = typeof c.value === "number";
  const [v, setV] = useState<number>(numeric ? (c.value as number) : 0);
  useEffect(() => { if (numeric) setV(c.value as number); }, [c.value, numeric]);
  const max = v <= 1 ? 1 : v <= 24 ? 48 : v <= 100 ? 200 : v * 2;
  const step = v <= 1 ? 0.05 : 1;
  return (
    <div className="cond">
      <span className="mono">{c.feature}</span>
      <span className="muted">{OPS[c.op] ?? c.op}</span>
      {numeric ? (
        <>
          <input type="range" min={0} max={max} step={step} value={v} disabled={busy} onChange={(e) => setV(Number(e.target.value))} onMouseUp={() => onChange(rule.id, { thresholds: { [k]: v } })} onTouchEnd={() => onChange(rule.id, { thresholds: { [k]: v } })} />
          <input type="number" value={v} step={step} disabled={busy} onChange={(e) => setV(Number(e.target.value))} onBlur={() => onChange(rule.id, { thresholds: { [k]: v } })} />
        </>
      ) : (
        <span className="pill">{Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}</span>
      )}
      {rule.overrides[k] !== undefined && <span className="muted" style={{ fontSize: 11 }}>edited</span>}
    </div>
  );
}
