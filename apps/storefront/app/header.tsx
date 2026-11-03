"use client";
import { useEffect, useState } from "react";
import { Code, Container, Grid, GridItem, HStack, Link, NativeSelect, Text } from "@chakra-ui/react";
import { getToken, getCart, deviceId, getNet, setNet, type Net } from "@/lib/api";

const NETS: [string, string][] = [["US:residential", "US home broadband"], ["US:mobile", "US mobile"], ["US:datacentre", "US datacentre"], ["NG:vpn", "NG via VPN"], ["RO:residential", "RO residential"], ["DE:tor", "DE Tor exit"]];

export function Header() {
  const [authed, setAuthed] = useState(false);
  const [n, setN] = useState(0);
  const [dev, setDev] = useState("");
  const [net, setNetState] = useState<Net>({ country: "US", network: "residential" });
  useEffect(() => {
    const sync = () => { setAuthed(Boolean(getToken())); setN(getCart().reduce((a, i) => a + i.qty, 0)); setDev(deviceId()); setNetState(getNet()); };
    sync();
    const t = setInterval(sync, 1000);
    return () => clearInterval(t);
  }, []);
  const navLink = (href: string, label: string) => <Link key={href} href={href} color="gray.600" _hover={{ color: "gray.900", textDecoration: "none" }} fontSize="sm">{label}</Link>;
  return (
    <Container as="header" maxW="6xl" borderBottomWidth="1px" borderColor="gray.200" py="4">
      <Grid templateColumns="repeat(12, 1fr)" gap="4" alignItems="center">
        <GridItem colSpan={{ base: 12, md: 3 }}>
          <Link href="/" fontSize="xl" fontWeight="bold" color="gray.900" _hover={{ textDecoration: "none" }}>Orchard &amp; Vine</Link>
        </GridItem>
        <GridItem colSpan={{ base: 12, md: 5 }}>
          <HStack gap="4" fontSize="xs" color="gray.500">
            <HStack gap="1"><Text>device</Text><Code size="xs">{dev}</Code></HStack>
            <HStack gap="2">
              <Text>network</Text>
              <NativeSelect.Root size="xs" width="160px">
                <NativeSelect.Field value={`${net.country}:${net.network}`} onChange={(e) => { const [country, network] = e.target.value.split(":"); setNet({ country, network: network as Net["network"] }); setNetState(getNet()); }}>
                  {NETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </HStack>
          </HStack>
        </GridItem>
        <GridItem colSpan={{ base: 12, md: 4 }}>
          <HStack gap="5" justify={{ md: "flex-end" }}>
            {navLink("/", "Shop")}
            {navLink("/cart", `Cart${n ? ` (${n})` : ""}`)}
            {navLink("/account", "Account")}
            {process.env.NEXT_PUBLIC_MAILBOX_URL && <Link href={process.env.NEXT_PUBLIC_MAILBOX_URL} target="_blank" rel="noreferrer" color="gray.600" fontSize="sm">Inbox</Link>}
            {navLink("/outbox", "Outbox")}
            {authed ? navLink("/logout", "Log out") : navLink("/login", "Log in")}
          </HStack>
        </GridItem>
      </Grid>
    </Container>
  );
}
