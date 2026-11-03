"use client";
import { useEffect, useState } from "react";
import { get, post, STORE, type Decision } from "@/lib/api";
import { DecisionTable } from "@/components/DecisionTable";

export default function ReviewQueue() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [status, setStatus] = useState<"open" | "reviewed" | "all">("open");

  const load = async () => setRows(await get<Decision[]>(`/alerts?store=${STORE}&limit=200&status=${status}`));
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (id: string, s: "true_positive" | "false_positive") => { await post(`/alerts/${id}/review`, { status: s }); load(); };

  return (
    <>
      <div className="flex">
        <h1>Review queue</h1>
        <div className="sp" />
        <div className="filters">
          {(["open", "reviewed", "all"] as const).map((f) => (
            <button key={f} className={`btn ${status === f ? "primary" : ""}`} onClick={() => setStatus(f)}>{f}</button>
          ))}
        </div>
      </div>
      <p className="sub">Blocked and review decisions. Mark each one fraud or legitimate; the rules screen uses these to show precision.</p>
      <div className="panel">
        <DecisionTable rows={rows} showReview onReview={review} />
      </div>
    </>
  );
}
