# ADR 0005 — Supabase identity with a server-controlled Web session

## Status

Accepted. GitHub sign-in, session refresh, logout and concurrent refresh across
two tabs were validated manually in a real browser. Reordered refresh responses
and multiple Next instances remain unvalidated (see Consequences).

## Context

TrainIQ needs one identity provider for Web and a later React Native CLI client.
Next/tRPC is already the application backend. The architecture spike found
Supabase Web HttpOnly feasible but complex, and native PKCE feasible and recommended.
The mobile router declaration must not import the server implementation graph.

## Decision

Use hosted Supabase Auth with GitHub first. Next owns the Web session transport:
PKCE login/callback and HttpOnly, host-only cookies managed by `@supabase/ssr`.
Use Secure in production, SameSite=Lax and Path=/; temporary PKCE cookies last
15 minutes. One pending login per browser is supported in V1.

Proxy is the only automatic refresh owner. It forwards renewed cookies downstream
and to the browser. It overwrites an internal request-only access-token header;
RSC and HTTP context builders cryptographically revalidate that token using an
explicit `getClaims(jwt)` call that cannot load or refresh a session. No user ID
header is trusted. Each Proxy/handler owns its own client; the downstream verifier
is stateless. No user-session client is shared between requests or runtimes.

`RpcContext` exposes only `{ user: { id: string } | null }`. `auth.me` projects
that identity; SDK clients, JWTs, sessions and Next objects stay server-private.
Logout requires a same-origin POST, revokes the current Supabase session only,
and clears browser cookies even if remote revocation fails (with a visible notice).

React Native will later use the system browser, PKCE S256, secure native storage
and Bearer access tokens. Intervals OAuth will be a separate authorization to
access training data. Neither belongs to this Web implementation.

## Consequences

Next/tRPC remains the business backend. There is no business DB, Google provider,
or browser Supabase client in this change. The planner remains a development-only,
single-user prototype with existing global/personal inputs, not a multi-user service.

JWT verification checks signature, expiry, issuer, audience and user subject.
It does not promise instantaneous revocation: issued JWTs remain valid until expiry.
Supabase rotation tolerates ordinary concurrent refreshes, but reordered responses
and multiple Next instances still require manual validation. No distributed session
store is introduced. Transient auth failures preserve browser credentials.
Public application routes continue anonymously when auth configuration or identity
resolution fails; staged cookie writes are discarded on infrastructure failure.
The public planner's server caller explicitly uses `{ user: null }`. Auth endpoints
remain strict. Proxy covers all application routes that may render the root layout,
excluding only Next static/image internals and explicitly named static assets.

SDK cookie serialization/chunking remains intact. The standard session may include
user metadata/provider tokens, all HttpOnly; none is exposed through tRPC or UI.
PKCE cookie-name handling is coupled to pinned SSR SDK conventions and tested.
Future cookie-authenticated tRPC mutations must add origin/CSRF checks; SameSite
alone and Server Action protections do not protect an arbitrary Route Handler.
