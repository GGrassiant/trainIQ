import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "../../../lib/server/auth/config";
import { createCookieSession } from "../../../lib/server/auth/cookies";
import {
  ACCESS_TOKEN_HEADER,
  AUTH_UNAVAILABLE_HEADER,
} from "../../../lib/server/auth/identity";

export async function POST(request: NextRequest) {
  const config = authConfig();
  if (request.headers.get("origin") !== config.origin) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const session = createCookieSession(request);
  let incomplete = request.headers.has(AUTH_UNAVAILABLE_HEADER);
  const token = request.headers.get(ACCESS_TOKEN_HEADER);
  try {
    if (token) {
      // This SDK endpoint accepts the user's JWT with a publishable key; no service-role key.
      // Unlike auth.signOut(), it cannot implicitly load/refresh the session again.
      const { error } = await session.client.auth.admin.signOut(token, "local");
      incomplete = !!error && ![401, 403, 404].includes(error.status ?? 0);
    }
  } catch {
    incomplete = true;
  }
  session.clearCookies();
  return session.apply(
    NextResponse.redirect(
      new URL(incomplete ? "/?auth=logout-incomplete" : "/", config.origin),
      303
    )
  );
}
