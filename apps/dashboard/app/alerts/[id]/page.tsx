"use client";
import { use, useEffect, useState } from "react";
import { Box, Button, Code, DataList, Grid, GridItem, Heading, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { get, post, fmtTime, fmtNum, type Decision, type TimelineEvent } from "@/lib/api";
import { ActionBadge, SeverityBadge, GroupBadge } from "@/components/ui/badges";
import { Timeline } from "@/components/Timeline";

type Alert = Decision & { timeline: TimelineEvent[] };

export default function AlertDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<Alert | null>(null);
  const load = async () => setA(await get<Alert>(`/alerts/${id}`));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return <Text color="gray.500">Loading…</Text>;

  const review = async (s: "true_positive" | "false_positive") => { await post(`/alerts/${id}/review`, { status: s }); load(); };
  const focusDevice = a.timeline.at(-1)?.payload.deviceId as string | undefined;

  return (
    <>
      <HStack mb="1" flexWrap="wrap">
        <ActionBadge action={a.action} />
        <Heading size="lg">{a.eventType}</Heading>
        <Code size="sm" variant="plain" color="gray.500">{a.id}</Code>
        <Box flex="1" />
        {a.reviewStatus ? <Text color="gray.500">Marked {a.reviewStatus.replace("_", " ")}</Text> : (
          <HStack gap="2">
            <Button size="sm" colorPalette="red" variant="outline" onClick={() => review("true_positive")}>Confirm fraud</Button>
            <Button size="sm" variant="outline" onClick={() => review("false_positive")}>Legitimate</Button>
          </HStack>
        )}
      </HStack>
      <HStack color="gray.500" mb="5" gap="2" fontSize="sm">
        <Text>{fmtTime(a.occurredAt)}</Text><Text>·</Text>
        <Text>customer <Link href={`/accounts/${a.customerId}`} fontFamily="mono" color="blue.600">{a.customerId}</Link></Text><Text>·</Text>
        <Text>score {a.score}</Text><Text>·</Text>
        <SeverityBadge severity={a.severity} />
      </HStack>

      <Grid templateColumns="repeat(12, 1fr)" gap="4">
        <GridItem colSpan={{ base: 12, lg: 7 }}><Stack gap="4">
          <Box>
            <Heading size="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb="2">Why it fired</Heading>
            <Box borderWidth="1px" borderColor="gray.200" rounded="md" bg="white">
              {a.firedRules.length === 0 && <Box p="6" color="gray.500" textAlign="center">No rules fired.</Box>}
              {a.firedRules.map((r, i) => (
                <Box key={r.ruleId} p="4" borderTopWidth={i ? "1px" : 0}>
                  <HStack gap="2">
                    <GroupBadge group={r.group} />
                    <Code size="sm" fontWeight="semibold">{r.ruleId}</Code>
                    <Box flex="1" />
                    <SeverityBadge severity={r.severity} />
                    <Text color="gray.500" fontSize="sm">+{r.weight}</Text>
                  </HStack>
                  <Text my="2" fontSize="sm">{r.explanation}</Text>
                  <DataList.Root orientation="horizontal" size="sm" gap="1">
                    {Object.entries(r.evidence).map(([k, v]) => (
                      <DataList.Item key={k}>
                        <DataList.ItemLabel fontFamily="mono" fontSize="xs" minW="240px">{k}</DataList.ItemLabel>
                        <DataList.ItemValue fontFamily="mono" fontSize="xs">{fmtNum(v)}</DataList.ItemValue>
                      </DataList.Item>
                    ))}
                  </DataList.Root>
                </Box>
              ))}
            </Box>
          </Box>
          <Box>
            <Heading size="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb="2">All features at decision time</Heading>
            <Box borderWidth="1px" borderColor="gray.200" rounded="md" bg="white" p="3">
              <DataList.Root orientation="horizontal" size="sm" gap="0.5">
                {Object.entries(a.features).map(([k, v]) => (
                  <DataList.Item key={k}>
                    <DataList.ItemLabel fontFamily="mono" fontSize="xs" minW="240px">{k}</DataList.ItemLabel>
                    <DataList.ItemValue fontFamily="mono" fontSize="xs">{fmtNum(v)}</DataList.ItemValue>
                  </DataList.Item>
                ))}
              </DataList.Root>
            </Box>
          </Box>
        </Stack></GridItem>
        <GridItem colSpan={{ base: 12, lg: 5 }}>
          <Heading size="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb="2">What happened, last 14 days</Heading>
          <Box borderWidth="1px" borderColor="gray.200" rounded="md" bg="white" p="4">
            <Timeline events={a.timeline} focusId={a.id} focusDevice={focusDevice} />
          </Box>
        </GridItem>
      </Grid>
    </>
  );
}
