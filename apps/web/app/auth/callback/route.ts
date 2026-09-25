import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "../../../lib/server/auth/config";
import { createCookieSession } from "../../../lib/server/auth/cookies";
import { verifyIdentity } from "../../../lib/server/auth/identity";

export async function GET(request: NextRequest) {
  const config = authConfig();
  const session = createCookieSession(request);
  const code = request.nextUrl.searchParams.get("code");
  let success = false;
  let receivedSession = false;
  try {
    if (code && !request.nextUrl.searchParams.has("error")) {
      const { data, error } = await session.client.auth.exchangeCodeForSession(
        code
      );
      receivedSession = !!data.session;
      if (!error && data.session)
        success = !!(await verifyIdentity(
          data.session.access_token,
          session.client
        ));
    }
  } catch {
    /* The redirect deliberately excludes the provider's URL parameters. */
  }
  if (receivedSession && !success) session.clearCookies();
  session.clearCookies(true);
  const destination = success ? "/" : "/?auth=login-failed";
  const response = session.apply(
    NextResponse.redirect(new URL(destination, config.origin), 303)
  );
  // Keep the OAuth code out of the next navigation's Referer header.
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
