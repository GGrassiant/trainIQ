import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../../../lib/server/trpc/router";

export async function GET(request: Request): Promise<Response> {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => ({}),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
