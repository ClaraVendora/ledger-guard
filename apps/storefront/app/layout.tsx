import type { ReactNode } from "react";
import "./globals.css";
import { Header } from "./header";

export const metadata = { title: "Orchard & Vine", description: "Specialty grocer, wine and fresh food, delivered" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
