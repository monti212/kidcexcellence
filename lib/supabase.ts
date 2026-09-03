import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase access for the platform store.
//
// The store is reached only from route handlers and server components using the
// secret key, which bypasses row level security. Never import this module from a
// client component: the secret key must not reach the browser.

let cachedClient: { credentialKey: string; client: SupabaseClient } | null = null;

function supabaseCredentials() {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) return null;
  return { url, secretKey };
}

/**
 * Whether the platform store should persist to Supabase.
 *
 * `PLATFORM_STORE_DRIVER` forces a driver, which keeps the integration suite
 * hermetic: tests set `json` so a configured `.env.local` cannot point them at
 * the live database.
 */
export function supabaseStoreEnabled() {
  const driver = process.env.PLATFORM_STORE_DRIVER?.trim().toLowerCase();
  if (driver === "json") return false;
  if (driver === "supabase") {
    if (!supabaseCredentials()) {
      throw new Error(
        "PLATFORM_STORE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY."
      );
    }
    return true;
  }
  return Boolean(supabaseCredentials());
}

export function supabaseAdminClient() {
  const credentials = supabaseCredentials();
  if (!credentials) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY, or set PLATFORM_STORE_DRIVER=json to use the local JSON store."
    );
  }

  const credentialKey = `${credentials.url}::${credentials.secretKey}`;
  if (cachedClient?.credentialKey === credentialKey) return cachedClient.client;

  const client = createClient(credentials.url, credentials.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-client-info": "kidcellence-platform-store" } },
  });
  cachedClient = { credentialKey, client };
  return client;
}
