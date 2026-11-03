"use client";
import { useEffect, useState } from "react";
import { Box, Code, Heading, HStack, Input, SimpleGrid, Slider, Stack, Switch, Text } from "@chakra-ui/react";
import { get, put, STORE, type Rule } from "@/lib/api";
import { SeverityBadge, GroupBadge } from "@/components/ui/badges";
import { Stat } from "@/components/Stat";

type RulesResp = { version: number; thresholds: { block_score: number; review_score: number }; stats: Record<string, number>; rules: Rule[] };
type Sim = { total: number; tally: { allow: number; review: number; block: number }; perRule: Record<string, number> };
const OPS: Record<string, string> = { gte: "≥", lte: "≤", gt: ">", lt: "<", eq: "=", neq: "≠", in: "in" };

export default function Rules() {
  const [data, setData] = useState<RulesResp | null>(null);
  const [sim, setSim] = useState<Sim | null>(null);
  const [base, setBase] = useState<Sim | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setData(await get<RulesResp>(`/rules?store=${STORE}`));
    const s = await get<Sim>(`/rules/simulate?store=${STORE}`);
    setSim(s);
    setBase((b) => b ?? s);
  };
  useEffect(() => { load(); }, []);

  const change = async (ruleId: string, patch: { enabled?: boolean; thresholds?: Record<string, unknown> }) => {
    setBusy(true);
    await put(`/rules/${ruleId}`, { store: STORE, ...patch });
    await load();
    setBusy(false);
  };

  if (!data || !sim) return <Text color="fg.muted">Loading…</Text>;
  const delta = (k: "allow" | "review" | "block") => (base ? sim.tally[k] - base.tally[k] : 0);
  const d = (n: number) => (n ? <Text as="span" fontSize="sm" color="fg.muted" ml="2">{n > 0 ? `+${n}` : n}</Text> : null);

  return (
    <>
      <Heading size="lg" mb="1">Rules</Heading>
      <Text color="fg.muted" mb="5">Pack v{data.version}. Block at {data.thresholds.block_score} or any critical, review at {data.thresholds.review_score}. Move a threshold and the counts below re-score the store's whole history without replaying it.</Text>
      <SimpleGrid columns={4} gap="3" mb="5">
        <Stat label="Events scored" value={sim.total} />
        <Stat label="Would block" value={<>{sim.tally.block}{d(delta("block"))}</>} color="block" />
        <Stat label="Would review" value={<>{sim.tally.review}{d(delta("review"))}</>} color="review" />
        <Stat label="Store p95s" value={<Text fontFamily="mono" fontSize="xs" lineHeight="1.6">refund ratio {Number(data.stats.refund_value_ratio_90d_p95 ?? 0).toFixed(3)}<br />refund count {data.stats.refunds_90d_count_p95 ?? "-"}<br />stored-value share {Number(data.stats.stored_value_share_p95 ?? 0).toFixed(2)}</Text>} />
      </SimpleGrid>
      <Box borderWidth="1px" rounded="lg" bg="bg.panel">
        {data.rules.map((r, i) => (
          <SimpleGrid key={r.id} columns={{ base: 1, lg: 4 }} gap="4" p="4" borderTopWidth={i ? "1px" : 0} opacity={r.enabled ? 1 : 0.45}>
            <Stack gap="2" gridColumn={{ lg: "span 3" }}>
              <HStack gap="2" flexWrap="wrap">
                <Switch.Root size="sm" checked={r.enabled} disabled={busy} onCheckedChange={(e) => change(r.id, { enabled: e.checked })}><Switch.HiddenInput /><Switch.Control /></Switch.Root>
                <GroupBadge group={r.group} />
                <Code size="sm" fontWeight="semibold">{r.id}</Code>
                <SeverityBadge severity={r.severity} />
                <Text color="fg.muted" fontSize="sm">+{r.weight}</Text>
                <Text color="fg.muted" fontSize="xs" fontFamily="mono">on {r.applies_to.join(", ")}</Text>
              </HStack>
              <Text color="fg.muted" fontSize="sm">{r.explanation}</Text>
              {r.when.map((c, j) => <Cond key={`w${j}`} c={c} k={`when.${j}`} rule={r} busy={busy} onChange={change} />)}
              {r.any && <Text color="fg.muted" fontSize="xs">and any of:</Text>}
              {r.any?.map((c, j) => <Cond key={`a${j}`} c={c} k={`any.${j}`} rule={r} busy={busy} onChange={change} />)}
            </Stack>
            <Box textAlign={{ lg: "right" }}>
              <Text color="fg.muted" fontSize="xs">fired in history</Text>
              <Text fontSize="2xl" fontWeight="semibold">{sim.perRule[r.id] ?? 0}</Text>
              {base && (sim.perRule[r.id] ?? 0) !== (base.perRule[r.id] ?? 0) && <Text color="fg.muted" fontSize="sm">was {base.perRule[r.id] ?? 0}</Text>}
            </Box>
          </SimpleGrid>
        ))}
      </Box>
    </>
  );
}

function Cond({ c, k, rule, busy, onChange }: { c: { feature: string; op: string; value: unknown }; k: string; rule: Rule; busy: boolean; onChange: (id: string, p: { thresholds: Record<string, unknown> }) => void }) {
  const numeric = typeof c.value === "number";
  const [v, setV] = useState<number>(numeric ? (c.value as number) : 0);
  useEffect(() => { if (numeric) setV(c.value as number); }, [c.value, numeric]);
  const max = v <= 1 ? 1 : v <= 24 ? 48 : v <= 100 ? 200 : v * 2;
  const step = v <= 1 ? 0.05 : 1;
  return (
    <HStack gap="3" fontSize="sm">
      <Code size="sm" variant="plain">{c.feature}</Code>
      <Text color="fg.muted">{OPS[c.op] ?? c.op}</Text>
      {numeric ? (
        <>
          <Slider.Root width="160px" size="sm" min={0} max={max} step={step} value={[v]} disabled={busy} onValueChange={(e) => setV(e.value[0])} onValueChangeEnd={(e) => onChange(rule.id, { thresholds: { [k]: e.value[0] } })} colorPalette="teal">
            <Slider.Control><Slider.Track><Slider.Range /></Slider.Track><Slider.Thumbs /></Slider.Control>
          </Slider.Root>
          <Input size="xs" type="number" width="80px" value={v} step={step} disabled={busy} onChange={(e) => setV(Number(e.target.value))} onBlur={() => onChange(rule.id, { thresholds: { [k]: v } })} />
        </>
      ) : (
        <Code size="sm">{Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}</Code>
      )}
      {rule.overrides[k] !== undefined && <Text color="fg.muted" fontSize="xs">edited</Text>}
    </HStack>
  );
}
