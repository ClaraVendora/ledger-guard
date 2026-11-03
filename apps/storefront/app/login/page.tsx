"use client";
import { useState } from "react";
import { Button, Grid, GridItem, HStack, Link } from "@chakra-ui/react";
import { api, setToken } from "@/lib/api";
import { PageTitle, Notice, TextField } from "@/components/ui/bits";

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
    <Grid templateColumns="repeat(12, 1fr)"><GridItem colSpan={{ base: 12, md: 5 }}>
      <PageTitle title="Log in" sub="Demo accounts: dana@example.com, jj.quick@example.com, sam@example.com. Password: password123." />
      <form onSubmit={submit}>
        <TextField label="Email" value={email} onChange={setEmail} />
        <TextField label="Password" type="password" value={password} onChange={setPassword} />
        {err && <Notice kind="err">{err}</Notice>}
        <HStack gap="4">
          <Button type="submit" colorPalette="gray" variant="solid">Log in</Button>
          <Link href="/forgot" fontSize="sm" color="blue.600">Forgot password?</Link>
        </HStack>
      </form>
    </GridItem></Grid>
  );
}
