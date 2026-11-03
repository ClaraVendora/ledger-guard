"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, setToken } from "@/lib/api";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("hijacked1");
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ token: string }>("/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      setToken(r.token);
      location.href = "/account";
    } catch (ex: any) { setErr(ex.message); }
  };
  return (
    <form onSubmit={submit} className="form">
      <label className="field">New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {err && <div className="alert err" style={{ marginBottom: 12 }}>{err}</div>}
      <button className="btn">Set password and log in</button>
    </form>
  );
}

export default function Reset() {
  return (
    <>
      <h1>Choose a new password</h1>
      <p className="sub">You will be logged in on this device afterwards.</p>
      <Suspense><ResetForm /></Suspense>
    </>
  );
}
