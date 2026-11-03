"use client";
import { useEffect, useState } from "react";
import { api, getCart, setCart, money, type Product, type CartItem } from "@/lib/api";

export default function Cart() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setC] = useState<CartItem[]>([]);
  useEffect(() => { api<Product[]>("/products").then(setProducts); setC(getCart()); }, []);
  const update = (sku: string, qty: number) => { const c = getCart().map((i) => (i.sku === sku ? { ...i, qty } : i)).filter((i) => i.qty > 0); setCart(c); setC(c); };
  const preset = () => { const c = [{ sku: "WINE-BAROLO-21", qty: 3 }, { sku: "SPIRIT-MEZCAL", qty: 2 }, { sku: "MEAT-WAGYU", qty: 1 }]; setCart(c); setC(c); };
  const total = cart.reduce((a, i) => a + (products.find((p) => p.sku === i.sku)?.price ?? 0) * i.qty, 0);
  return (
    <>
      <h1>Your cart</h1>
      <p className="sub">{cart.length ? `${cart.reduce((a, i) => a + i.qty, 0)} items` : "Empty."} <a className="small" onClick={preset} style={{ cursor: "pointer", textDecoration: "underline" }}>load the wine order</a></p>
      <div className="card">
        <table className="table">
          <tbody>
            {cart.map((i) => { const p = products.find((x) => x.sku === i.sku); return (
              <tr key={i.sku}><td>{p?.name ?? i.sku}</td><td><input type="number" min={0} value={i.qty} onChange={(e) => update(i.sku, Number(e.target.value))} style={{ width: 56 }} /></td><td style={{ textAlign: "right" }}>{money((p?.price ?? 0) * i.qty)}</td></tr>
            ); })}
            <tr><td colSpan={2}><strong>Total</strong></td><td style={{ textAlign: "right" }}><strong>{money(total)}</strong></td></tr>
          </tbody>
        </table>
        <div style={{ marginTop: 12 }}><a className="btn" href="/checkout">Checkout</a></div>
      </div>
    </>
  );
}
