import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
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
  const accountName = user ? userDisplayName(user.user_metadata, user.email) : undefined;
  const accountAvatarUrl = user ? userAvatarUrl(user.user_metadata) : undefined;

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
                    <AccountMenu
                      avatarUrl={accountAvatarUrl}
                      email={user.email}
                      name={accountName}
                    />
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

function userDisplayName(metadata: Record<string, unknown>, email?: string): string | undefined {
  const value =
    stringValue(metadata.full_name) ??
    stringValue(metadata.name) ??
    stringValue(metadata.user_name) ??
    stringValue(metadata.preferred_username);

  return value ?? email?.split("@")[0];
}

function userAvatarUrl(metadata: Record<string, unknown>): string | undefined {
  return (
    stringValue(metadata.avatar_url) ??
    stringValue(metadata.picture) ??
    stringValue(metadata.image)
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
