import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <Box borderWidth="1px" rounded="lg" p="4" bg="bg.panel">
      <Text fontSize="xs" color="fg.muted">{label}</Text>
      <Text fontSize="2xl" fontWeight="semibold" color={color} mt="1">{value}</Text>
    </Box>
  );
}
