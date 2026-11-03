import type { ReactNode } from "react";
import { Box, Grid, GridItem } from "@chakra-ui/react";
import { Provider } from "@/components/ui/provider";
import { Nav } from "./nav";

export const metadata = { title: "Ledger Guard", description: "Stored-value fraud and abuse monitor" };

// 12-column grid: sidebar takes 2 columns, content takes 10.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Provider>
          <Grid templateColumns="repeat(12, 1fr)" minH="100vh">
            <GridItem colSpan={{ base: 12, md: 2 }} as="aside" borderRightWidth={{ md: "1px" }} borderBottomWidth={{ base: "1px", md: 0 }} borderColor="gray.200" p="5" position={{ md: "sticky" }} top="0" h={{ md: "100vh" }}>
              <Nav />
            </GridItem>
            <GridItem colSpan={{ base: 12, md: 10 }} as="main" p={{ base: 4, md: 8 }}>
              <Box maxW="1280px">{children}</Box>
            </GridItem>
          </Grid>
        </Provider>
      </body>
    </html>
  );
}
