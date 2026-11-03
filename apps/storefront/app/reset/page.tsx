"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Grid, GridItem } from "@chakra-ui/react";
import { api, setToken } from "@/lib/api";
import { PageTitle, Notice, TextField } from "@/components/ui/bits";

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
    <form onSubmit={submit}>
      <TextField label="New password" type="password" value={password} onChange={setPassword} />
      {err && <Notice kind="err">{err}</Notice>}
      <Button type="submit" colorPalette="gray" variant="solid">Set password and log in</Button>
    </form>
  );
}

export default function Reset() {
  return (
    <Grid templateColumns="repeat(12, 1fr)"><GridItem colSpan={{ base: 12, md: 5 }}>
      <PageTitle title="Choose a new password" sub="You will be logged in on this device afterwards." />
      <Suspense><ResetForm /></Suspense>
    </GridItem></Grid>
  );
}
