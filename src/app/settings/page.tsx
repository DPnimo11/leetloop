import { SettingsClient } from "@/components/SettingsClient";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <SettingsClient
      account={{
        avatarUrl: user ? userAvatarUrl(user.user_metadata) : undefined,
        createdAt: user?.created_at,
        email: user?.email,
        name: user ? userDisplayName(user.user_metadata, user.email) : undefined,
        providers: user ? userProviders(user.app_metadata) : [],
      }}
    />
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

function userProviders(metadata: Record<string, unknown>): string[] {
  const providers = metadata.providers;

  if (Array.isArray(providers)) {
    return providers.filter((provider): provider is string => typeof provider === "string");
  }

  const provider = stringValue(metadata.provider);
  return provider ? [provider] : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
