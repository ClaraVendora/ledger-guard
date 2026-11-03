"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get, STORE, fmtTime, describeEvent, money, type Decision, type TimelineEvent } from "@/lib/api";

type Account = { customerId: string; events: TimelineEvent[]; alerts: Decision[]; devices: { device_id: string; n: number; last_seen: string }[] };

export default function AccountView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<Account | null>(null);
  const router = useRouter();
  useEffect(() => { get<Account>(`/accounts/${id}?store=${STORE}`).then(setA); }, [id]);
  if (!a) return <div className="empty">Loading…</div>;

  // balances reconstructed from ledger events the engine has seen
  const bal = { points: 0, credit: 0, giftCards: 0 };
  for (const e of [...a.events].reverse()) {
    const p = e.payload;
    if (e.type === "value.issue" && p.customerId === id) (bal as any)[p.kind] += p.amount;
    if (e.type === "value.load" && p.customerId === id && p.kind === "gift_card") bal.giftCards += p.amount;
    if (e.type === "value.transfer") { if (p.toCustomerId === id) (bal as any)[p.kind] += p.amount; else (bal as any)[p.kind] -= p.amount; }
    if (e.type === "order.created") for (const t of p.tenders ?? []) { if (t.kind === "gift_card") bal.giftCards -= t.amount; else if (t.kind !== "card") (bal as any)[t.kind] -= t.amount; }
  }
  const transfers = a.events.filter((e) => e.type === "value.transfer");
  const orders = a.events.filter((e) => e.type === "order.created");

  return (
    <>
      <h1>Account <span className="mono">{id}</span></h1>
      <p className="sub">{orders.length} orders seen · {a.devices.length} devices · {a.alerts.length} alerts</p>
      <div className="stats">
        <div className="panel stat"><div className="k">Points (seen)</div><div className="v">{bal.points.toFixed(0)}</div></div>
        <div className="panel stat"><div className="k">Store credit (seen)</div><div className="v">{money(bal.credit)}</div></div>
        <div className="panel stat"><div className="k">Gift cards (seen)</div><div className="v">{money(Math.max(0, bal.giftCards))}</div></div>
        <div className="panel stat"><div className="k">Open alerts</div><div className="v" style={{ color: a.alerts.some((x) => !x.reviewStatus) ? "var(--block)" : undefined }}>{a.alerts.filter((x) => !x.reviewStatus).length}</div></div>
      </div>
      <div className="grid2">
        <div>
          <h2>Devices</h2>
          <div className="panel">
            <table className="table"><thead><tr><th>Device</th><th>Events</th><th>Last seen</th></tr></thead><tbody>
              {a.devices.map((d) => <tr key={d.device_id}><td className="mono">{d.device_id}</td><td>{d.n}</td><td className="mono muted">{fmtTime(d.last_seen)}</td></tr>)}
            </tbody></table>
          </div>
          <h2>Transfers</h2>
          <div className="panel">
            {transfers.length === 0 ? <div className="empty">None</div> : (
              <table className="table"><thead><tr><th>Time</th><th>Direction</th><th>Amount</th><th>Counterparty</th></tr></thead><tbody>
                {transfers.map((e) => { const p = e.payload; const inbound = p.toCustomerId === id; return (
                  <tr key={e.id}><td className="mono muted">{fmtTime(e.occurred_at)}</td><td>{inbound ? "in" : "out"}</td><td>{money(p.amount)} {p.kind}</td><td className="mono"><a href={`/accounts/${inbound ? p.customerId : p.toCustomerId}`}>{inbound ? p.customerId : p.toCustomerId}</a></td></tr>
                ); })}
              </tbody></table>
            )}
          </div>
          <h2>Alerts</h2>
          <div className="panel">
            {a.alerts.length === 0 ? <div className="empty">None</div> : (
              <table className="table"><tbody>
                {a.alerts.map((d) => <tr key={d.id} className="row" onClick={() => router.push(`/alerts/${d.id}`)}><td className="mono muted">{fmtTime(d.occurredAt)}</td><td><span className={`badge ${d.action}`}>{d.action}</span></td><td className="mono">{d.eventType}</td><td>{d.score}</td></tr>)}
              </tbody></table>
            )}
          </div>
        </div>
        <div>
          <h2>Recent activity</h2>
          <div className="panel" style={{ padding: "12px 16px", maxHeight: 720, overflow: "auto" }}>
            <ul className="timeline">
              {a.events.slice(0, 80).map((e) => (
                <li key={e.id}><div className="mono muted" style={{ fontSize: 11 }}>{fmtTime(e.occurred_at)} {e.payload.deviceId && <span className="pill" style={{ marginLeft: 6 }}>{e.payload.deviceId}</span>}</div><div>{describeEvent(e)}</div></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
