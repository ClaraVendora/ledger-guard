"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Button } from "@chakra-ui/react";
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
      <Button type="submit" bg="brand.500" color="white" _hover={{ bg: "brand.600" }}>Set password and log in</Button>
    </form>
  );
}

export default function Reset() {
  return (
    <Box maxW="420px">
      <PageTitle title="Choose a new password" sub="You will be logged in on this device afterwards." />
      <Suspense><ResetForm /></Suspense>
    </Box>
  );
}
