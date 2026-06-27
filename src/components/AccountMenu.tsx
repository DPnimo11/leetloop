"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChartNoAxesCombined, ChevronDown, LogOut, Settings, UserCircle } from "lucide-react";

type AccountMenuProps = {
  avatarUrl?: string;
  email?: string;
  name?: string;
};

export function AccountMenu({ avatarUrl, email, name }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = name || email || "Account";
  const initials = initialsFor(displayName);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white p-1 pr-2 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
        onClick={() => setOpen((current) => !current)}
        title={`Signed in as ${email ?? displayName}`}
        type="button"
      >
        <span className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full bg-[#e6f4f1] text-xs font-bold text-[var(--accent-strong)]">
          {avatarUrl ? (
            <span
              aria-hidden="true"
              className="size-full bg-cover bg-center"
              style={{ backgroundImage: `url("${avatarUrl}")` }}
            />
          ) : (
            initials || <UserCircle size={18} />
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`text-[var(--muted)] transition ${open ? "rotate-180" : ""}`}
          size={16}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-xl sm:left-auto sm:right-0"
          role="menu"
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">{displayName}</p>
            {email ? <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{email}</p> : null}
          </div>

          <div className="p-1">
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[var(--surface-subtle)]"
              href="/analytics"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <ChartNoAxesCombined aria-hidden="true" size={16} />
              Analytics
            </Link>
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[var(--surface-subtle)]"
              href="/settings"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <Settings aria-hidden="true" size={16} />
              Settings
            </Link>
            <form action="/auth/signout" method="post">
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[#344054] hover:bg-[var(--surface-subtle)]"
                role="menuitem"
                type="submit"
              >
                <LogOut aria-hidden="true" size={16} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function initialsFor(value: string): string {
  const parts = value
    .replace(/@.*/, "")
    .split(/\s+|[._-]/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
