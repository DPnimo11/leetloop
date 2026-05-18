import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LeetLoopProvider } from "@/components/LeetLoopProvider";
import { ShellNav } from "@/components/ShellNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetLoop",
  description: "A spaced-repetition queue for LeetCode review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LeetLoopProvider>
          <div className="min-h-screen">
            <header className="border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <Link href="/" className="w-fit">
                  <span className="block text-xl font-semibold tracking-normal text-[var(--foreground)]">
                    LeetLoop
                  </span>
                  <span className="block text-sm text-[var(--muted)]">
                    Spaced review for coding interviews
                  </span>
                </Link>
                <ShellNav />
              </div>
            </header>
            <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
          </div>
        </LeetLoopProvider>
      </body>
    </html>
  );
}
