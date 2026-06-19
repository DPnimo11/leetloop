"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
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
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Sign in to LeetLoop
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Your spaced-repetition queue, synced across devices.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => signIn("google")}
          disabled={pending !== null}
          className="flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]/10 disabled:opacity-60"
        >
          {pending === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
        <button
          type="button"
          onClick={() => signIn("github")}
          disabled={pending !== null}
          className="flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]/10 disabled:opacity-60"
        >
          {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>
      </div>

      {error ? (
        <p className="text-center text-sm text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
