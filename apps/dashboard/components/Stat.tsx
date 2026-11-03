import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <Box borderWidth="1px" borderColor="gray.200" rounded="md" p="4" bg="white" h="100%">
      <Text fontSize="xs" color="gray.500">{label}</Text>
      <Text fontSize="2xl" fontWeight="semibold" color={color ?? "gray.900"} mt="1">{value}</Text>
    </Box>
  );
}
