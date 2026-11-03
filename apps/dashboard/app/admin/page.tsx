"use client";
import { useState } from "react";
import { Box, Button, Code, Heading, HStack, List, Text } from "@chakra-ui/react";
import { get, post, LG, MERCHANT, STORE } from "@/lib/api";
import { ActionBadge } from "@/components/ui/badges";

export default function Admin() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const say = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l].slice(0, 40));

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    say(`${label}…`);
    try { const r = await fn(); say(`${label}: ${typeof r === "string" ? r : JSON.stringify(r)}`); } catch (e) { say(`${label} failed: ${String(e)}`); }
    setBusy(false);
  };

  const H = ({ children }: { children: string }) => <Heading size="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mt="6" mb="2">{children}</Heading>;

  return (
    <>
      <Heading size="lg" mb="1">Demo control</Heading>
      <Text color="gray.500" mb="5">Reset state between rehearsals. The baseline replay runs from the terminal (<Code size="sm">pnpm data:replay -- --reset</Code>) because it streams tens of thousands of events.</Text>
      <Box borderWidth="1px" borderColor="gray.200" rounded="md" bg="white" p="4">
        <HStack gap="2" flexWrap="wrap">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Health", async () => ({ engine: await get("/health"), merchant: await get("/health", MERCHANT) }))}>Check health</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Reset merchant and seed demo accounts", () => post("/admin/reset", { seed: true, resetLedgerGuard: false }, MERCHANT))}>Reset merchant (keep baseline)</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Recompute store stats", () => post("/admin/recompute-stats", { store: STORE }))}>Recompute store p95s</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Reload rule pack", () => post("/admin/reload-rules", {}))}>Reload rules from YAML</Button>
          <Button size="sm" variant="outline" colorPalette="red" disabled={busy} onClick={() => { if (confirm("Wipe Ledger Guard history for this store? You will need to replay the baseline.")) run("Reset Ledger Guard", () => post("/admin/reset", { store: STORE })); }}>Reset Ledger Guard (wipe history)</Button>
        </HStack>
        <Text color="gray.500" fontSize="xs" mt="3">Engine {LG} · Merchant {MERCHANT} · Store {STORE}</Text>
      </Box>
      <H>Run script</H>
      <Box borderWidth="1px" borderColor="gray.200" rounded="md" bg="white" p="4">
        <List.Root as="ol" gap="2" pl="4">
          <List.Item>Reset merchant (keep baseline). Open the live feed in this window.</List.Item>
          <List.Item>Storefront, second window: log in as <Code size="sm">sam@example.com</Code>, buy cheese and bread with a few points. Feed shows <ActionBadge action="allow" />.</List.Item>
          <List.Item>Storefront, incognito: set the network picker to NG via VPN. Forgot password for <Code size="sm">dana@example.com</Code>. Open the Inbox, click the reset link, set a new password. Feed shows reset and new device.</List.Item>
          <List.Item>Still incognito, second tab: log in as <Code size="sm">jj.quick@example.com</Code>, transfer $150 credit to Dana. Feed shows <ActionBadge action="block" /> on the transfer.</List.Item>
          <List.Item>As Dana: add a new address, cart, load the wine order, pay with points and credit, leave about $20 on the card. Checkout returns the block screen.</List.Item>
          <List.Item>Here: open the alert, walk the rules and the timeline. Then Rules: raise <Code size="sm">redeem_after_reset</Code> stored-value share and watch the counts change.</List.Item>
        </List.Root>
      </Box>
      <H>Log</H>
      <Box as="pre" fontFamily="mono" fontSize="xs" bg="gray.50" borderWidth="1px" borderColor="gray.200" p="3" rounded="md" whiteSpace="pre-wrap" maxH="320px" overflow="auto">{log.join("\n") || "—"}</Box>
    </>
  );
}
