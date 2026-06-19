"use client";

import { useState, type ReactNode } from "react";
import type { Provider } from "@supabase/supabase-js";
import { Github, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "");

export default function LoginPage() {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string>();

  async function signIn(provider: Provider) {
    setError(undefined);
    setPending(provider);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });

    if (signInError) {
      setError(signInError.message);
      setPending(null);
    }
    // On success the browser is redirected to the provider; no further work.
  }

  return (
    <div className="mx-auto flex min-h-[68vh] max-w-md flex-col justify-center">
      <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-[#e6f4f1] text-lg font-bold text-[var(--accent-strong)]">
              LL
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--accent-strong)]">LeetLoop</p>
              <h1 className="text-2xl font-semibold tracking-normal text-[var(--foreground)]">
                Sign in
              </h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            Pick up your review queue from any device.
          </p>
        </div>

        <div className="space-y-3 px-6 py-6">
          <OAuthButton
            disabled={pending !== null}
            icon={<GoogleIcon />}
            label="Continue with Google"
            loading={pending === "google"}
            onClick={() => signIn("google")}
          />
          <OAuthButton
            disabled={pending !== null}
            icon={<Github aria-hidden="true" size={18} />}
            label="Continue with GitHub"
            loading={pending === "github"}
            onClick={() => signIn("github")}
          />

          {error ? (
            <p className="rounded-md border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function OAuthButton({
  disabled,
  icon,
  label,
  loading,
  onClick,
}: {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-center gap-3 rounded-md border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : icon}
      {loading ? "Redirecting..." : label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-[18px]" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.76-.07-1.49-.19-2.19H12v4.14h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.48Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.62-2.29l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 14.03a6.01 6.01 0 0 1 0-3.82V7.62H3.06a10 10 0 0 0 0 8.99l3.34-2.58Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.08c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.95 3.1 14.7 2.1 12 2.1a10 10 0 0 0-8.94 5.52l3.34 2.59C7.19 7.84 9.4 6.08 12 6.08Z"
        fill="#EA4335"
      />
    </svg>
  );
}
