import type { ReactNode } from "react";
import "./globals.css";
import { Nav } from "./nav";

export const metadata = { title: "Ledger Guard", description: "Stored-value fraud and abuse monitor" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="side">
            <div className="brand"><i /> Ledger Guard</div>
            <Nav />
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
