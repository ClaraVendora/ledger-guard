"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Accounts() {
  const [id, setId] = useState("cus_dana");
  const router = useRouter();
  return (
    <>
      <h1>Accounts</h1>
      <p className="sub">Open a customer's stored-value activity and risk history. Demo accounts: cus_dana (victim), cus_mule (mule), cus_sam (control).</p>
      <form className="flex" onSubmit={(e) => { e.preventDefault(); router.push(`/accounts/${id}`); }}>
        <input className="btn mono" style={{ width: 280 }} value={id} onChange={(e) => setId(e.target.value)} placeholder="customer id" />
        <button className="btn primary">Open</button>
      </form>
    </>
  );
}
