import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "./config";
import { authFetch } from "./client";

type CookieWrite = { name: string; value: string; options: CookieOptions };

export function createCookieSession(
  request: NextRequest,
  sessionFetch: typeof fetch = authFetch
) {
  const config = authConfig();
  const writes = new Map<string, CookieWrite>();
  const headers = new Headers();
  let temporaryFailure = false;
  const baseOptions: CookieOptions = {
    httpOnly: true,
    secure: config.secure,
    sameSite: "lax",
    path: "/",
  };
  const isAuthCookie = (name: string) =>
    name === config.cookieName ||
    name.startsWith(`${config.cookieName}.`) ||
    name.startsWith(`${config.cookieName}-`);
  // Pinned SSR SDK names all verifier/index keys with this suffix (before optional chunks).
  const isPkceCookie = (name: string) =>
    isAuthCookie(name) && /-code-verifier(?:\.\d+)?$/.test(name);

  function write(cookie: CookieWrite) {
    const options = { ...cookie.options, ...baseOptions, domain: undefined };
    if (isPkceCookie(cookie.name) && options.maxAge !== 0) {
      // Fifteen minutes to finish the human login; the issued code has its own shorter expiry.
      options.maxAge = 15 * 60;
      options.expires = undefined;
    }
    writes.set(cookie.name, { ...cookie, options });
    if (options.maxAge === 0) request.cookies.delete(cookie.name);
    else request.cookies.set(cookie.name, cookie.value);
  }

  function clearCookies(pkceOnly = false) {
    const names = new Set([
      ...request.cookies.getAll().map((cookie) => cookie.name),
      ...writes.keys(),
    ]);
    names.forEach((name) => {
      if (pkceOnly ? isPkceCookie(name) : isAuthCookie(name)) {
        write({ name, value: "", options: { maxAge: 0 } });
      }
    });
  }

  const client = createServerClient(config.url, config.key, {
    cookieOptions: { ...baseOptions, name: config.cookieName },
    global: {
      fetch: async (input, init) => {
        try {
          const response = await sessionFetch(input, init);
          if (response.status === 429 || response.status >= 500)
            temporaryFailure = true;
          return response;
        } catch (error) {
          temporaryFailure = true;
          throw error;
        }
      },
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, cacheHeaders) {
        cookies.forEach(write);
        Object.entries(cacheHeaders ?? {}).forEach(([name, value]) =>
          headers.set(name, value)
        );
      },
    },
  });

  function apply(response: NextResponse) {
    writes.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    headers.forEach((value, name) => response.headers.set(name, value));
    response.headers.set("Cache-Control", "private, no-store");
    // no-referrer makes native form POSTs send Origin: null, breaking strict CSRF checks.
    response.headers.set("Referrer-Policy", "same-origin");
    return response;
  }

  return {
    client,
    clearCookies,
    apply,
    hasTemporaryFailure: () => temporaryFailure,
  };
}
