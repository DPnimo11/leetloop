import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LeetLoopProvider } from "@/components/LeetLoopProvider";
import { ShellNav } from "@/components/ShellNav";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetLoop",
  description: "A spaced-repetition queue for LeetCode review.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
                {user ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <ShellNav />
                    <div className="flex items-center gap-3 text-sm">
                      <span className="hidden text-[var(--muted)] lg:inline">
                        {user.email}
                      </span>
                      <form action="/auth/signout" method="post">
                        <button
                          type="submit"
                          className="shell-link"
                          title={`Signed in as ${user.email ?? "your account"}`}
                        >
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>
                ) : null}
              </div>
            </header>
            <SyncStatusBanner />
            <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
          </div>
        </LeetLoopProvider>
      </body>
    </html>
  );
}
