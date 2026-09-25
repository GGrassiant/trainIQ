import { generateKeyPairSync, sign, createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { proxy } from "../../../proxy";
import { PROXY_AUTH_NETWORK_BUDGET_MS } from "./proxy-session";
import { stubProviders } from "../test-support/providers";
import { GET as login } from "../../../app/auth/login/github/route";
import { GET as callback } from "../../../app/auth/callback/route";
import { POST as logout } from "../../../app/auth/logout/route";
import { GET as rpc } from "../../../app/api/trpc/[trpc]/route";
import { createTRPCContext } from "../trpc/context";
import { appRouter } from "../trpc/router";
import {
  verifyIdentity,
  ACCESS_TOKEN_HEADER,
  AUTH_UNAVAILABLE_HEADER,
} from "./identity";

vi.mock("server-only", () => ({}));

const origin = "http://localhost:3000";
const project = "https://trainiq-auth-test.supabase.co";
const id = "12345678-1234-4234-8234-123456789abc";
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "trainiq-test",
  alg: "ES256",
  use: "sig",
};
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const now = () => Math.floor(Date.now() / 1000);

function jwt(claims: Record<string, unknown> = {}, keyId = jwk.kid) {
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: id,
      exp: now() + 3600,
      iat: now(),
      iss: `${project}/auth/v1`,
      aud: "authenticated",
      role: "authenticated",
      ...claims,
    })
  ).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${sign("sha256", Buffer.from(data), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url")}`;
}

function storedCookies(
  token = jwt(),
  expiresAt = now() + 3600,
  extraUserData = ""
) {
  const session = {
    access_token: token,
    refresh_token: "old-refresh",
    token_type: "bearer",
    expires_at: expiresAt,
    expires_in: 3600,
    user: { ...user, user_metadata: { extraUserData } },
  };
  return createChunks(
    "trainiq-auth",
    `base64-${stringToBase64URL(JSON.stringify(session))}`
  )
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

function request(
  path: string,
  cookie = "",
  headers: Record<string, string> = {},
  method = "GET"
) {
  return new NextRequest(`${origin}${path}`, {
    method,
    headers: { cookie, ...headers },
  });
}

function browserCookies(response: NextResponse) {
  return response.cookies
    .getAll()
    .filter((cookie) => cookie.maxAge !== 0)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("SUPABASE_URL", project);
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("TRAINIQ_APP_URL", origin);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/.well-known/jwks.json"))
      return Response.json({ keys: [jwk] });
    throw new Error("Unexpected auth HTTP request in test");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("returns null for absent identity and ignores an injected identity header at the Proxy", async () => {
  const incoming = request("/api/trpc/auth.me", "", {
    [ACCESS_TOKEN_HEADER]: jwt(),
    [AUTH_UNAVAILABLE_HEADER]: "1",
  });
  const response = await proxy(incoming);
  expect(
    response.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)
  ).toBeNull();
  expect(incoming.headers.has(AUTH_UNAVAILABLE_HEADER)).toBe(false);
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
  expect(await (await rpc(incoming)).json()).toEqual({
    result: { data: null },
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("serves pages with a policy that preserves Origin for the native logout form", async () => {
  const page = await proxy(request("/"));
  expect(page.headers.get("Referrer-Policy")).toBe("same-origin");
  const response = await logout(
    request("/auth/logout", "", { origin }, "POST")
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`${origin}/`);
});

it("returns only the verified ID through HTTP and the server caller, without refreshing", async () => {
  const token = jwt();
  const incoming = request("/api/trpc/auth.me", storedCookies(token));
  const response = await proxy(incoming);
  expect(response.headers.get(ACCESS_TOKEN_HEADER)).toBeNull();
  const ctx = await createTRPCContext(incoming.headers);
  expect(ctx).toEqual({ user: { id } });
  expect(await appRouter.createCaller(ctx).auth.me()).toEqual({ id });
  const result = await rpc(incoming);
  expect(await result.json()).toEqual({ result: { data: { id } } });
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(
    fetchMock.mock.calls.every(([url]) =>
      String(url).endsWith("/.well-known/jwks.json")
    )
  ).toBe(true);
});

it("auth.me projects its output even if a server caller has extra private fields", async () => {
  const ctx = {
    user: {
      id,
      email: "private@example.test",
      access_token: "secret",
      refresh_token: "secret",
    },
  };
  expect(await appRouter.createCaller(ctx).auth.me()).toEqual({ id });
});

it("rejects a forged JWT and never accepts cookie user metadata as identity", async () => {
  const parts = jwt().split(".");
  parts[1] = Buffer.from(
    JSON.stringify({ sub: "attacker", exp: now() + 3600 })
  ).toString("base64url");
  expect(await verifyIdentity(parts.join("."))).toBeNull();
  const incoming = request("/", storedCookies(parts.join(".")));
  const response = await proxy(incoming);
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
  expect(response.cookies.get("trainiq-auth")?.maxAge).toBe(0);
});

it.each([
  { exp: now() - 60 },
  { iss: "https://other.supabase.co/auth/v1" },
  { aud: "other" },
  { sub: "" },
  { role: "service_role" },
  { is_anonymous: true },
])(
  "rejects unacceptable signed claims without refreshing: %j",
  async (claims) => {
    expect(await verifyIdentity(jwt(claims))).toBeNull();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/token"))
    ).toBe(false);
  }
);

it("rejects malformed tokens", async () => {
  expect(await verifyIdentity("not-a-jwt")).toBeNull();
});

it.each(["none", "HS256", "missing-kid", "unknown-kid"])(
  "never accepts an untrusted %s JWT as identity",
  async (variant) => {
    const [, payload, signature] = jwt().split(".");
    const header = { alg: "ES256", kid: "unknown-key" } as {
      alg: string;
      kid?: string;
    };
    if (variant === "none" || variant === "HS256") header.alg = variant;
    if (variant === "missing-kid") delete header.kid;
    const data = `${Buffer.from(JSON.stringify(header)).toString(
      "base64url"
    )}.${payload}`;
    let forgedSignature = signature;
    if (variant === "none") forgedSignature = "";
    if (variant === "HS256")
      forgedSignature = createHmac("sha256", "attacker-secret")
        .update(data)
        .digest("base64url");
    const token = `${data}.${forgedSignature}`;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith("/.well-known/jwks.json"))
        return Response.json({ keys: [jwk] });
      // Only the external Auth service is stubbed. SDK parsing and JWT crypto remain real.
      if (String(input).endsWith("/user"))
        return Response.json(
          { code: "bad_jwt", message: "Invalid JWT" },
          { status: 401 }
        );
      throw new Error("Unexpected auth request");
    });
    expect(await verifyIdentity(token)).toBeNull();
    expect(
      await createTRPCContext(new Headers({ [ACCESS_TOKEN_HEADER]: token }))
    ).toEqual({ user: null });
  }
);

it.each([
  "/",
  "/settings",
  "/unknown/deep/page",
  "/unknown.svg",
  "/api/trpc/auth.me",
  "/auth/callback",
  "/_next/image-other",
])("controls identity headers on application route %s", async (path) => {
  const incoming = request(path, "", {
    [ACCESS_TOKEN_HEADER]: jwt(),
    [AUTH_UNAVAILABLE_HEADER]: "1",
  });
  await proxy(incoming);
  expect(incoming.headers.has(ACCESS_TOKEN_HEADER)).toBe(false);
  expect(incoming.headers.has(AUTH_UNAVAILABLE_HEADER)).toBe(false);
});

it("still serves the public plan over HTTP during a Supabase refresh outage", async () => {
  const providers = stubProviders();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T01:00:00Z"));
  fetchMock.mockImplementation(async (input) => {
    if (String(input).startsWith(project))
      return Response.json({ message: "Unavailable" }, { status: 429 });
    return Response.json(await (await providers(String(input))).json());
  });
  const incoming = request(
    "/api/trpc/planning.getWeeklyPlan",
    storedCookies(jwt({ exp: now() - 30 }), now() - 30)
  );
  const proxied = await proxy(incoming);
  expect(proxied.headers.get("x-middleware-next")).toBe("1");
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
  const response = await rpc(incoming);
  expect(response.status).toBe(200);
  expect((await response.json()).result.data.weekStartDate).toBe("2026-09-28");
});

it("rotates expired sessions before downstream execution and replaces all cookie chunks", async () => {
  const replacement = jwt();
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/.well-known/jwks.json"))
      return Response.json({ keys: [jwk] });
    expect(url.searchParams.get("grant_type")).toBe("refresh_token");
    expect(JSON.parse(String(init?.body))).toEqual({
      refresh_token: "old-refresh",
    });
    return Response.json({
      access_token: replacement,
      refresh_token: "new-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user,
    });
  });
  const incoming = request(
    "/api/trpc/auth.me",
    storedCookies(jwt({ exp: now() - 30 }), now() - 30, "x".repeat(7000))
  );
  const response = await proxy(incoming);
  expect(
    response.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)
  ).toBe(replacement);
  expect(response.headers.get("x-middleware-request-cookie")).toBe(
    incoming.headers.get("cookie")
  );
  expect(response.cookies.get("trainiq-auth.0")?.maxAge).toBe(0);
  expect(response.cookies.get("trainiq-auth")?.httpOnly).toBe(true);
  expect(response.cookies.get("trainiq-auth")?.sameSite).toBe("lax");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: { id } });
  await rpc(incoming);
  await proxy(request("/", browserCookies(response)));
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).includes("/token"))
  ).toHaveLength(1);
});

