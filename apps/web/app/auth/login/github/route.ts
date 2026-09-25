import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "../../../../lib/server/auth/config";
import { createCookieSession } from "../../../../lib/server/auth/cookies";

export async function GET(request: NextRequest) {
  const config = authConfig();
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.headers.has("origin") &&
      request.headers.get("origin") !== config.origin)
  ) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const session = createCookieSession(request);
  // V1 supports one pending login per browser. Starting another replaces that attempt.
  session.clearCookies(true);
  try {
    const { data, error } = await session.client.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${config.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    });
    if (!error && data.url)
      return session.apply(NextResponse.redirect(data.url, 303));
  } catch {
    /* Show a fixed public error, never provider details or credentials. */
  }
  session.clearCookies(true);
  return session.apply(
    NextResponse.redirect(`${config.origin}/?auth=login-failed`, 303)
  );
}
