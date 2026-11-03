"use client";
import { useEffect, useState } from "react";
import { api, getCart, setCart, money, type Product } from "@/lib/api";

export default function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => { api<Product[]>("/products").then(setProducts).catch(() => setProducts([])); }, []);
  const add = (sku: string) => {
    const c = getCart();
    const it = c.find((i) => i.sku === sku);
    if (it) it.qty += 1; else c.push({ sku, qty: 1 });
    setCart(c);
    setAdded(sku);
    setTimeout(() => setAdded(null), 900);
  };
  return (
    <>
      <h1>Wine, cheese and the good stuff</h1>
      <p className="sub">Delivered across Brooklyn the same day. Pay with points, store credit, gift cards or card.</p>
      {products.length === 0 && <div className="alert info">No products. Seed the merchant API from the dashboard's demo control.</div>}
      <div className="grid">
        {products.map((p) => (
          <div key={p.sku} className="card product">
            <div className="cat">{p.category}</div>
            <div className="name">{p.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="price">{money(p.price)}</span>
              <span style={{ flex: 1 }} />
              <button className="btn" onClick={() => add(p.sku)}>{added === p.sku ? "Added" : "Add"}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
