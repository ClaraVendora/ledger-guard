"use client";
import { useEffect } from "react";
import { api, setToken } from "@/lib/api";

export default function Logout() {
  useEffect(() => { api("/auth/logout", { method: "POST" }).catch(() => null).finally(() => { setToken(null); location.href = "/"; }); }, []);
  return <p className="sub">Logging out…</p>;
}
