# TrainIQ Web and planning backend

See the [root README](../../README.md) for setup, provider configuration and validation.

Next.js generates the shared WeeklyPlan. The Web Server Component calls
`planning.getWeeklyPlan` through a local tRPC caller, without HTTP. React Native
calls the same procedure through `/api/trpc`. `connection()` keeps personal planning
out of prerendering. The backend rejects calls outside development before provider
access; this is not an authentication system and must not be exposed publicly.

Provider data is real; TrainIQ preferences are still prototype values. There is no
user authentication or persistence. TanStack Query is planned, not installed.
