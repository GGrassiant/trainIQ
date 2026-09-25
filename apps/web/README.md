# TrainIQ Web and planning backend

See the [root README](../../README.md) for setup, provider configuration and validation.

Next.js generates the shared WeeklyPlan. The Web Server Component calls
`planning.getWeeklyPlan` through a local tRPC caller, without HTTP. React Native
calls the same procedure through `/api/trpc`. `connection()` keeps personal planning
out of prerendering. The backend rejects calls outside development before provider
access; this is not an authentication system and must not be exposed publicly.

Provider data is real; TrainIQ preferences are still prototype values. GitHub login
identifies a Web user but does not protect or personalize the planner. There is no
business persistence. TanStack Query is planned, not installed.

## Web authentication

Configure hosted Supabase's GitHub provider and allow the exact redirect
`http://localhost:3000/auth/callback`. The GitHub OAuth App callback is the hosted
Supabase URL `https://<project-ref>.supabase.co/auth/v1/callback`.
Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `TRAINIQ_APP_URL` in `.env.local`
(see `.env.example`). No GitHub secret or Supabase service-role key belongs in Next.
Production requires an HTTPS app origin. Local HTTP uses `localhost` only.

The ordinary Auth API works with the Data API disabled. Keep Supabase OAuth Server
disabled; it is not required for GitHub social login. The configured signing key
should be asymmetric (the development project uses ECC P-256 / ES256).

`GET /auth/login/github` starts login, `GET /auth/callback` completes it, and
`POST /auth/logout` signs out with a strict Origin check. Redirects have fixed
destinations based on `TRAINIQ_APP_URL`, never a supplied Host/next parameter.
The UI uses full navigations, not prefetched OAuth links. Only one pending login
per browser is supported; beginning another replaces the prior attempt.
Pages use `Referrer-Policy: same-origin` so native logout forms retain their
Origin header. The OAuth callback alone uses `no-referrer` to avoid forwarding
its code in the next navigation. Missing, null and foreign logout origins are rejected.

Proxy refreshes the session, writes cookies on the final response, and supplies
the fresh cookie header downstream. An overwritten request-only JWT header bridges
Proxy and rendering so downstream verification never loads/refreshes a session.
Never reflect request headers, serialize session objects or log auth responses.
Proxy covers application routes, including unknown paths that render the root
layout; only Next static/image internals and explicitly named static assets are excluded.
On public application routes, missing auth configuration or an auth infrastructure
failure continues with `user: null`, preserves existing cookies, and discards staged
cookie writes. Context verification failures likewise resolve to an anonymous user.
This preserves public availability, never authenticated privileges. Auth endpoints
still require working configuration; definitive invalid sessions are cleared.
The Proxy alone uses a shared 2-second network budget (refresh, verification and
response bodies). Its request-scoped fetch maps temporary failures to a synthetic
JSON 429: pinned auth-js does not retry that status, while TrainIQ still treats it
as temporary and preserves cookies. Tests guard this SDK dependency. Login,
callback and logout clients retain their existing network policy.

`GET /api/trpc/auth.me` returns the tRPC envelope around `{ id } | null`.
Cookies are HttpOnly, host-only, SameSite=Lax, Path=/, and Secure in production.
Session cookie retention follows the SDK (400 days); this is not session validity.
PKCE cookies use a 15-minute login budget and are removed on callback. The pinned
SDK's PKCE cookie suffix is the only cookie-name convention handled explicitly.
Standard SDK session serialization can include provider tokens and user metadata;
only cryptographically verified JWT claims establish identity.

Logout uses the SDK's `auth.admin.signOut(userJwt, "local")` endpoint with the
publishable key, not an administrative credential. This avoids `auth.signOut()`'s
implicit session loading/refresh. It clears local cookies on remote failure and
reports that revocation could not be confirmed. Already-issued access JWTs may
remain valid until expiry. Logout does not revoke other device sessions.

Future tRPC mutations need explicit CSRF/origin policy. There are currently no
business mutations, no permissive CORS configuration and no Bearer mobile flow.

## Auth validation

Automated tests use real SDK operations and locally signed JWTs with a stubbed
external HTTP boundary. They exercise PKCE, validation, refresh, cookie propagation,
failure classification, logout and minimal tRPC output; they do not prove hosted
Supabase behavior. Existing planning tests remain in place.

Manual checklist (requires the configured Supabase/GitHub project):

- Sign in via GitHub, return to `/`, observe `Signed in` and `auth.me` with only ID.
- Inspect session and PKCE cookies: HttpOnly and expected local/production flags;
  verifier cookies disappear after callback. No tokens in HTML/RSC/tRPC responses,
  browser storage or application logs. `Set-Cookie` itself necessarily carries them.
- Allow the issued JWT to expire, then navigate/reload and call `auth.me`: cookies
  rotate, identity remains, and no downstream second refresh is sent.
- Repeat with parallel requests, two tabs and delayed responses; test on the target
  deployment as well (local simulation does not validate multi-instance races).
- Cancel GitHub authorization; test a stale/replayed callback; no open redirect.
- Sign out, verify cleared cookies and `auth.me = null`; verify another device's
  session remains. Test remote failure and the incomplete-revocation notice.
- Confirm the planner still works anonymously in development and retains its
  production restriction. It is not safe to expose its current personal data publicly.
