import type { ReactNode } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Provider } from "@/components/ui/provider";
import { Nav } from "./nav";

export const metadata = { title: "Ledger Guard", description: "Stored-value fraud and abuse monitor" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Provider>
          <Flex minH="100vh">
            <Box as="aside" w="220px" borderRightWidth="1px" p="5" position="sticky" top="0" h="100vh" flexShrink={0}>
              <Nav />
            </Box>
            <Box as="main" flex="1" p="8" maxW="1240px">{children}</Box>
          </Flex>
        </Provider>
      </body>
    </html>
  );
}
