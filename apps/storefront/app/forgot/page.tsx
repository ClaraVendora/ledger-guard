"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Forgot() {
  const [email, setEmail] = useState("dana@example.com");
  const [done, setDone] = useState<{ delivered: boolean } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone(await api<{ delivered: boolean }>("/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }));
  };
  return (
    <div className="form">
      <h1>Forgot your password?</h1>
      <p className="sub">We will email you a link to set a new one.</p>
      {done ? (
        <div className="alert ok">If that address exists, a reset link is on its way.{done.delivered && process.env.NEXT_PUBLIC_MAILBOX_URL && <> Open the <a href={process.env.NEXT_PUBLIC_MAILBOX_URL} target="_blank" rel="noreferrer"><u>inbox</u></a>.</>}{!done.delivered && <> Email delivery is not configured here; the link is in the <a href="/outbox"><u>outbox</u></a>.</>}</div>
      ) : (
        <form onSubmit={submit}>
          <label className="field">Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn">Send reset link</button>
        </form>
      )}
    </div>
  );
}
