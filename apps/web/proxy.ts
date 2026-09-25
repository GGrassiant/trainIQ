import { NextRequest, NextResponse } from "next/server";
import { createProxySession } from "./lib/server/auth/proxy-session";
import { isTemporaryAuthError } from "./lib/server/auth/client";
import {
  ACCESS_TOKEN_HEADER,
  AUTH_UNAVAILABLE_HEADER,
  verifyIdentity,
} from "./lib/server/auth/identity";

export async function proxy(request: NextRequest) {
  request.headers.delete(ACCESS_TOKEN_HEADER);
  request.headers.delete(AUTH_UNAVAILABLE_HEADER);
  // Login/callback own their cookie writes; they must not also refresh an existing session.
  if (
    request.nextUrl.pathname === "/auth/login/github" ||
    request.nextUrl.pathname === "/auth/callback"
  ) {
    return NextResponse.next({ request: { headers: request.headers } });
  }
  const originalCookieHeader = request.headers.get("cookie");
  try {
    const session = createProxySession(request);
    const { data, error } = await session.client.auth.getSession();
    // The SDK can retain a still-valid JWT after a failed proactive refresh.
    if (session.hasTemporaryFailure())
      throw new Error("Authentication unavailable");
    if (error) {
      if (isTemporaryAuthError(error)) throw error;
      session.clearCookies();
    } else if (data.session) {
      const token = data.session.access_token;
      const user = await verifyIdentity(token, session.client);
      if (session.hasTemporaryFailure())
        throw new Error("Authentication unavailable");
      if (user) request.headers.set(ACCESS_TOKEN_HEADER, token);
      else session.clearCookies();
    }
    return session.apply(
      NextResponse.next({ request: { headers: request.headers } })
    );
  } catch {
    request.headers.delete(ACCESS_TOKEN_HEADER);
    // Discard staged cookie mutations for both the browser and downstream request.
    if (originalCookieHeader)
      request.headers.set("cookie", originalCookieHeader);
    else request.headers.delete("cookie");
    const isAuthPath =
      request.nextUrl.pathname === "/auth" ||
      request.nextUrl.pathname.startsWith("/auth/");
    // Preserve the browser's credentials on infrastructure failure. Logout can still clear them.
    if (!isAuthPath || request.nextUrl.pathname === "/auth/logout") {
      const headers = new Headers(request.headers);
      if (isAuthPath) headers.set(AUTH_UNAVAILABLE_HEADER, "1");
      const response = NextResponse.next({ request: { headers } });
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Referrer-Policy", "same-origin");
      return response;
    }
    return new NextResponse(
      "Authentication temporarily unavailable. Please retry.",
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store", "Retry-After": "5" },
      }
    );
  }
}

export const config = {
  // Every application route can render the root layout. Exclude only known static assets.
  matcher: [
    "/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|(?:file|globe|next|vercel|window)\\.svg$).*)",
  ],
};
