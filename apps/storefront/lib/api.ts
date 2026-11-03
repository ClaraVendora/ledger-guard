"use client";
export const API = process.env.NEXT_PUBLIC_MERCHANT_API_URL ?? "http://localhost:4000";

/** A stable per-browser device id. Incognito gets a fresh one, which is the point for the demo. */
export function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("lg_device");
  if (!id) { id = `web-${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem("lg_device", id); }
  return id;
}
/** Session token is per tab (sessionStorage) so two accounts can be open on one device, as a fraudster would. */
export const getToken = () => (typeof window === "undefined" ? null : sessionStorage.getItem("lg_token"));
export const setToken = (t: string | null) => { if (t) sessionStorage.setItem("lg_token", t); else sessionStorage.removeItem("lg_token"); };

/** Demo only: pretend this tab is on another network. Real deployments get this from the edge or a geo-IP lookup. */
export type Net = { country: string; network: "residential" | "mobile" | "datacentre" | "vpn" | "tor" };
export const getNet = (): Net => { try { return JSON.parse(sessionStorage.getItem("lg_net") ?? "") as Net; } catch { return { country: "US", network: "residential" }; } };
export const setNet = (n: Net) => sessionStorage.setItem("lg_net", JSON.stringify(n));

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const net = getNet();
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-device-id": deviceId(), "x-demo-country": net.country, "x-demo-network": net.network, ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}), ...(init.headers ?? {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error ?? body.message ?? `${r.status}`), { status: r.status, body });
  return body as T;
}

export type Product = { sku: string; name: string; category: string; price: number; resalable: boolean };
export type Me = {
  customer: { id: string; email: string; name: string; createdAt: string };
  deviceId: string;
  balances: { points: number; credit: number; giftCards: { id: string; code: string; balance: number }[] };
  addresses: { id: string; line1: string; city: string; zip: string }[];
  ledger: { id: string; kind: string; amount: number; reason: string; createdAt: string }[];
  orders: { id: string; total: number; status: string; createdAt: string; tenders: any[] }[];
};

export type CartItem = { sku: string; qty: number };
export const getCart = (): CartItem[] => (typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem("lg_cart") ?? "[]"));
export const setCart = (c: CartItem[]) => localStorage.setItem("lg_cart", JSON.stringify(c));
export const money = (v: number) => `$${v.toFixed(2)}`;
