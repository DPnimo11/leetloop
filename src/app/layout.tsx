import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LC Queue",
  description: "A spaced-repetition queue for LeetCode review.",
};

const navItems = [
  { href: "/", label: "Today" },
  { href: "/problems", label: "Problems" },
  { href: "/problem-sets", label: "Sets" },
  { href: "/add", label: "Add" },
  { href: "/analytics", label: "Analytics" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Link href="/" className="w-fit">
                <span className="block text-xl font-semibold tracking-normal text-[var(--foreground)]">
                  LC Queue
                </span>
                <span className="block text-sm text-[var(--muted)]">
                  Spaced review for coding interviews
                </span>
              </Link>
              <nav aria-label="Main navigation" className="flex flex-wrap gap-1 text-sm font-medium">
                {navItems.map((item) => (
                  <Link className="shell-link" href={item.href} key={item.href}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
