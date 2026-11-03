"use client";
import { usePathname } from "next/navigation";

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
    <nav className="nav">
      {items.map(([href, label]) => (
        <a key={href} href={href} className={(href === "/" ? p === "/" : p.startsWith(href)) ? "active" : ""}>{label}</a>
      ))}
    </nav>
  );
}
