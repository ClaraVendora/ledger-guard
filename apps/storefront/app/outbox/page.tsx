"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Mail = { id: string; to: string; subject: string; body: string; link: string | null; delivered: boolean; error: string | null; createdAt: string };

export default function Outbox() {
  const [mails, setMails] = useState<Mail[]>([]);
  useEffect(() => { const load = () => api<Mail[]>("/outbox").then(setMails).catch(() => null); load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, []);
  return (
    <>
      <h1>Outbox</h1>
      <p className="sub">Every email the store sent. Demo safety net: the reset link works from here even if the inbox is slow.</p>
      {mails.map((m) => (
        <div key={m.id} className="card" style={{ marginBottom: 12 }}>
          <div className="small">{new Date(m.createdAt).toLocaleString()} · to {m.to} · {m.delivered ? <span className="pill">delivered</span> : <span className="pill">not sent{m.error ? `: ${m.error}` : ""}</span>}</div>
          <div style={{ fontWeight: 600, margin: "6px 0" }}>{m.subject}</div>
          <div>{m.body.replace(m.link ?? "", "")}</div>
          {m.link && <a className="btn secondary" style={{ display: "inline-block", marginTop: 8 }} href={m.link.replace(/^https?:\/\/[^/]+/, "")}>Open reset link</a>}
        </div>
      ))}
    </>
  );
}
