"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Button, Grid, GridItem, Heading, HStack, Text } from "@chakra-ui/react";
import { get, STORE, type Decision } from "@/lib/api";
import { DecisionTable } from "@/components/DecisionTable";
import { Stat } from "@/components/Stat";

export default function LiveFeed() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [filter, setFilter] = useState<"all" | "review" | "block">("all");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const q = filter === "all" ? "" : `&action=${filter}`;
        const data = await get<Decision[]>(`/decisions?store=${STORE}&limit=60${q}`);
        if (!alive) return;
        const fresh = new Set<string>();
        for (const d of data) if (!seen.current.has(d.id)) { fresh.add(d.id); seen.current.add(d.id); }
        setRows(data);
        if (fresh.size && rows.length) setNewIds(fresh);
      } catch {}
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const counts = { block: rows.filter((r) => r.action === "block").length, review: rows.filter((r) => r.action === "review").length, allow: rows.filter((r) => r.action === "allow").length };

  return (
    <>
      <HStack mb="1">
        <Heading size="lg">Live feed</Heading>
        <Box w="8px" h="8px" rounded="full" bg="allow" ml="2" boxShadow="0 0 0 4px var(--chakra-colors-green-100)" />
        <Text color="gray.500" fontSize="sm">polling every 2s</Text>
        <Box flex="1" />
        <HStack gap="2">
          {(["all", "review", "block"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "solid" : "outline"} colorPalette="gray" onClick={() => setFilter(f)}>{f}</Button>
          ))}
        </HStack>
      </HStack>
      <Text color="gray.500" mb="5">Every event the store sends, with Ledger Guard's decision. Click a row for the evidence.</Text>
      <Grid templateColumns="repeat(12, 1fr)" gap="3" mb="5">
        <GridItem colSpan={{ base: 6, md: 3 }}><Stat label="Last 60 events" value={rows.length} /></GridItem>
        <GridItem colSpan={{ base: 6, md: 3 }}><Stat label="Blocked" value={counts.block} color="block" /></GridItem>
        <GridItem colSpan={{ base: 6, md: 3 }}><Stat label="For review" value={counts.review} color="review" /></GridItem>
        <GridItem colSpan={{ base: 6, md: 3 }}><Stat label="Allowed" value={counts.allow} color="allow" /></GridItem>
      </Grid>
      <Box borderWidth="1px" borderColor="gray.200" rounded="md" bg="white" overflow="hidden">
        <DecisionTable rows={rows} newIds={newIds} />
      </Box>
    </>
  );
}
