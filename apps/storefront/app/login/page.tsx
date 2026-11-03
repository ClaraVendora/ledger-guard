"use client";
import { useState } from "react";
import { api, setToken } from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("dana@example.com");
  const [password, setPassword] = useState("password123");
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setToken(r.token);
      location.href = "/account";
    } catch (ex: any) { setErr(ex.message); }
  };
  return (
    <div className="form">
      <h1>Log in</h1>
      <p className="sub">Demo accounts: dana@example.com, jj.quick@example.com, sam@example.com. Password: password123.</p>
      <form onSubmit={submit}>
        <label className="field">Email<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <div className="alert err" style={{ marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn">Log in</button>
          <a className="small" href="/forgot">Forgot password?</a>
        </div>
      </form>
    </div>
  );
}
