"use client";
import { usePathname } from "next/navigation";
import { Box, HStack, Link, Stack, Text } from "@chakra-ui/react";

const items = [
  ["/", "Live feed"],
  ["/review", "Review queue"],
  ["/accounts", "Accounts"],
  ["/rules", "Rules"],
  ["/admin", "Demo control"],
];

export function Nav() {
  const p = usePathname();
  return (
    <Stack gap="6">
      <HStack gap="2">
        <Box w="10px" h="10px" rounded="sm" bg="gray.900" />
        <Text fontWeight="bold">Ledger Guard</Text>
      </HStack>
      <Stack gap="1">
        {items.map(([href, label]) => {
          const active = href === "/" ? p === "/" : p.startsWith(href);
          return (
            <Link key={href} href={href} px="3" py="2" rounded="md" fontSize="sm" color={active ? "gray.900" : "gray.600"} bg={active ? "gray.100" : undefined} fontWeight={active ? "semibold" : "normal"} _hover={{ bg: "gray.100", color: "gray.900", textDecoration: "none" }}>
              {label}
            </Link>
          );
        })}
      </Stack>
    </Stack>
  );
}
