"use client";
import { useState } from "react";
import { Box, Button, Link } from "@chakra-ui/react";
import { api } from "@/lib/api";
import { PageTitle, Notice, TextField } from "@/components/ui/bits";

export default function Forgot() {
  const [email, setEmail] = useState("dana@example.com");
  const [done, setDone] = useState<{ delivered: boolean } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone(await api<{ delivered: boolean }>("/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }));
  };
  const mailbox = process.env.NEXT_PUBLIC_MAILBOX_URL;
  return (
    <Box maxW="420px">
      <PageTitle title="Forgot your password?" sub="We will email you a link to set a new one." />
      {done ? (
        <Notice kind="ok">
          If that address exists, a reset link is on its way.
          {done.delivered && mailbox && <> Open the <Link href={mailbox} target="_blank" rel="noreferrer" textDecoration="underline">inbox</Link>.</>}
          {!done.delivered && <> Email delivery is not configured here; the link is in the <Link href="/outbox" textDecoration="underline">outbox</Link>.</>}
        </Notice>
      ) : (
        <form onSubmit={submit}>
          <TextField label="Email" value={email} onChange={setEmail} />
          <Button type="submit" bg="brand.500" color="white" _hover={{ bg: "brand.600" }}>Send reset link</Button>
        </form>
      )}
    </Box>
  );
}
