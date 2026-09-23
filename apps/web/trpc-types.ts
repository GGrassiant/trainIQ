// Type-only entry point: mobile must never import the server router at runtime.
export type { AppRouter } from "./lib/server/trpc/router";
