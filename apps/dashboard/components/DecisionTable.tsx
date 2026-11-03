"use client";
import { useRouter } from "next/navigation";
import type { Decision } from "@/lib/api";
import { fmtTime } from "@/lib/api";

export function DecisionTable({ rows, newIds, showReview = false, onReview }: { rows: Decision[]; newIds?: Set<string>; showReview?: boolean; onReview?: (id: string, status: "true_positive" | "false_positive") => void }) {
  const router = useRouter();
  if (!rows.length) return <div className="empty">Nothing yet.</div>;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Decision</th>
          <th>Event</th>
          <th>Customer</th>
          <th>Score</th>
          <th>Rules</th>
          {showReview && <th></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id} className={`row ${newIds?.has(d.id) ? "newrow" : ""}`} onClick={() => router.push(`/alerts/${d.id}`)}>
            <td className="mono muted">{fmtTime(d.occurredAt)}</td>
            <td><span className={`badge ${d.action}`}>{d.action}</span></td>
            <td className="mono">{d.eventType}</td>
            <td className="mono">{d.customerId ?? ""}</td>
            <td>{d.score}</td>
            <td>
              {d.firedRules.map((r) => (
                <span key={r.ruleId} className="pill" style={{ marginRight: 4 }}>{r.ruleId}</span>
              ))}
            </td>
            {showReview && (
              <td onClick={(e) => e.stopPropagation()}>
                {d.reviewStatus ? (
                  <span className="muted">{d.reviewStatus.replace("_", " ")}</span>
                ) : (
                  <div className="row-actions">
                    <button className="btn" onClick={() => onReview?.(d.id, "true_positive")}>Fraud</button>
                    <button className="btn" onClick={() => onReview?.(d.id, "false_positive")}>Legit</button>
                  </div>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
