import type { ReactNode } from "react";
import { Container } from "@chakra-ui/react";
import { Provider } from "@/components/ui/provider";
import { Header } from "./header";

export const metadata = { title: "Orchard & Vine", description: "Specialty grocer, wine and fresh food, delivered" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Provider>
          <Header />
          <Container maxW="5xl" py="8">{children}</Container>
        </Provider>
      </body>
    </html>
  );
}
