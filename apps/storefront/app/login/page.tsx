"use client";
import { useState } from "react";
import { Box, Button, HStack, Link } from "@chakra-ui/react";
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
    <Box maxW="420px">
      <PageTitle title="Log in" sub="Demo accounts: dana@example.com, jj.quick@example.com, sam@example.com. Password: password123." />
      <form onSubmit={submit}>
        <TextField label="Email" value={email} onChange={setEmail} />
        <TextField label="Password" type="password" value={password} onChange={setPassword} />
        {err && <Notice kind="err">{err}</Notice>}
        <HStack gap="4">
          <Button type="submit" bg="brand.500" color="white" _hover={{ bg: "brand.600" }}>Log in</Button>
          <Link href="/forgot" fontSize="sm" fontFamily="system-ui, sans-serif" color="gray.600">Forgot password?</Link>
        </HStack>
      </form>
    </Box>
  );
}
