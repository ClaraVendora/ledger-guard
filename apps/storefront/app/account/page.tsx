"use client";
import { useEffect, useState } from "react";
import { Badge, Box, Button, Code, Field, Grid, GridItem, HStack, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { api, getToken, money, type Me } from "@/lib/api";
import { Card, PageTitle, H2, Notice, TextField, Primary } from "@/components/ui/bits";

export default function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [xfer, setXfer] = useState({ toEmail: "dana@example.com", kind: "credit", amount: 150 });
  const [gc, setGc] = useState({ amount: 50, cardFingerprint: "visa-4242" });
  const [addr, setAddr] = useState({ line1: "88 Freight Rd Unit 4", city: "Newark", zip: "07105" });
  const [code, setCode] = useState("GC-DANA-0001");

  const load = () => api<Me>("/me").then(setMe).catch(() => { location.href = "/login"; });
  useEffect(() => { if (!getToken()) location.href = "/login"; else load(); }, []);
  if (!me) return <Text color="gray.600">Loading…</Text>;

  const act = async (label: string, fn: () => Promise<any>) => {
    setMsg(null);
    try { const r = await fn(); setMsg({ kind: r?.decision === "block" ? "info" : "ok", text: `${label} done${r?.decision ? ` (risk engine: ${r.decision})` : ""}.` }); load(); }
    catch (e: any) { setMsg({ kind: "err", text: `${label} failed: ${e.message}` }); }
  };

  return (
    <>
      <PageTitle title={`Hi ${me.customer.name.split(" ")[0]}`} sub={<>{me.customer.email} · member since {new Date(me.customer.createdAt).toLocaleDateString()} · this device <Code size="sm">{me.deviceId}</Code></>} />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <Card>
        <Grid templateColumns="repeat(12, 1fr)" gap="4">
          <GridItem colSpan={{ base: 12, sm: 4 }}><Text fontSize="xs" color="gray.500">Points</Text><Text fontSize="2xl" fontWeight="semibold">{me.balances.points.toFixed(0)}</Text><Text fontSize="xs" color="gray.500">1 point = $1 at checkout</Text></GridItem>
          <GridItem colSpan={{ base: 12, sm: 4 }}><Text fontSize="xs" color="gray.500">Store credit</Text><Text fontSize="2xl" fontWeight="semibold">{money(me.balances.credit)}</Text></GridItem>
          <GridItem colSpan={{ base: 12, sm: 4 }}><Text fontSize="xs" color="gray.500">Gift cards</Text><Text fontSize="2xl" fontWeight="semibold">{money(me.balances.giftCards.reduce((a, g) => a + g.balance, 0))}</Text><Text fontSize="xs" color="gray.500">{me.balances.giftCards.map((g) => g.code).join(", ") || "none"}</Text></GridItem>
        </Grid>
      </Card>

      <Grid templateColumns="repeat(12, 1fr)" gap="6">
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <H2>Send points or credit</H2>
          <Card>
            <TextField label="To (email)" value={xfer.toEmail} onChange={(v) => setXfer({ ...xfer, toEmail: v })} />
            <Grid templateColumns="repeat(12, 1fr)" gap="3">
              <GridItem colSpan={6}><Field.Root mb="3"><Field.Label fontSize="sm" color="gray.600">What</Field.Label>
                <NativeSelect.Root><NativeSelect.Field bg="white" value={xfer.kind} onChange={(e) => setXfer({ ...xfer, kind: e.target.value })}><option value="credit">Store credit</option><option value="points">Points</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
              </Field.Root></GridItem>
              <GridItem colSpan={6}><TextField label="Amount" type="number" value={xfer.amount} onChange={(v) => setXfer({ ...xfer, amount: Number(v) })} /></GridItem>
            </Grid>
            <Primary size="sm" onClick={() => act("Transfer", () => api("/value/transfer", { method: "POST", body: JSON.stringify(xfer) }))}>Send</Primary>
          </Card>
          <H2>Gift cards</H2>
          <Card>
            <Grid templateColumns="repeat(12, 1fr)" gap="3">
              <GridItem colSpan={6}><TextField label="Buy, amount" type="number" value={gc.amount} onChange={(v) => setGc({ ...gc, amount: Number(v) })} /></GridItem>
              <GridItem colSpan={6}><TextField label="Card" value={gc.cardFingerprint} onChange={(v) => setGc({ ...gc, cardFingerprint: v })} /></GridItem>
            </Grid>
            <Primary size="sm" onClick={() => act("Gift card purchase", () => api("/giftcards/buy", { method: "POST", body: JSON.stringify(gc) }))}>Buy gift card</Primary>
            <Box mt="4">
              <TextField label="Check a balance" value={code} onChange={setCode} />
              <Button size="sm" variant="outline" onClick={() => act("Balance check", async () => { const r = await api<{ valid: boolean; balance?: number }>(`/giftcards/balance?code=${encodeURIComponent(code)}`); setMsg({ kind: r.valid ? "ok" : "err", text: r.valid ? `Balance ${money(r.balance!)}` : "No such card" }); return null; })}>Check</Button>
            </Box>
          </Card>
        </GridItem>
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <H2>Addresses</H2>
          <Card>
            <Stack gap="1" mb="3">
              {me.addresses.map((a) => <Text key={a.id}>{a.line1}, {a.city} {a.zip} <Code size="xs" variant="plain" color="gray.500">{a.id}</Code></Text>)}
            </Stack>
            <TextField label="Add a new address" value={addr.line1} onChange={(v) => setAddr({ ...addr, line1: v })} />
            <Grid templateColumns="repeat(12, 1fr)" gap="3">
              <GridItem colSpan={6}><TextField label="City" value={addr.city} onChange={(v) => setAddr({ ...addr, city: v })} /></GridItem>
              <GridItem colSpan={6}><TextField label="Zip" value={addr.zip} onChange={(v) => setAddr({ ...addr, zip: v })} /></GridItem>
            </Grid>
            <Button size="sm" variant="outline" onClick={() => act("Address", () => api("/addresses", { method: "POST", body: JSON.stringify(addr) }))}>Add address</Button>
          </Card>
          <H2>Recent orders</H2>
          <Card>
            {me.orders.length === 0 && <Text color="gray.600">No orders yet on this account.</Text>}
            <Stack gap="2">
              {me.orders.map((o) => (
                <HStack key={o.id} fontSize="sm" gap="3">
                  <Code size="xs">{o.id.slice(-6).toUpperCase()}</Code>
                  <Text color="gray.500">{new Date(o.createdAt).toLocaleDateString()}</Text>
                  <Text>{money(o.total)}</Text>
                  <Badge size="sm" colorPalette={o.status === "placed" ? "green" : o.status === "blocked" ? "red" : "blue"}>{o.status}</Badge>
                  <Box flex="1" />
                  {o.status === "placed" && <Button size="xs" variant="outline" onClick={() => act("Refund claim", () => api(`/orders/${o.id}/refund`, { method: "POST", body: JSON.stringify({ amount: Number((o.total * 0.6).toFixed(2)), reason: "item_not_received", destination: "credit" }) }))}>Claim missing item</Button>}
                </HStack>
              ))}
            </Stack>
          </Card>
        </GridItem>
      </Grid>
    </>
  );
}