it("clears a definitively rejected refresh and keeps the request anonymous", async () => {
  fetchMock.mockResolvedValue(
    Response.json(
      { code: "refresh_token_not_found", message: "Invalid refresh token" },
      { status: 400 }
    )
  );
  const incoming = request(
    "/",
    storedCookies(jwt({ exp: now() - 30 }), now() - 30)
  );
  const response = await proxy(incoming);
  expect(response.status).toBe(200);
  expect(response.cookies.get("trainiq-auth")?.maxAge).toBe(0);
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
});

it("preserves browser credentials on a temporary refresh failure", async () => {
  fetchMock.mockImplementation(async () =>
    Response.json({ message: "Rate limited" }, { status: 429 })
  );
  const cookie = storedCookies(jwt({ exp: now() - 30 }), now() - 30);
  const incoming = request("/", cookie);
  const response = await proxy(incoming);
  expect(response.status).toBe(200);
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("x-middleware-request-cookie")).toBe(cookie);
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(await response.text()).not.toMatch(/refresh|token|Rate limited/);
});

it("continues anonymously when proactive refresh is temporarily rejected, even with a still-valid access token", async () => {
  fetchMock.mockImplementation(async (input) => {
    if (String(input).endsWith("/.well-known/jwks.json"))
      return Response.json({ keys: [jwk] });
    return Response.json({ message: "Rate limited" }, { status: 429 });
  });
  const incoming = request(
    "/",
    storedCookies(jwt({ exp: now() + 15 }), now() + 15)
  );
  const response = await proxy(incoming);
  expect(response.status).toBe(200);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
});

