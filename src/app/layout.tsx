import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { LeetLoopProvider } from "@/components/LeetLoopProvider";
import { ShellNav } from "@/components/ShellNav";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://useleetloop.vercel.app";
const siteTitle = "LeetLoop - Spaced review for coding interviews";
const siteDescription = "A cloud-backed LeetCode review queue for spaced repetition.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | LeetLoop",
  },
  description: siteDescription,
  applicationName: "LeetLoop",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "LeetLoop",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeetLoop - cloud-backed LeetCode review queue",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0f766e",
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
                <Link className="flex w-fit items-center gap-3" href="/">
                  <Image
                    alt=""
                    className="size-10 shrink-0 object-contain"
                    height={56}
                    priority
                    src="/logo.png"
                    width={56}
                  />
                  <span>
                    <span className="block text-xl font-semibold tracking-normal text-[var(--foreground)]">
                      LeetLoop
                    </span>
                    <span className="block text-sm text-[var(--muted)]">
                      Spaced review for coding interviews
                    </span>
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
