"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/upcoming", label: "Upcoming" },
];

const problemNavItems = [
  { href: "/problems", label: "All problems" },
  { href: "/problem-sets", label: "Browse sets" },
  { href: "/add", label: "Add problem" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShellNav() {
  const pathname = usePathname();
  const [problemsOpen, setProblemsOpen] = useState(false);
  const problemsMenuRef = useRef<HTMLDivElement>(null);
  const problemsActive = problemNavItems.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    if (!problemsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!problemsMenuRef.current?.contains(event.target as Node)) {
        setProblemsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProblemsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [problemsOpen]);

  return (
    <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1 text-sm font-medium">
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

      <div className="relative" ref={problemsMenuRef}>
        <button
          aria-expanded={problemsOpen}
          aria-haspopup="menu"
          className={`shell-link inline-flex items-center gap-1 ${problemsActive ? "shell-link-active" : ""}`}
          onClick={() => setProblemsOpen((current) => !current)}
          type="button"
        >
          Problems
          <ChevronDown
            aria-hidden="true"
            className={`transition ${problemsOpen ? "rotate-180" : ""}`}
            size={15}
          />
        </button>

        {problemsOpen ? (
          <div
            className="absolute left-0 z-30 mt-2 w-48 overflow-hidden rounded-lg border border-[var(--border)] bg-white p-1 shadow-xl sm:left-auto sm:right-0"
            role="menu"
          >
            {problemNavItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-md px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[var(--surface-subtle)] ${active ? "bg-[var(--surface-subtle)] text-[var(--accent-strong)]" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setProblemsOpen(false)}
                  role="menuitem"
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
