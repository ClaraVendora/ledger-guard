"use client";
import { useEffect, useMemo, useState } from "react";
import { Box, Button, Checkbox, Field, Grid, GridItem, Heading, HStack, Link, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { api, getCart, setCart, getToken, money, type Product, type Me } from "@/lib/api";
import { Card, PageTitle, Notice, TextField } from "@/components/ui/bits";

type Blocked = { status: "blocked"; orderId: string; message: string; reasonCode: string };
type Placed = { status: "placed" | "review"; orderId: string; total: number; tenders: any[]; paymentIntent: any };

const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <HStack justify="space-between" py="2" borderBottomWidth={bold ? 0 : "1px"} borderColor="gray.200" fontSize={bold ? "md" : "sm"} fontWeight={bold ? "semibold" : undefined}><Text>{k}</Text><Text>{v}</Text></HStack>
);

export default function Checkout() {
  const [products, setProducts] = useState<Product[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [addressId, setAddressId] = useState("");
  const [usePoints, setUsePoints] = useState(0);
  const [useCredit, setUseCredit] = useState(0);
  const [useGc, setUseGc] = useState<string[]>([]);
  const [avs, setAvs] = useState<"pass" | "fail">("pass");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blocked | Placed | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { location.href = "/login"; return; }
    api<Product[]>("/products").then(setProducts);
    api<Me>("/me").then((m) => {
      setMe(m);
      setAddressId(m.addresses.at(-1)?.id ?? "");
      setUsePoints(Math.floor(m.balances.points));
      setUseCredit(Math.floor(m.balances.credit));
      setUseGc([]); // gift cards off by default so a card leg is visible unless the shopper ticks one
    });
  }, []);

  const cart = useMemo(() => getCart(), []);
  const total = cart.reduce((a, i) => a + (products.find((p) => p.sku === i.sku)?.price ?? 0) * i.qty, 0);
  const split = useMemo(() => {
    let rem = total;
    const pts = Math.min(usePoints, me?.balances.points ?? 0, rem); rem -= pts;
    const cr = Math.min(useCredit, me?.balances.credit ?? 0, rem); rem -= cr;
    let gc = 0;
    for (const g of me?.balances.giftCards ?? []) if (useGc.includes(g.code)) { const u = Math.min(g.balance, rem); gc += u; rem -= u; }
    return { pts, cr, gc, card: Math.max(0, Number(rem.toFixed(2))) };
  }, [total, usePoints, useCredit, useGc, me]);

  const pay = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<Placed>("/checkout", { method: "POST", body: JSON.stringify({ items: cart, shippingAddressId: addressId, usePoints, useCredit, giftCardCodes: useGc, cardFingerprint: "visa-4242", avs }) });
      setResult(r); setCart([]);
    } catch (e: any) {
      if (e.status === 402) setResult(e.body as Blocked); else setErr(e.message);
    }
    setBusy(false);
  };

  if (!me) return <Text color="gray.600">Loading…</Text>;

  if (result?.status === "blocked") return (
    <Card textAlign="center" py="12">
      <Box display="inline-flex" alignItems="center" justifyContent="center" w="56px" h="56px" rounded="full" bg="red.50" color="red.600" borderWidth="1px" borderColor="red.200" fontSize="2xl" mb="3">!</Box>
      <Heading size="2xl" mb="2">We couldn't complete your order</Heading>
      <Text color="gray.600" maxW="440px" mx="auto" mb="3">{result.message}</Text>
      <Text fontSize="xs" color="gray.500" mb="4">Nothing has been charged and no stored value has been used.</Text>
      <Button asChild variant="outline" size="sm"><a href="/account">Back to account</a></Button>
    </Card>
  );
  if (result) return (
    <Card textAlign="center" py="12">
      <Box display="inline-flex" alignItems="center" justifyContent="center" w="56px" h="56px" rounded="full" bg="green.50" color="green.700" borderWidth="1px" borderColor="green.200" fontSize="2xl" mb="3">✓</Box>
      <Heading size="2xl" mb="2">{result.status === "review" ? "Order received, we're just checking a detail" : "Order placed"}</Heading>
      <Text color="gray.600" mb="4">Order {result.orderId.slice(-6).toUpperCase()} · {money(result.total)}{result.paymentIntent ? ` · card ${result.paymentIntent.fake ? "(simulated)" : result.paymentIntent.status}` : " · no card charge"}</Text>
      <Button asChild variant="outline" size="sm"><a href="/account">Back to account</a></Button>
    </Card>
  );

  const label = (t: string) => <Field.Label fontSize="sm" color="gray.600">{t}</Field.Label>;

  return (
    <>
      <PageTitle title="Checkout" sub={`${cart.reduce((a, i) => a + i.qty, 0)} items · ${money(total)}`} />
      <Grid templateColumns="repeat(12, 1fr)" gap="6" alignItems="start">
        <GridItem colSpan={{ base: 12, md: 7 }}><Card>
          <Stack gap="1">
            <Field.Root mb="1">{label("Deliver to")}
              <NativeSelect.Root><NativeSelect.Field bg="white" value={addressId} onChange={(e) => setAddressId(e.target.value)}>{me.addresses.map((a) => <option key={a.id} value={a.id}>{a.line1}, {a.city} {a.zip}</option>)}</NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
            </Field.Root>
            <Text fontSize="xs" color="gray.500" mb="3">Need a new address? Add it on your <Link href="/account" color="blue.600">account</Link> page.</Text>
            <TextField label={`Use points (have ${me.balances.points.toFixed(0)})`} type="number" value={usePoints} onChange={(v) => setUsePoints(Number(v))} />
            <TextField label={`Use store credit (have ${money(me.balances.credit)})`} type="number" value={useCredit} onChange={(v) => setUseCredit(Number(v))} />
            <Field.Root mb="3">{label("Gift cards")}
              <Stack gap="1">
                {me.balances.giftCards.map((g) => (
                  <Checkbox.Root key={g.code} size="sm" checked={useGc.includes(g.code)} onCheckedChange={(e) => setUseGc(e.checked ? [...useGc, g.code] : useGc.filter((c) => c !== g.code))}>
                    <Checkbox.HiddenInput /><Checkbox.Control /><Checkbox.Label>{g.code} ({money(g.balance)})</Checkbox.Label>
                  </Checkbox.Root>
                ))}
                {me.balances.giftCards.length === 0 && <Text fontSize="sm" color="gray.500">none on this account</Text>}
              </Stack>
            </Field.Root>
            <Field.Root>{label("Card on file: Visa ····4242")}
              <NativeSelect.Root><NativeSelect.Field bg="white" value={avs} onChange={(e) => setAvs(e.target.value as any)}><option value="pass">billing address matches</option><option value="fail">billing address mismatch (simulate AVS fail)</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
            </Field.Root>
          </Stack>
        </Card></GridItem>
        <GridItem colSpan={{ base: 12, md: 5 }}><Card>
          <Row k="Points" v={money(split.pts)} />
          <Row k="Store credit" v={money(split.cr)} />
          <Row k="Gift cards" v={money(split.gc)} />
          <Row k="Card" v={money(split.card)} />
          <Row k="Total" v={money(total)} bold />
          {err && <Notice kind="err">{err}</Notice>}
          <Button width="100%" mt="3" colorPalette="gray" variant="solid" disabled={busy || !cart.length || !addressId} onClick={pay}>{busy ? "Checking…" : `Pay ${money(total)}`}</Button>
          <Text fontSize="xs" color="gray.500" mt="2">Stored value is applied first; the card covers the rest.</Text>
        </Card></GridItem>
      </Grid>
    </>
  );
}