it.each(["/", "/api/trpc/auth.me", "/api/trpc/planning.getWeeklyPlan"])(
  "continues anonymously on %s with absent or invalid auth configuration",
  async (path) => {
    for (const url of ["", "invalid-url"]) {
      vi.stubEnv("SUPABASE_URL", url);
      const cookie = storedCookies();
      const incoming = request(path, cookie, { [ACCESS_TOKEN_HEADER]: jwt() });
      const response = await proxy(incoming);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("x-middleware-request-cookie")).toBe(cookie);
      expect(response.headers.has("set-cookie")).toBe(false);
      expect(incoming.headers.has(ACCESS_TOKEN_HEADER)).toBe(false);
      expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
      expect(
        await createTRPCContext(new Headers({ [ACCESS_TOKEN_HEADER]: jwt() }))
      ).toEqual({ user: null });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  }
);

it.each(["network", 429, 502, 503, 504] as const)(
  "preserves cookies and continues anonymously when refresh fails: %s",
  async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(async () => {
      if (failure === "network") throw new TypeError("Network unavailable");
      return Response.json({ message: "Unavailable" }, { status: failure });
    });
    const cookie = storedCookies(jwt({ exp: now() - 30 }), now() - 30);
    const incoming = request("/api/trpc/auth.me", cookie);
    // Real SDK, no fake timers: a retry regression must fail rather than be skipped.
    const response = await proxy(incoming);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-request-cookie")).toBe(cookie);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(incoming.headers.has(ACCESS_TOKEN_HEADER)).toBe(false);
    expect(await (await rpc(incoming)).json()).toEqual({
      result: { data: null },
    });
  }
);

it("bounds a non-responsive Proxy refresh to two seconds, aborts it and never retries", async () => {
  vi.useFakeTimers();
  expect(PROXY_AUTH_NETWORK_BUDGET_MS).toBe(2_000);
  fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
  const cookie = storedCookies(jwt({ exp: now() - 30 }), now() - 30);
  const incoming = request("/api/trpc/planning.getWeeklyPlan", cookie);
  let completed = false;
  const pending = proxy(incoming).then((response) => {
    completed = true;
    return response;
  });
  await vi.advanceTimersByTimeAsync(1_999);
  expect(completed).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  const response = await pending;
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("x-middleware-request-cookie")).toBe(cookie);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(incoming.headers.has(ACCESS_TOKEN_HEADER)).toBe(false);
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
  expect(vi.getTimerCount()).toBe(0);
});

