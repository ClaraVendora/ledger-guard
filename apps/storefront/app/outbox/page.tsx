"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Stack, Text } from "@chakra-ui/react";
import { api } from "@/lib/api";
import { Card, PageTitle } from "@/components/ui/bits";

type Mail = { id: string; to: string; subject: string; body: string; link: string | null; delivered: boolean; error: string | null; createdAt: string };

export default function Outbox() {
  const [mails, setMails] = useState<Mail[]>([]);
  useEffect(() => { const load = () => api<Mail[]>("/outbox").then(setMails).catch(() => null); load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, []);
  return (
    <>
      <PageTitle title="Outbox" sub="Every email the store sent. Demo safety net: the reset link works from here even if the inbox is slow." />
      <Stack gap="3">
        {mails.map((m) => (
          <Card key={m.id}>
            <Text fontFamily="system-ui, sans-serif" fontSize="xs" color="gray.500">{new Date(m.createdAt).toLocaleString()} · to {m.to} · <Badge size="sm" colorPalette={m.delivered ? "green" : "orange"}>{m.delivered ? "delivered" : `not sent${m.error ? `: ${m.error}` : ""}`}</Badge></Text>
            <Text fontWeight="semibold" my="1">{m.subject}</Text>
            <Text>{m.body.replace(m.link ?? "", "")}</Text>
            {m.link && <Button asChild size="sm" variant="outline" mt="2"><a href={m.link.replace(/^https?:\/\/[^/]+/, "")}>Open reset link</a></Button>}
          </Card>
        ))}
      </Stack>
    </>
  );
}
