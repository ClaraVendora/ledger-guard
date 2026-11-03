/**
 * Geo and network classification of a request IP.
 *
 * In production this is a MaxMind or ipinfo lookup, or headers from the edge
 * (Cloudflare sets cf-ipcountry, Vercel sets x-vercel-ip-country). The demo
 * runs on localhost, so three sources are tried in order:
 *   1. edge headers if present
 *   2. demo override headers the storefront sets from a "simulate" control
 *      (x-demo-country, x-demo-network), so a rehearsal can show a foreign VPN
 *   3. a default of US residential
 */
import type { FastifyRequest } from "fastify";

export type Geo = { ip: string; ipCountry: string; ipAsnType: "residential" | "mobile" | "datacentre" | "vpn" | "tor" };

const NET = new Set(["residential", "mobile", "datacentre", "vpn", "tor"]);

export function geoOf(req: FastifyRequest): Geo {
  const h = req.headers;
  const country = (h["cf-ipcountry"] ?? h["x-vercel-ip-country"] ?? h["x-demo-country"] ?? "US") as string;
  const net = String(h["x-demo-network"] ?? "residential");
  return { ip: req.ip, ipCountry: country.toUpperCase().slice(0, 2), ipAsnType: (NET.has(net) ? net : "residential") as Geo["ipAsnType"] };
}
