import "server-only";
import {
  createClient,
  isAuthApiError,
  isAuthRetryableFetchError,
} from "@supabase/supabase-js";
import { authConfig } from "./config";

// No credentials or URLs are logged on failures. Authentication responses must never be cached.
export const authFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });

export function createAuthVerifier() {
  const config = authConfig();
  return createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      skipAutoInitialize: true,
    },
    global: { fetch: authFetch },
  });
}

export function isTemporaryAuthError(error: unknown): boolean {
  return (
    isAuthRetryableFetchError(error) ||
    (isAuthApiError(error) && (error.status >= 500 || error.status === 429))
  );
}
