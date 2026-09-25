import "server-only";
import type { NextRequest } from "next/server";
import { createCookieSession } from "./cookies";
import { authFetch } from "./client";

export const PROXY_AUTH_NETWORK_BUDGET_MS = 2_000;

export function createProxySession(request: NextRequest) {
  let deadline: number | undefined;
  let unavailable = false;

  function temporaryFailure() {
    unavailable = true;
    // Pinned auth-js retries network errors/5xx for ~30s, but not a JSON 429.
    // This Proxy-only response remains temporary to TrainIQ, which discards cookie writes.
    return Response.json(
      { code: "proxy_auth_unavailable", message: "Authentication unavailable" },
      { status: 429 }
    );
  }

  const proxyFetch: typeof fetch = async (input, init) => {
    deadline ??= Date.now() + PROXY_AUTH_NETWORK_BUDGET_MS;
    const remaining = deadline - Date.now();
    if (unavailable || remaining <= 0) return temporaryFailure();
    const controller = new AbortController();
    const signal = init?.signal
      ? AbortSignal.any([controller.signal, init.signal])
      : controller.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await authFetch(input, { ...init, signal });
          if (response.status === 429 || response.status >= 500) {
            controller.abort();
            return temporaryFailure();
          }
          // The budget includes the response body, not just receipt of HTTP headers.
          const body = await response.arrayBuffer();
          return new Response(
            [204, 205, 304].includes(response.status) ? null : body,
            {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            }
          );
        })(),
        new Promise<Response>((resolve) => {
          timer = setTimeout(() => {
            controller.abort();
            resolve(temporaryFailure());
          }, remaining);
        }),
      ]);
    } catch {
      return temporaryFailure();
    } finally {
      clearTimeout(timer);
    }
  };

  return createCookieSession(request, proxyFetch);
}
