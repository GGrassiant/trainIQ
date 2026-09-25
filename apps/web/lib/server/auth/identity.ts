import "server-only";
import { isAuthError, type SupabaseClient } from "@supabase/supabase-js";
import type { RpcUser } from "../trpc/context-type";
import { authConfig } from "./config";
import { createAuthVerifier, isTemporaryAuthError } from "./client";

// Proxy overwrites this request header. It is never returned as a response header.
// It carries a JWT, not a trusted user ID: downstream always verifies it again.
export const ACCESS_TOKEN_HEADER = "x-trainiq-auth-access-token";
export const AUTH_UNAVAILABLE_HEADER = "x-trainiq-auth-unavailable";

export async function verifyIdentity(
  token: string,
  client: SupabaseClient = createAuthVerifier()
): Promise<RpcUser | null> {
  try {
    // Passing the JWT explicitly is essential: this path cannot load or refresh a session.
    const { data, error } = await client.auth.getClaims(token);
    if (error) {
      if (isTemporaryAuthError(error))
        throw new Error("Authentication temporarily unavailable.");
      return null;
    }
    if (!data) return null;
    const { claims } = data;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (
      claims.iss !== `${authConfig().url}/auth/v1` ||
      !audience.includes("authenticated") ||
      claims.role !== "authenticated" ||
      claims.is_anonymous === true ||
      typeof claims.sub !== "string" ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(claims.sub) ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Date.now() / 1000
    )
      return null;
    return { id: claims.sub };
  } catch (error) {
    if (isAuthError(error) && !isTemporaryAuthError(error)) return null;
    throw new Error("Authentication temporarily unavailable.");
  }
}
