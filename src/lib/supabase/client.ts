import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components / the browser.
 * Reads the public env vars exposed at build time.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
