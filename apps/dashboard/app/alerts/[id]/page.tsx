"use client";
import { use, useEffect, useState } from "react";
import { get, post, fmtTime, fmtNum, describeEvent, type Decision, type TimelineEvent } from "@/lib/api";

type Alert = Decision & { timeline: TimelineEvent[] };
const HOT = new Set(["auth.reset", "auth.new_device", "value.transfer", "value.load", "refund.created"]);

export default function AlertDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<Alert | null>(null);
  const load = async () => setA(await get<Alert>(`/alerts/${id}`));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return <div className="empty">Loading…</div>;

  const review = async (s: "true_positive" | "false_positive") => { await post(`/alerts/${id}/review`, { status: s }); load(); };
  const focusDevice = (a.features.event_type && (a.timeline.at(-1)?.payload.deviceId as string | undefined)) || undefined;

  return (
    <>
      <div className="flex">
        <h1>
          <span className={`badge ${a.action}`} style={{ fontSize: 13, marginRight: 10 }}>{a.action}</span>
          {a.eventType} <span className="mono muted">{a.id}</span>
        </h1>
        <div className="sp" />
        {a.reviewStatus ? <span className="muted">Marked {a.reviewStatus.replace("_", " ")}</span> : (
          <div className="row-actions">
            <button className="btn danger" onClick={() => review("true_positive")}>Confirm fraud</button>
            <button className="btn" onClick={() => review("false_positive")}>Legitimate</button>
          </div>
        )}
      </div>
      <p className="sub">{fmtTime(a.occurredAt)} · customer <a className="mono" href={`/accounts/${a.customerId}`}>{a.customerId}</a> · score {a.score} · severity <span className={`badge ${a.severity}`}>{a.severity}</span></p>

      <div className="grid2">
        <div>
          <h2>Why it fired</h2>
          <div className="panel">
            {a.firedRules.length === 0 && <div className="empty">No rules fired.</div>}
            {a.firedRules.map((r) => (
              <div key={r.ruleId} style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
                <div className="flex">
                  <span className={`badge ${r.group}`}>{r.group}</span>
                  <strong className="mono">{r.ruleId}</strong>
                  <div className="sp" />
                  <span className={`badge ${r.severity}`}>{r.severity}</span>
                  <span className="muted">+{r.weight}</span>
                </div>
                <p style={{ margin: "8px 0" }}>{r.explanation}</p>
                <div className="kv mono">
                  {Object.entries(r.evidence).map(([k, v]) => (
                    <><span key={k + "k"} className="k">{k}</span><span key={k + "v"}>{fmtNum(v)}</span></>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <h2>All features at decision time</h2>
          <div className="panel" style={{ padding: 12 }}>
            <div className="kv mono" style={{ fontSize: 11 }}>
              {Object.entries(a.features).map(([k, v]) => (
                <><span key={k + "k"} className="k">{k}</span><span key={k + "v"}>{fmtNum(v)}</span></>
              ))}
            </div>
          </div>
        </div>
        <div>
          <h2>What happened, last 14 days</h2>
          <div className="panel" style={{ padding: "12px 16px" }}>
            <ul className="timeline">
              {a.timeline.map((e) => (
                <li key={e.id} className={`${HOT.has(e.type) ? "hot" : ""} ${e.id === a.id ? "focus" : ""}`}>
                  <div className="mono muted" style={{ fontSize: 11 }}>{fmtTime(e.occurred_at)} {e.payload.deviceId && <span className="pill" style={{ marginLeft: 6, background: e.payload.deviceId === focusDevice ? "rgba(239,94,107,.18)" : undefined }}>{e.payload.deviceId}</span>}</div>
                  <div>{describeEvent(e)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
