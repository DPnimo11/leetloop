"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/problems", label: "Problems" },
  { href: "/problem-sets", label: "Sets" },
  { href: "/add", label: "Add" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShellNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-wrap gap-1 text-sm font-medium">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`shell-link ${active ? "shell-link-active" : ""}`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
