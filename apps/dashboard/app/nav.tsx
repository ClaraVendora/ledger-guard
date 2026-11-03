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
        <Box w="10px" h="10px" rounded="sm" bg="brand.500" />
        <Text fontWeight="bold">Ledger Guard</Text>
      </HStack>
      <Stack gap="1">
        {items.map(([href, label]) => {
          const active = href === "/" ? p === "/" : p.startsWith(href);
          return (
            <Link key={href} href={href} px="3" py="2" rounded="md" color={active ? "fg" : "fg.muted"} bg={active ? "bg.emphasized" : undefined} _hover={{ bg: "bg.emphasized", color: "fg", textDecoration: "none" }}>
              {label}
            </Link>
          );
        })}
      </Stack>
    </Stack>
  );
}
