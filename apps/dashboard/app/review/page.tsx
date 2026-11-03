"use client";
import { useEffect, useState } from "react";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { get, post, STORE, type Decision } from "@/lib/api";
import { DecisionTable } from "@/components/DecisionTable";

export default function ReviewQueue() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [status, setStatus] = useState<"open" | "reviewed" | "all">("open");

  const load = async () => setRows(await get<Decision[]>(`/alerts?store=${STORE}&limit=200&status=${status}`));
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (id: string, s: "true_positive" | "false_positive") => { await post(`/alerts/${id}/review`, { status: s }); load(); };

  return (
    <>
      <HStack mb="1">
        <Heading size="lg">Review queue</Heading>
        <Box flex="1" />
        <HStack gap="2">
          {(["open", "reviewed", "all"] as const).map((f) => (
            <Button key={f} size="sm" variant={status === f ? "solid" : "outline"} colorPalette="gray" onClick={() => setStatus(f)}>{f}</Button>
          ))}
        </HStack>
      </HStack>
      <Text color="gray.500" mb="5">Blocked and review decisions. Mark each one fraud or legitimate; the rules screen uses these to show precision.</Text>
      <Box borderWidth="1px" borderColor="gray.200" rounded="md" bg="white" overflow="hidden">
        <DecisionTable rows={rows} showReview onReview={review} />
      </Box>
    </>
  );
}
