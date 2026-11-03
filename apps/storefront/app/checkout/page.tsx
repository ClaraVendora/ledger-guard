"use client";
import { useEffect, useMemo, useState } from "react";
import { api, getCart, setCart, getToken, money, type Product, type Me } from "@/lib/api";

type Blocked = { status: "blocked"; orderId: string; message: string; reasonCode: string };
type Placed = { status: "placed" | "review"; orderId: string; total: number; tenders: any[]; paymentIntent: any };

export default function Checkout() {
  const [products, setProducts] = useState<Product[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [addressId, setAddressId] = useState("");
  const [usePoints, setUsePoints] = useState(0);
  const [useCredit, setUseCredit] = useState(0);
  const [useGc, setUseGc] = useState<string[]>([]);
  const [avs, setAvs] = useState<"pass" | "fail">("pass");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blocked | Placed | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { location.href = "/login"; return; }
    api<Product[]>("/products").then(setProducts);
    api<Me>("/me").then((m) => {
      setMe(m);
      setAddressId(m.addresses.at(-1)?.id ?? "");
      // default: use everything the account holds, so a stored-value-heavy order is one click
      setUsePoints(Math.floor(m.balances.points));
      setUseCredit(Math.floor(m.balances.credit));
      setUseGc(m.balances.giftCards.filter((g) => g.balance > 0).map((g) => g.code));
    });
  }, []);

  const cart = useMemo(() => getCart(), []);
  const total = cart.reduce((a, i) => a + (products.find((p) => p.sku === i.sku)?.price ?? 0) * i.qty, 0);
  const split = useMemo(() => {
    let rem = total;
    const pts = Math.min(usePoints, me?.balances.points ?? 0, rem); rem -= pts;
    const cr = Math.min(useCredit, me?.balances.credit ?? 0, rem); rem -= cr;
    let gc = 0;
    for (const g of me?.balances.giftCards ?? []) if (useGc.includes(g.code)) { const u = Math.min(g.balance, rem); gc += u; rem -= u; }
    return { pts, cr, gc, card: Math.max(0, Number(rem.toFixed(2))) };
  }, [total, usePoints, useCredit, useGc, me]);

  const pay = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<Placed>("/checkout", { method: "POST", body: JSON.stringify({ items: cart, shippingAddressId: addressId, usePoints, useCredit, giftCardCodes: useGc, cardFingerprint: "visa-4242", avs }) });
      setResult(r); setCart([]);
    } catch (e: any) {
      if (e.status === 402) setResult(e.body as Blocked); else setErr(e.message);
    }
    setBusy(false);
  };

  if (!me) return <p className="sub">Loading…</p>;

  if (result?.status === "blocked") return (
    <div className="card block">
      <div className="x">!</div>
      <h1>We couldn't complete your order</h1>
      <p className="sub" style={{ maxWidth: 440, margin: "8px auto 16px" }}>{result.message}</p>
      <p className="small">Nothing has been charged and no stored value has been used.</p>
      <a className="btn secondary" href="/account">Back to account</a>
    </div>
  );
  if (result) return (
    <div className="card block">
      <div className="x" style={{ background: "#e8f3ea", color: "var(--ok)" }}>✓</div>
      <h1>{result.status === "review" ? "Order received, we're just checking a detail" : "Order placed"}</h1>
      <p className="sub">Order {result.orderId.slice(-6).toUpperCase()} · {money(result.total)}{result.paymentIntent ? ` · card ${result.paymentIntent.fake ? "(simulated)" : result.paymentIntent.status}` : " · no card charge"}</p>
      <a className="btn secondary" href="/account">Back to account</a>
    </div>
  );

  return (
    <>
      <h1>Checkout</h1>
      <p className="sub">{cart.reduce((a, i) => a + i.qty, 0)} items · {money(total)}</p>
      <div className="two">
        <div className="card">
          <label className="field">Deliver to
            <select value={addressId} onChange={(e) => setAddressId(e.target.value)}>
              {me.addresses.map((a) => <option key={a.id} value={a.id}>{a.line1}, {a.city} {a.zip}</option>)}
            </select>
          </label>
          <div className="small" style={{ marginBottom: 12 }}>Need a new address? Add it on your <a href="/account"><u>account</u></a> page.</div>
          <label className="field">Use points (have {me.balances.points.toFixed(0)})<input type="number" value={usePoints} onChange={(e) => setUsePoints(Number(e.target.value))} /></label>
          <label className="field">Use store credit (have {money(me.balances.credit)})<input type="number" value={useCredit} onChange={(e) => setUseCredit(Number(e.target.value))} /></label>
          <div className="field">Gift cards
            {me.balances.giftCards.map((g) => (
              <label key={g.code} style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink)" }}>
                <input type="checkbox" checked={useGc.includes(g.code)} onChange={(e) => setUseGc(e.target.checked ? [...useGc, g.code] : useGc.filter((c) => c !== g.code))} />{g.code} ({money(g.balance)})
              </label>
            ))}
            {me.balances.giftCards.length === 0 && <span className="muted">none on this account</span>}
          </div>
          <label className="field">Card on file: Visa ····4242 <select value={avs} onChange={(e) => setAvs(e.target.value as any)}><option value="pass">billing address matches</option><option value="fail">billing address mismatch (simulate AVS fail)</option></select></label>
        </div>
        <div className="card">
          <div className="tender"><span>Points</span><span>{money(split.pts)}</span></div>
          <div className="tender"><span>Store credit</span><span>{money(split.cr)}</span></div>
          <div className="tender"><span>Gift cards</span><span>{money(split.gc)}</span></div>
          <div className="tender"><span>Card</span><span>{money(split.card)}</span></div>
          <div className="tender total"><span>Total</span><span>{money(total)}</span></div>
          {err && <div className="alert err" style={{ margin: "12px 0" }}>{err}</div>}
          <button className="btn warm" style={{ width: "100%", marginTop: 16 }} disabled={busy || !cart.length || !addressId} onClick={pay}>{busy ? "Checking…" : `Pay ${money(total)}`}</button>
          <div className="small" style={{ marginTop: 8 }}>Stored value is applied first; the card covers the rest.</div>
        </div>
      </div>
    </>
  );
}
