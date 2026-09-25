import "server-only";
import type { RpcContext } from "./context-type";
import { ACCESS_TOKEN_HEADER, verifyIdentity } from "../auth/identity";

export async function createTRPCContext(headers: Headers): Promise<RpcContext> {
  const token = headers.get(ACCESS_TOKEN_HEADER);
  if (!token) return { user: null };
  try {
    return { user: await verifyIdentity(token) };
  } catch {
    // Identity resolution must not block public procedures or grant privileges on failure.
    return { user: null };
  }
}
