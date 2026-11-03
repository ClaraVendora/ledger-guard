"use client";
import { useRouter } from "next/navigation";
import { Box, Button, Code, HStack, Table, Text } from "@chakra-ui/react";
import type { Decision } from "@/lib/api";
import { fmtTime } from "@/lib/api";
import { ActionBadge } from "@/components/ui/badges";

export function DecisionTable({ rows, newIds, showReview = false, onReview }: { rows: Decision[]; newIds?: Set<string>; showReview?: boolean; onReview?: (id: string, status: "true_positive" | "false_positive") => void }) {
  const router = useRouter();
  if (!rows.length) return <Box p="8" textAlign="center" color="gray.500">Nothing yet.</Box>;
  return (
    <Table.Root size="sm" interactive>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Time</Table.ColumnHeader>
          <Table.ColumnHeader>Decision</Table.ColumnHeader>
          <Table.ColumnHeader>Event</Table.ColumnHeader>
          <Table.ColumnHeader>Customer</Table.ColumnHeader>
          <Table.ColumnHeader>Score</Table.ColumnHeader>
          <Table.ColumnHeader>Rules</Table.ColumnHeader>
          {showReview && <Table.ColumnHeader />}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((d) => (
          <Table.Row key={d.id} cursor="pointer" onClick={() => router.push(`/alerts/${d.id}`)} bg={newIds?.has(d.id) ? "blue.50" : undefined} transition="background 1.2s">
            <Table.Cell><Text fontFamily="mono" fontSize="xs" color="gray.500">{fmtTime(d.occurredAt)}</Text></Table.Cell>
            <Table.Cell><ActionBadge action={d.action} /></Table.Cell>
            <Table.Cell><Code size="sm">{d.eventType}</Code></Table.Cell>
            <Table.Cell><Code size="sm" variant="plain">{d.customerId ?? ""}</Code></Table.Cell>
            <Table.Cell>{d.score}</Table.Cell>
            <Table.Cell>
              <HStack gap="1" flexWrap="wrap">
                {d.firedRules.map((r) => <Code key={r.ruleId} size="xs">{r.ruleId}</Code>)}
              </HStack>
            </Table.Cell>
            {showReview && (
              <Table.Cell onClick={(e) => e.stopPropagation()}>
                {d.reviewStatus ? (
                  <Text color="gray.500" fontSize="sm">{d.reviewStatus.replace("_", " ")}</Text>
                ) : (
                  <HStack gap="2">
                    <Button size="xs" variant="outline" onClick={() => onReview?.(d.id, "true_positive")}>Fraud</Button>
                    <Button size="xs" variant="outline" onClick={() => onReview?.(d.id, "false_positive")}>Legit</Button>
                  </HStack>
                )}
              </Table.Cell>
            )}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
