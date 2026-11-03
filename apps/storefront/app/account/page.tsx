"use client";
import { useEffect, useState } from "react";
import { api, getToken, money, type Me } from "@/lib/api";

export default function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [xfer, setXfer] = useState({ toEmail: "dana@example.com", kind: "credit", amount: 150 });
  const [gc, setGc] = useState({ amount: 50, cardFingerprint: "visa-4242" });
  const [addr, setAddr] = useState({ line1: "88 Freight Rd Unit 4", city: "Newark", zip: "07105" });
  const [code, setCode] = useState("GC-DANA-0001");

  const load = () => api<Me>("/me").then(setMe).catch(() => { location.href = "/login"; });
  useEffect(() => { if (!getToken()) location.href = "/login"; else load(); }, []);
  if (!me) return <p className="sub">Loading…</p>;

  const act = async (label: string, fn: () => Promise<any>) => {
    setMsg(null);
    try { const r = await fn(); setMsg({ kind: r?.decision === "block" ? "info" : "ok", text: `${label} done${r?.decision ? ` (risk engine: ${r.decision})` : ""}.` }); load(); }
    catch (e: any) { setMsg({ kind: "err", text: `${label} failed: ${e.message}` }); }
  };

  return (
    <>
      <h1>Hi {me.customer.name.split(" ")[0]}</h1>
      <p className="sub">{me.customer.email} · member since {new Date(me.customer.createdAt).toLocaleDateString()} · this device <span className="mono">{me.deviceId}</span></p>
      {msg && <div className={`alert ${msg.kind}`} style={{ marginBottom: 16 }}>{msg.text}</div>}
      <div className="card balance">
        <div className="b"><div className="k">Points</div><div className="v">{me.balances.points.toFixed(0)}</div><div className="small">1 point = $1 at checkout</div></div>
        <div className="b"><div className="k">Store credit</div><div className="v">{money(me.balances.credit)}</div></div>
        <div className="b"><div className="k">Gift cards</div><div className="v">{money(me.balances.giftCards.reduce((a, g) => a + g.balance, 0))}</div><div className="small">{me.balances.giftCards.map((g) => g.code).join(", ") || "none"}</div></div>
      </div>

      <div className="two" style={{ marginTop: 24 }}>
        <div>
          <h2>Send points or credit</h2>
          <div className="card">
            <label className="field">To (email)<input value={xfer.toEmail} onChange={(e) => setXfer({ ...xfer, toEmail: e.target.value })} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="field">What<select value={xfer.kind} onChange={(e) => setXfer({ ...xfer, kind: e.target.value })}><option value="credit">Store credit</option><option value="points">Points</option></select></label>
              <label className="field">Amount<input type="number" value={xfer.amount} onChange={(e) => setXfer({ ...xfer, amount: Number(e.target.value) })} /></label>
            </div>
            <button className="btn" onClick={() => act("Transfer", () => api("/value/transfer", { method: "POST", body: JSON.stringify(xfer) }))}>Send</button>
          </div>

          <h2>Gift cards</h2>
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="field">Buy, amount<input type="number" value={gc.amount} onChange={(e) => setGc({ ...gc, amount: Number(e.target.value) })} /></label>
              <label className="field">Card<input value={gc.cardFingerprint} onChange={(e) => setGc({ ...gc, cardFingerprint: e.target.value })} /></label>
            </div>
            <button className="btn" onClick={() => act("Gift card purchase", () => api("/giftcards/buy", { method: "POST", body: JSON.stringify(gc) }))}>Buy gift card</button>
            <div style={{ marginTop: 16 }}>
              <label className="field">Check a balance<input value={code} onChange={(e) => setCode(e.target.value)} /></label>
              <button className="btn secondary" onClick={() => act("Balance check", async () => { const r = await api<{ valid: boolean; balance?: number }>(`/giftcards/balance?code=${encodeURIComponent(code)}`); setMsg({ kind: r.valid ? "ok" : "err", text: r.valid ? `Balance ${money(r.balance!)}` : "No such card" }); return null; })}>Check</button>
            </div>
          </div>
        </div>
        <div>
          <h2>Addresses</h2>
          <div className="card">
            {me.addresses.map((a) => <div key={a.id} style={{ marginBottom: 6 }}>{a.line1}, {a.city} {a.zip} <span className="mono muted">{a.id}</span></div>)}
            <div style={{ borderTop: "1px solid var(--line)", margin: "12px 0" }} />
            <label className="field">Add a new address<input value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="field">City<input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></label>
              <label className="field">Zip<input value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} /></label>
            </div>
            <button className="btn secondary" onClick={() => act("Address", () => api("/addresses", { method: "POST", body: JSON.stringify(addr) }))}>Add address</button>
          </div>

          <h2>Recent orders</h2>
          <div className="card">
            {me.orders.length === 0 && <div className="muted">No orders yet on this account.</div>}
            {me.orders.map((o) => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                <span className="mono">{o.id.slice(-6).toUpperCase()}</span><span className="small">{new Date(o.createdAt).toLocaleDateString()}</span><span>{money(o.total)}</span><span className="pill">{o.status}</span>
                {o.status === "placed" && <button className="btn secondary" style={{ padding: "2px 8px" }} onClick={() => act("Refund claim", () => api(`/orders/${o.id}/refund`, { method: "POST", body: JSON.stringify({ amount: Number((o.total * 0.6).toFixed(2)), reason: "item_not_received", destination: "credit" }) }))}>Claim missing item</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
