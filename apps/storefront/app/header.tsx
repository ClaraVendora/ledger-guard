"use client";
import { useEffect, useState } from "react";
import { getToken, getCart, deviceId, getNet, setNet, type Net } from "@/lib/api";

export function Header() {
  const [authed, setAuthed] = useState(false);
  const [n, setN] = useState(0);
  const [dev, setDev] = useState("");
  const [net, setNetState] = useState<Net>({ country: "US", network: "residential" });
  useEffect(() => {
    const sync = () => { setAuthed(Boolean(getToken())); setN(getCart().reduce((a, i) => a + i.qty, 0)); setDev(deviceId()); setNetState(getNet()); };
    sync();
    window.addEventListener("storage", sync);
    const t = setInterval(sync, 1000);
    return () => { window.removeEventListener("storage", sync); clearInterval(t); };
  }, []);
  return (
    <header>
      <a className="logo" href="/">Orchard &amp; Vine</a>
      <span className="small">device <span className="mono">{dev}</span></span>
      <span className="small">
        network{" "}
        <select className="mono" style={{ font: "inherit", background: "transparent", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 4px" }} value={`${net.country}:${net.network}`} onChange={(e) => { const [country, network] = e.target.value.split(":"); setNet({ country, network: network as Net["network"] }); setNetState(getNet()); }}>
          <option value="US:residential">US home broadband</option>
          <option value="US:mobile">US mobile</option>
          <option value="US:datacentre">US datacentre</option>
          <option value="NG:vpn">NG via VPN</option>
          <option value="RO:residential">RO residential</option>
          <option value="DE:tor">DE Tor exit</option>
        </select>
      </span>
      <nav>
        <a href="/">Shop</a>
        <a href="/cart">Cart{n ? ` (${n})` : ""}</a>
        <a href="/account">Account</a>
        {process.env.NEXT_PUBLIC_MAILBOX_URL && <a href={process.env.NEXT_PUBLIC_MAILBOX_URL} target="_blank" rel="noreferrer">Inbox</a>}
        <a href="/outbox">Outbox</a>
        {authed ? <a href="/logout">Log out</a> : <a href="/login">Log in</a>}
      </nav>
    </header>
  );
}