it("shares the two-second budget between refresh and subsequent JWKS validation", async () => {
  vi.useFakeTimers();
  const replacement = jwt({}, "slow-jwks-key");
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/token"))
      return new Promise<Response>((resolve) => {
        setTimeout(
          () =>
            resolve(
              Response.json({
                access_token: replacement,
                refresh_token: "new-refresh",
                expires_in: 3600,
                token_type: "bearer",
                user,
              })
            ),
          1_500
        );
      });
    return new Promise<Response>(() => {});
  });
  const cookie = storedCookies(jwt({ exp: now() - 30 }), now() - 30);
  const incoming = request("/", cookie);
  const pending = proxy(incoming);
  await vi.advanceTimersByTimeAsync(2_000);
  const response = await pending;
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).includes("/token"))
  ).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("x-middleware-request-cookie")).toBe(cookie);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(incoming.headers.has(ACCESS_TOKEN_HEADER)).toBe(false);
  expect(await createTRPCContext(incoming.headers)).toEqual({ user: null });
});

it("discards refreshed cookies when JWKS verification fails, and the downstream context also fails closed", async () => {
  const token = jwt({}, "unavailable-key");
  fetchMock.mockImplementation(async (input) => {
    if (String(input).includes("/token"))
      return Response.json({
        access_token: token,
        refresh_token: "new-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    return Response.json({ message: "JWKS unavailable" }, { status: 429 });
  });
  const cookie = storedCookies(jwt({ exp: now() - 30 }), now() - 30);
  const incoming = request("/api/trpc/auth.me", cookie);
  const response = await proxy(incoming);
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("x-middleware-request-cookie")).toBe(cookie);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(incoming.headers.has(ACCESS_TOKEN_HEADER)).toBe(false);
  expect(
    await createTRPCContext(new Headers({ [ACCESS_TOKEN_HEADER]: token }))
  ).toEqual({ user: null });
});

it("logout clears the original browser cookies even if a failed refresh staged deletions", async () => {
  fetchMock.mockImplementation(async () =>
    Response.json({ message: "Rate limited" }, { status: 429 })
  );
  const cookie = storedCookies(
    jwt({ exp: now() - 30 }),
    now() - 30,
    "x".repeat(7000)
  );
  const proxied = await proxy(
    request("/auth/logout", cookie, { origin }, "POST")
  );
  expect(proxied.headers.get("x-middleware-request-cookie")).toBe(cookie);
  const forwarded = request(
    "/auth/logout",
    proxied.headers.get("x-middleware-request-cookie")!,
    {
      origin,
      [AUTH_UNAVAILABLE_HEADER]: proxied.headers.get(
        `x-middleware-request-${AUTH_UNAVAILABLE_HEADER}`
      )!,
    },
    "POST"
  );
  const response = await logout(forwarded);
  expect(response.headers.get("location")).toBe(
    `${origin}/?auth=logout-incomplete`
  );
  expect(response.cookies.getAll().length).toBeGreaterThan(1);
  response.cookies.getAll().forEach((cookie) => expect(cookie.maxAge).toBe(0));
});

it("rejects a cross-site login initiation", async () => {
  const response = await login(
    request("/auth/login/github", "", { "sec-fetch-site": "cross-site" })
  );
  expect(response.status).toBe(403);
  expect(response.headers.has("set-cookie")).toBe(false);
});

it("does not turn auth endpoints into successful anonymous operations when configuration is missing", async () => {
  vi.stubEnv("SUPABASE_URL", "");
  await expect(login(request("/auth/login/github"))).rejects.toThrow(
    "Missing TrainIQ Auth configuration"
  );
  await expect(
    callback(request("/auth/callback?code=invalid"))
  ).rejects.toThrow("Missing TrainIQ Auth configuration");
  await expect(
    logout(request("/auth/logout", "", { origin }, "POST"))
  ).rejects.toThrow("Missing TrainIQ Auth configuration");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("starts S256 PKCE, bounds every verifier cookie, consumes them and controls the final redirect", async () => {
  const started = await login(
    request("/auth/login/github?next=https://evil.example")
  );
  const authorization = new URL(started.headers.get("location")!);
  expect(authorization.origin).toBe(project);
  expect(authorization.searchParams.get("code_challenge_method")).toBe("s256");
  expect(authorization.searchParams.get("redirect_to")).toBe(
    `${origin}/auth/callback`
  );
  expect(started.cookies.getAll().length).toBeGreaterThan(0);
  started.cookies.getAll().forEach((cookie) => {
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    expect(cookie.domain).toBeUndefined();
    expect(cookie.secure).toBe(false);
  });
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/.well-known/jwks.json"))
      return Response.json({ keys: [jwk] });
    expect(url.searchParams.get("grant_type")).toBe("pkce");
    const body = JSON.parse(String(init?.body));
    expect(body.auth_code).toBe("single-use-code");
    expect(
      createHash("sha256").update(body.code_verifier).digest("base64url")
    ).toBe(authorization.searchParams.get("code_challenge"));
    return Response.json({
      access_token: jwt(),
      refresh_token: "new-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user,
    });
  });
  const completed = await callback(
    request(
      "/auth/callback?code=single-use-code&next=//evil.example",
      browserCookies(started),
      { "x-forwarded-host": "evil.example" }
    )
  );
  expect(completed.headers.get("location")).toBe(`${origin}/`);
  expect(completed.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(completed.cookies.get("trainiq-auth")?.httpOnly).toBe(true);
  const verifierCookies = completed.cookies
    .getAll()
    .filter((cookie) => cookie.name.includes("code-verifier"));
  expect(verifierCookies.length).toBeGreaterThan(0);
  verifierCookies.forEach((cookie) => expect(cookie.maxAge).toBe(0));
});

it.each([
  "",
  "?error=access_denied&error_description=private",
  "?code=bad&next=https://evil.example",
])("handles unsuccessful callbacks safely: %s", async (query) => {
  const started = await login(request("/auth/login/github"));
  fetchMock.mockImplementation(async () =>
    Response.json(
      { message: "private provider detail", code: "bad_code_verifier" },
      { status: 400 }
    )
  );
  const completed = await callback(
    request(`/auth/callback${query}`, browserCookies(started))
  );
  expect(completed.headers.get("location")).toBe(
    `${origin}/?auth=login-failed`
  );
  expect(
    completed.cookies.getAll().every((cookie) => cookie.maxAge === 0)
  ).toBe(true);
  expect(await completed.text()).not.toContain("private");
});

it("rejects a callback after the temporary verifier is gone", async () => {
  const result = await callback(request("/auth/callback?code=expired-attempt"));
  expect(result.headers.get("location")).toBe(`${origin}/?auth=login-failed`);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("uses Secure host-only cookies in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TRAINIQ_APP_URL", "https://trainiq.example");
  const response = await login(
    new NextRequest("https://trainiq.example/auth/login/github")
  );
  response.cookies.getAll().forEach((cookie) => {
    expect(cookie.name.startsWith("__Host-")).toBe(true);
    expect(cookie).toMatchObject({ secure: true, httpOnly: true, path: "/" });
    expect(cookie.domain).toBeUndefined();
  });
});

it.each(["https://evil.example", "null", ""])(
  "rejects logout from an untrusted origin (%s) without contacting Supabase or changing cookies",
  async (untrustedOrigin) => {
    const response = await logout(
      request(
        "/auth/logout",
        storedCookies(),
        untrustedOrigin ? { origin: untrustedOrigin } : {},
        "POST"
      )
    );
    expect(response.status).toBe(403);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  }
);

it("revokes only this session on logout, clears cookies, and never refreshes in the handler", async () => {
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    expect(url.pathname).toBe("/auth/v1/logout");
    expect(url.searchParams.get("scope")).toBe("local");
    expect(init?.method).toBe("POST");
    return new Response(null, { status: 204 });
  });
  const response = await logout(
    request(
      "/auth/logout",
      `${storedCookies()}; trainiq-auth-code-verifier=old; unrelated=keep`,
      { origin, [ACCESS_TOKEN_HEADER]: jwt() },
      "POST"
    )
  );
  expect(response.headers.get("location")).toBe(`${origin}/`);
  expect(response.cookies.get("trainiq-auth")?.maxAge).toBe(0);
  expect(response.cookies.get("trainiq-auth-code-verifier")?.maxAge).toBe(0);
  expect(response.cookies.has("unrelated")).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("still clears local cookies and reports incomplete revocation when Supabase is unavailable", async () => {
  fetchMock.mockImplementation(async () =>
    Response.json({ message: "Unavailable" }, { status: 503 })
  );
  const response = await logout(
    request(
      "/auth/logout",
      storedCookies(),
      { origin, [ACCESS_TOKEN_HEADER]: jwt() },
      "POST"
    )
  );
  expect(response.headers.get("location")).toBe(
    `${origin}/?auth=logout-incomplete`
  );
  expect(response.cookies.get("trainiq-auth")?.maxAge).toBe(0);
});
