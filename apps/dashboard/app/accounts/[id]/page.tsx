"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Code, Grid, GridItem, Heading, Link, Stack, Table, Text } from "@chakra-ui/react";
import { get, STORE, fmtTime, money, type Decision, type TimelineEvent } from "@/lib/api";
import { ActionBadge } from "@/components/ui/badges";
import { Stat } from "@/components/Stat";
import { Timeline } from "@/components/Timeline";

type Account = { customerId: string; events: TimelineEvent[]; alerts: Decision[]; devices: { device_id: string; n: number; last_seen: string }[] };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box>
    <Heading size="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb="2">{title}</Heading>
    <Box borderWidth="1px" borderColor="gray.200" rounded="md" bg="white" overflow="hidden">{children}</Box>
  </Box>
);

export default function AccountView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<Account | null>(null);
  const router = useRouter();
  useEffect(() => { get<Account>(`/accounts/${id}?store=${STORE}`).then(setA); }, [id]);
  if (!a) return <Text color="gray.500">Loading…</Text>;

  const bal = { points: 0, credit: 0, giftCards: 0 };
  for (const e of [...a.events].reverse()) {
    const p = e.payload;
    if (e.type === "value.issue" && p.customerId === id) (bal as any)[p.kind] += p.amount;
    if (e.type === "value.load" && p.customerId === id && p.kind === "gift_card") bal.giftCards += p.amount;
    if (e.type === "value.transfer") { if (p.toCustomerId === id) (bal as any)[p.kind] += p.amount; else (bal as any)[p.kind] -= p.amount; }
    if (e.type === "order.created") for (const t of p.tenders ?? []) { if (t.kind === "gift_card") bal.giftCards -= t.amount; else if (t.kind !== "card") (bal as any)[t.kind] -= t.amount; }
  }
  const transfers = a.events.filter((e) => e.type === "value.transfer");
  const orders = a.events.filter((e) => e.type === "order.created");
  const openAlerts = a.alerts.filter((x) => !x.reviewStatus).length;

  return (
    <>
      <Heading size="lg" mb="1">Account <Code size="md">{id}</Code></Heading>
      <Text color="gray.500" mb="5">{orders.length} orders seen · {a.devices.length} devices · {a.alerts.length} alerts</Text>
      <Grid templateColumns="repeat(12, 1fr)" gap="3" mb="5">
        <GridItem colSpan={{ base: 6, md: 3 }}><Stat label="Points (seen)" value={bal.points.toFixed(0)} /></GridItem>
        <GridItem colSpan={{ base: 6, md: 3 }}><Stat label="Store credit (seen)" value={money(bal.credit)} /></GridItem>
        <GridItem colSpan={{ base: 6, md: 3 }}><Stat label="Gift cards (seen)" value={money(Math.max(0, bal.giftCards))} /></GridItem>
        <GridItem colSpan={{ base: 6, md: 3 }}><Stat label="Open alerts" value={openAlerts} color={openAlerts ? "block" : undefined} /></GridItem>
      </Grid>
      <Grid templateColumns="repeat(12, 1fr)" gap="4">
        <GridItem colSpan={{ base: 12, lg: 7 }}><Stack gap="4">
          <Section title="Devices">
            <Table.Root size="sm"><Table.Header><Table.Row><Table.ColumnHeader>Device</Table.ColumnHeader><Table.ColumnHeader>Events</Table.ColumnHeader><Table.ColumnHeader>Last seen</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>
              {a.devices.map((d) => <Table.Row key={d.device_id}><Table.Cell><Code size="sm">{d.device_id}</Code></Table.Cell><Table.Cell>{d.n}</Table.Cell><Table.Cell><Text fontFamily="mono" fontSize="xs" color="gray.500">{fmtTime(d.last_seen)}</Text></Table.Cell></Table.Row>)}
            </Table.Body></Table.Root>
          </Section>
          <Section title="Transfers">
            {transfers.length === 0 ? <Box p="6" color="gray.500" textAlign="center">None</Box> : (
              <Table.Root size="sm"><Table.Header><Table.Row><Table.ColumnHeader>Time</Table.ColumnHeader><Table.ColumnHeader>Direction</Table.ColumnHeader><Table.ColumnHeader>Amount</Table.ColumnHeader><Table.ColumnHeader>Counterparty</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>
                {transfers.map((e) => { const p = e.payload; const inbound = p.toCustomerId === id; const other = inbound ? p.customerId : p.toCustomerId; return (
                  <Table.Row key={e.id}><Table.Cell><Text fontFamily="mono" fontSize="xs" color="gray.500">{fmtTime(e.occurred_at)}</Text></Table.Cell><Table.Cell>{inbound ? "in" : "out"}</Table.Cell><Table.Cell>{money(p.amount)} {p.kind}</Table.Cell><Table.Cell><Link href={`/accounts/${other}`} fontFamily="mono" fontSize="sm" color="blue.600">{other}</Link></Table.Cell></Table.Row>
                ); })}
              </Table.Body></Table.Root>
            )}
          </Section>
          <Section title="Alerts">
            {a.alerts.length === 0 ? <Box p="6" color="gray.500" textAlign="center">None</Box> : (
              <Table.Root size="sm" interactive><Table.Body>
                {a.alerts.map((d) => <Table.Row key={d.id} cursor="pointer" onClick={() => router.push(`/alerts/${d.id}`)}><Table.Cell><Text fontFamily="mono" fontSize="xs" color="gray.500">{fmtTime(d.occurredAt)}</Text></Table.Cell><Table.Cell><ActionBadge action={d.action} /></Table.Cell><Table.Cell><Code size="sm">{d.eventType}</Code></Table.Cell><Table.Cell>{d.score}</Table.Cell></Table.Row>)}
              </Table.Body></Table.Root>
            )}
          </Section>
        </Stack></GridItem>
        <GridItem colSpan={{ base: 12, lg: 5 }}>
          <Section title="Recent activity">
            <Box p="4" maxH="760px" overflow="auto"><Timeline events={a.events.slice(0, 80)} /></Box>
          </Section>
        </GridItem>
      </Grid>
    </>
  );
}
