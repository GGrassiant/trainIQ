import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { generateWeeklyPlan } from "../weekly-plan";
import type { RpcContext } from "./context-type";

const t = initTRPC.context<RpcContext>().create({
  // Even in development, HTTP clients do not need server stack traces.
  errorFormatter({ shape }) {
    return { ...shape, data: { ...shape.data, stack: undefined } };
  },
});

export const appRouter = t.router({
  auth: t.router({
    me: t.procedure.query(({ ctx }): { id: string } | null => ctx.user ? { id: ctx.user.id } : null),
  }),
  planning: t.router({
    getWeeklyPlan: t.procedure.query(async () => {
      // Shared by the HTTP handler and the local Web caller, before provider access.
      if (process.env.NODE_ENV !== "development") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Planning is only available in local development.",
        });
      }

      try {
        return await generateWeeklyPlan(new Date());
      } catch (error) {
        console.error("[TrainIQ] Weekly plan generation failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to generate the weekly plan. Check the server configuration and provider availability.",
          cause: error,
        });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
