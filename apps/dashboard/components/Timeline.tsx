import { Box, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { fmtTime, describeEvent, type TimelineEvent } from "@/lib/api";

const HOT = new Set(["auth.reset", "auth.new_device", "value.transfer", "value.load", "refund.created"]);

export function Timeline({ events, focusId, focusDevice }: { events: TimelineEvent[]; focusId?: string; focusDevice?: string }) {
  return (
    <Stack gap="0" borderLeftWidth="2px" ml="2" pl="4">
      {events.map((e) => {
        const hot = HOT.has(e.type);
        const focus = e.id === focusId;
        return (
          <Box key={e.id} position="relative" py="2" px="2" rounded="md" bg={focus ? "gray.100" : undefined}>
            <Box position="absolute" left="-23px" top="14px" w="10px" h="10px" rounded="full" bg={hot ? "red.600" : "gray.300"} borderWidth="2px" borderColor="white" />
            <HStack gap="2" fontSize="xs" color="gray.500" fontFamily="mono">
              <Text>{fmtTime(e.occurred_at)}</Text>
              {e.payload.deviceId && <Code size="xs" colorPalette={e.payload.deviceId === focusDevice ? "red" : undefined}>{e.payload.deviceId}</Code>}
              {e.payload.ipCountry && <Code size="xs" variant="plain">{e.payload.ipCountry}{e.payload.ipAsnType ? ` · ${e.payload.ipAsnType}` : ""}</Code>}
            </HStack>
            <Text fontSize="sm">{describeEvent(e)}</Text>
          </Box>
        );
      })}
    </Stack>
  );
}
